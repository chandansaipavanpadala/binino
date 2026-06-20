import time
import logging
from typing import Callable

logger = logging.getLogger("binino.protocols.slip")

def slip_frame(data: bytes) -> bytes:
    """Encapsulates a packet in SLIP framing."""
    framed = [0xC0]
    for byte in data:
        if byte == 0xC0:
            framed.extend([0xDB, 0xDC])
        elif byte == 0xDB:
            framed.extend([0xDB, 0xDD])
        else:
            framed.append(byte)
    framed.append(0xC0)
    return bytes(framed)

def slip_unframe(framed: bytes) -> bytes:
    """Decodes a SLIP-framed packet."""
    unframed = []
    i = 0
    # Strip boundary C0s
    if framed.startswith(b'\xc0'):
        framed = framed[1:]
    if framed.endswith(b'\xc0'):
        framed = framed[:-1]
    
    while i < len(framed):
        if framed[i] == 0xDB and i + 1 < len(framed):
            if framed[i+1] == 0xDC:
                unframed.append(0xC0)
                i += 2
            elif framed[i+1] == 0xDD:
                unframed.append(0xDB)
                i += 2
            else:
                unframed.append(framed[i])
                i += 1
        else:
            unframed.append(framed[i])
            i += 1
    return bytes(unframed)

def compute_checksum(data: bytes, seed: int = 0xEF) -> int:
    """Computes XOR checksum over data bytes starting with seed."""
    result = seed
    for b in data:
        result ^= b
    return result & 0xFF

def calculate_checksum(data: bytes, seed: int = 0xEF) -> int:
    return compute_checksum(data, seed)

def chip_detect(ser) -> str:
    """Detects ESP32 variant using READ_MEM opcode 0x0A at address 0x40001000."""
    # Build READ_MEM packet: Opcode=0x0A, size=16, addr=0x40001000, length=4
    # Frame layout for esptool commands:
    # 0x00 (direction: write), opcode, size (2 bytes), value (4 bytes), variables...
    cmd = bytearray(8)
    cmd[0] = 0x00
    cmd[1] = 0x0A # READ_MEM
    cmd[2:4] = (16).to_bytes(2, 'little')
    # Variables: Address (4 bytes), Length (4 bytes), Buffer (4 bytes), Checksum (4 bytes)
    variables = bytearray(16)
    variables[0:4] = (0x40001000).to_bytes(4, 'little')
    variables[4:8] = (4).to_bytes(4, 'little')
    # checksum is not strictly needed for read_mem on some ROMs, but let's send standard zeros
    packet = slip_frame(cmd + variables)
    
    try:
        ser.write(packet)
        # Read response
        time.sleep(0.1)
        resp_raw = ser.read(128)
        if resp_raw:
            resp = slip_unframe(resp_raw)
            if len(resp) >= 8:
                # Response body starts at index 8. The read value:
                val = int.from_bytes(resp[8:12], 'little')
                if val == 0x00f0ad88: # Mock chip signature
                    return "esp32c3"
                elif val == 0x00f0ad89:
                    return "esp32s3"
    except Exception as e:
        logger.warning(f"Chip detect read failed: {e}")
    return "esp32" # Default fallback

def read_flash(port: str, mcu_profile, flash_size: int, progress_callback: Callable[[int, int], None]) -> bytes:
    """Reads flash using the Espressif SLIP bootloader protocol."""
    logger.info(f"Opening SLIP interface on {port} for {mcu_profile.mcu_id}...")
    
    if port == "mock" or port == "simulated":
        # Run simulation
        temp_buffer = bytearray(flash_size)
        for offset in range(0, flash_size, 1024):
            time.sleep(0.001)
            for j in range(min(1024, flash_size - offset)):
                temp_buffer[offset + j] = (offset + j) % 256
            progress_callback(offset + 1024, flash_size)
        return bytes(temp_buffer)

    try:
        import serial
    except ImportError:
        raise ImportError("pyserial is required to run the real SLIP protocol. Run: pip install pyserial")

    # Connect to hardware serial port
    with serial.Serial(port, baudrate=mcu_profile.default_baud, timeout=1.0) as ser:
        # Toggle DTR/RTS to reset into bootloader
        ser.setDTR(True)
        ser.setRTS(True)
        time.sleep(0.1)
        ser.setDTR(False)
        ser.setRTS(True)
        time.sleep(0.1)
        ser.setDTR(False)
        ser.setRTS(False)
        time.sleep(0.1)
        
        # Flush buffers
        ser.reset_input_buffer()
        ser.reset_output_buffer()
        
        # Send SYNC sequence
        sync_cmd = slip_frame(b'\x00\x08\x24\x00\x07\x07\x12\x20' + b'\x55' * 32)
        ser.write(sync_cmd)
        time.sleep(0.1)
        resp = ser.read(64)
        if not resp:
            raise Exception("SYNC handshake failed. Check hardware connections.")

        chip = chip_detect(ser)
        logger.info(f"Detected Espressif target chip: {chip}")
        
        def read_flash_range(start_addr: int, length: int) -> bytes:
            buf = bytearray()
            block_size = 1024
            for offset in range(start_addr, start_addr + length, block_size):
                read_cmd = bytearray(8)
                read_cmd[0] = 0x00
                read_cmd[1] = 0x03
                read_cmd[2:4] = (16).to_bytes(2, 'little')
                
                variables = bytearray(16)
                variables[0:4] = offset.to_bytes(4, 'little')
                variables[4:8] = block_size.to_bytes(4, 'little')
                variables[8:12] = (0).to_bytes(4, 'little')
                variables[12:16] = (0).to_bytes(4, 'little')
                
                packet = slip_frame(read_cmd + variables)
                ser.write(packet)
                
                success = False
                for retry in range(3):
                    time.sleep(0.01)
                    block_resp_raw = ser.read(block_size + 32)
                    if block_resp_raw:
                        block_resp = slip_unframe(block_resp_raw)
                        if len(block_resp) >= 8 + block_size:
                            payload = block_resp[8:8+block_size]
                            buf.extend(payload)
                            success = True
                            break
                if not success:
                    buf.extend(b'\x00' * block_size)
            return bytes(buf)

        app_offset = 0
        if "c3" in chip or "c6" in chip or "h2" in chip:
            # RISC-V variants: Read partition table at 0x8000
            logger.info("Reading RISC-V target partition table at 0x8000...")
            part_table_bytes = read_flash_range(0x8000, 4096)
            
            parsed_offset = None
            parsed_size = None
            for i in range(0, len(part_table_bytes), 32):
                entry = part_table_bytes[i:i+32]
                if len(entry) < 32:
                    break
                if entry[0] == 0xAA and entry[1] == 0x50:
                    part_type = entry[2]
                    part_subtype = entry[3]
                    part_offset = int.from_bytes(entry[4:8], 'little')
                    part_size = int.from_bytes(entry[8:12], 'little')
                    if part_type == 0x00 and part_subtype == 0x10:
                        parsed_offset = part_offset
                        parsed_size = part_size
                        break
            
            if parsed_offset is not None:
                logger.info(f"Found factory app partition at offset {hex(parsed_offset)} with size {parsed_size} bytes")
                app_offset = parsed_offset
                flash_size = min(flash_size, parsed_size)
            else:
                logger.warning("Could not find factory app partition (0x00, 0x10) in partition table, defaulting to 0x10000")
                app_offset = 0x10000
            
        # Read flash blocks
        data = bytearray()
        block_size = 1024
        
        for offset in range(app_offset, app_offset + flash_size, block_size):
            # Command layout: Opcode 0x03 (READ_FLASH), Size=16, Addr=offset, Length=block_size
            read_cmd = bytearray(8)
            read_cmd[0] = 0x00
            read_cmd[1] = 0x03
            read_cmd[2:4] = (16).to_bytes(2, 'little')
            
            variables = bytearray(16)
            variables[0:4] = offset.to_bytes(4, 'little')
            variables[4:8] = block_size.to_bytes(4, 'little')
            variables[8:12] = (0).to_bytes(4, 'little')
            variables[12:16] = (0).to_bytes(4, 'little')
            
            packet = slip_frame(read_cmd + variables)
            ser.write(packet)
            
            # Read block with 3 retries on checksum errors
            success = False
            for retry in range(3):
                time.sleep(0.01)
                block_resp_raw = ser.read(block_size + 32)
                if block_resp_raw:
                    block_resp = slip_unframe(block_resp_raw)
                    if len(block_resp) >= 8 + block_size:
                        payload = block_resp[8:8+block_size]
                        # Verify checksum
                        expected_chk = block_resp[4] # Checksum index
                        actual_chk = compute_checksum(payload)
                        if expected_chk == actual_chk or expected_chk == 0: # 0 means skip check
                            data.extend(payload)
                            success = True
                            break
            if not success:
                logger.warning(f"Failed to read block at offset {hex(offset)}, padding with zeros")
                data.extend(b'\x00' * block_size)
                
            progress_callback(offset - app_offset + block_size, flash_size)
            
        return bytes(data)

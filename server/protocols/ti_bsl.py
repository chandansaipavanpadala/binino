import time
import logging
from typing import Callable

logger = logging.getLogger("binino.protocols.ti_bsl")

def calculate_bsl_checksum(data: bytes) -> int:
    """Calculates two's complement of the sum of packet bytes."""
    byte_sum = sum(data) & 0xFF
    return ((~byte_sum) + 1) & 0xFF

def read_flash(port: str, mcu_profile, flash_size: int, progress_callback: Callable[[int, int], None]) -> bytes:
    """Reads flash using the TI-BSL protocol (MSP430)."""
    logger.info(f"Opening TI-BSL interface on {port} for {mcu_profile.mcu_id}...")
    
    if port == "mock" or port == "simulated":
        temp_buffer = bytearray(flash_size)
        for offset in range(0, flash_size, 128):
            time.sleep(0.001)
            for j in range(min(128, flash_size - offset)):
                temp_buffer[offset + j] = (offset + j) % 256
            progress_callback(offset + 128, flash_size)
        return bytes(temp_buffer)

    try:
        import serial
    except ImportError:
        raise ImportError("pyserial is required to run the real TI-BSL protocol.")

    with serial.Serial(port, baudrate=mcu_profile.default_baud, timeout=1.0) as ser:
        # Toggle RST and TEST/TCK pins to invoke BSL entry sequence
        # Standard entry sequence:
        # TEST high, RST low, TEST low, TEST high, RST high, TEST low.
        ser.setRTS(True)  # RST high
        ser.setDTR(False) # TEST low
        time.sleep(0.1)
        
        ser.setDTR(True)  # TEST high
        ser.setRTS(False) # RST low
        time.sleep(0.1)
        ser.setDTR(False) # TEST low
        time.sleep(0.1)
        ser.setDTR(True)  # TEST high
        time.sleep(0.1)
        ser.setRTS(True)  # RST high
        time.sleep(0.1)
        ser.setDTR(False) # TEST low
        time.sleep(0.2)
        
        ser.reset_input_buffer()
        ser.reset_output_buffer()
        
        # Send synchronization byte (0x80)
        ser.write(b'\x80')
        time.sleep(0.05)
        resp = ser.read(1)
        if resp != b'\x00': # BSL standard ACK is 0x00
            logger.warning("BSL Sync failed. Forcing read protocol...")

        data = bytearray()
        block_size = 128
        base_addr = mcu_profile.flash_base
        
        for offset in range(0, flash_size, block_size):
            addr = base_addr + offset
            addr_l = addr & 0xFF
            addr_h = (addr >> 8) & 0xFF
            
            # RX_DATA_BLOCK command is 0x10.
            # Header: 0x80, CMD_LEN (always 4 for this read cmd), CMD (0x10), ADDR_L, ADDR_H, LENGTH (block_size)
            cmd_body = bytes([0x10, addr_l, addr_h, block_size])
            chk = calculate_bsl_checksum(cmd_body)
            
            packet = bytes([0x80, len(cmd_body)]) + cmd_body + bytes([chk])
            ser.write(packet)
            time.sleep(0.01)
            
            # Read BSL response: Expect ACK (0x00), then response header and payload
            resp_ack = ser.read(1)
            if resp_ack != b'\x00':
                logger.warning(f"Did not receive BSL ACK at offset {hex(offset)}")
            
            # Response: Header (0x80), Len, Data..., Checksum
            resp_header = ser.read(2)
            if resp_header and resp_header[0] == 0x80:
                resp_len = resp_header[1]
                payload = ser.read(resp_len)
                ser.read(1) # Read trailing checksum
                
                if len(payload) < block_size:
                    payload += b'\x00' * (block_size - len(payload))
            else:
                payload = b'\x00' * block_size
                
            data.extend(payload)
            progress_callback(offset + block_size, flash_size)
            
        return bytes(data)

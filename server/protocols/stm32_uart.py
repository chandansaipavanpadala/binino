import time
import logging
from typing import Callable

logger = logging.getLogger("binino.protocols.stm32")

def read_flash(port: str, mcu_profile, flash_size: int, progress_callback: Callable[[int, int], None]) -> bytes:
    """Reads flash using the STM32 UART bootloader protocol (AN3155)."""
    logger.info(f"Opening STM32-UART interface on {port} for {mcu_profile.mcu_id}...")
    
    if port == "mock" or port == "simulated":
        temp_buffer = bytearray(flash_size)
        for offset in range(0, flash_size, 256):
            time.sleep(0.001)
            for j in range(min(256, flash_size - offset)):
                temp_buffer[offset + j] = (offset + j) % 256
            progress_callback(offset + 256, flash_size)
        return bytes(temp_buffer)

    try:
        import serial
    except ImportError:
        raise ImportError("pyserial is required to run the real STM32-UART protocol.")

    with serial.Serial(port, baudrate=mcu_profile.default_baud, parity=serial.PARITY_EVEN, stopbits=serial.STOPBITS_ONE, timeout=1.0) as ser:
        # Send 0x7F for autobaud
        ser.write(b'\x7F')
        time.sleep(0.05)
        ack = ser.read(1)
        if ack != b'\x79':
            raise Exception("Autobaud synchronization failed. Expected ACK 0x79, got " + str(ack))
            
        # Send GET command (0x00 + 0xFF)
        ser.write(b'\x00\xFF')
        time.sleep(0.05)
        resp = ser.read(64)
        if not resp or resp[0] != 0x79:
            raise Exception("GET command failed")
            
        # Send GET_ID command (0x02 + 0xFD)
        ser.write(b'\x02\xFD')
        time.sleep(0.05)
        resp_id = ser.read(16)
        if not resp_id or resp_id[0] != 0x79:
            logger.warning("GET_ID command failed, continuing analysis...")
        else:
            pid = resp_id[2:4]
            logger.info(f"Detected STM32 chip PID: 0x{pid.hex().upper()}")

        data = bytearray()
        block_size = 256
        base_addr = mcu_profile.flash_base  # 0x08000000
        
        for offset in range(0, flash_size, block_size):
            addr = base_addr + offset
            
            # Send READ_MEMORY command (0x11 + 0xEE)
            ser.write(b'\x11\xEE')
            time.sleep(0.01)
            ack = ser.read(1)
            if ack != b'\x79':
                raise Exception(f"READ_MEMORY cmd rejected at offset {hex(offset)}")
                
            # Send 4-byte BE address + XOR checksum
            addr_bytes = addr.to_bytes(4, 'big')
            chk = 0
            for b in addr_bytes:
                chk ^= b
            ser.write(addr_bytes + bytes([chk]))
            time.sleep(0.01)
            ack = ser.read(1)
            if ack != b'\x79':
                raise Exception(f"Address rejected at offset {hex(offset)}")
                
            # Send N-1 length + checksum (N = block_size)
            len_val = block_size - 1
            ser.write(bytes([len_val, len_val ^ 0xFF]))
            time.sleep(0.01)
            ack = ser.read(1)
            if ack != b'\x79':
                raise Exception(f"Length rejected at offset {hex(offset)}")
                
            # Read block_size data bytes
            payload = ser.read(block_size)
            if len(payload) < block_size:
                logger.warning(f"Short read at offset {hex(offset)}. Padding block.")
                payload += b'\x00' * (block_size - len(payload))
                
            data.extend(payload)
            progress_callback(offset + block_size, flash_size)
            
        return bytes(data)

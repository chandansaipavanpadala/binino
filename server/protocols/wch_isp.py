import time
import logging
from typing import Callable

logger = logging.getLogger("binino.protocols.wch_isp")

def read_flash(port: str, mcu_profile, flash_size: int, progress_callback: Callable[[int, int], None]) -> bytes:
    """Reads flash using the WCH-ISP protocol (CH32 / CH55x)."""
    logger.info(f"Opening WCH-ISP interface on {port} for {mcu_profile.mcu_id}...")
    
    if port == "mock" or port == "simulated":
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
        raise ImportError("pyserial is required to run the real WCH-ISP protocol.")

    with serial.Serial(port, baudrate=mcu_profile.default_baud, timeout=1.0) as ser:
        # WCH ISP Handshake command sequence: [0x57, 0xAB, 0xA2, 0x01, 0x00, 0x01]
        handshake = b'\x57\xAB\xA2\x01\x00\x01'
        ser.write(handshake)
        time.sleep(0.05)
        resp = ser.read(16)
        # Expected response contains 0x55 or 0x82/0x81 flags
        if not resp:
            logger.warning("WCH-ISP Handshake failed. Forcing read sequence...")

        data = bytearray()
        block_size = 1024
        
        for offset in range(0, flash_size, block_size):
            # Read block command header: 0x57, 0xAB, 0x54 (READ_FLASH opcode), LEN, OFFSET_L, OFFSET_H...
            cmd = bytearray(8)
            cmd[0] = 0x57
            cmd[1] = 0xAB
            cmd[2] = 0x54 # READ_FLASH
            cmd[3] = 4 # Variable length
            cmd[4:8] = offset.to_bytes(4, 'little')
            
            ser.write(bytes(cmd))
            time.sleep(0.01)
            
            # Read block_size bytes response
            payload = ser.read(block_size)
            if len(payload) < block_size:
                logger.warning(f"Short WCH-ISP read at offset {hex(offset)}. Padding block.")
                payload += b'\x00' * (block_size - len(payload))
                
            data.extend(payload)
            progress_callback(offset + block_size, flash_size)
            
        return bytes(data)

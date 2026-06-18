import time
import logging
from typing import Callable

logger = logging.getLogger("binino.protocols.bossa")

def read_flash(port: str, mcu_profile, flash_size: int, progress_callback: Callable[[int, int], None]) -> bytes:
    """Reads flash using the BOSSA protocol (SAMD21/SAMD51)."""
    logger.info(f"Opening BOSSA interface on {port} for {mcu_profile.mcu_id}...")
    
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
        raise ImportError("pyserial is required to run the real BOSSA protocol.")

    # 1. 1200-baud touch to trigger bootloader reset
    logger.info("Performing 1200-baud touch reset...")
    try:
        touch_ser = serial.Serial(port, baudrate=1200)
        touch_ser.close()
    except Exception as touch_ex:
        logger.warning(f"1200-baud touch reset failed: {touch_ex}. Hoping chip is already in bootloader mode...")
        
    # Wait for USB disconnect/re-enumeration
    time.sleep(2.0)

    # 2. Open at 115200 for binary mode commands
    with serial.Serial(port, baudrate=115200, timeout=1.0) as ser:
        # Enter binary mode: send '#'
        ser.write(b'#')
        time.sleep(0.1)
        ser.reset_input_buffer()
        
        data = bytearray()
        block_size = 1024
        
        for offset in range(0, flash_size, block_size):
            # Send S <addr>,<size> #
            cmd = f"S{offset},{block_size}#".encode('ascii')
            ser.write(cmd)
            time.sleep(0.01)
            
            # Read block
            payload = ser.read(block_size)
            if len(payload) < block_size:
                logger.warning(f"BOSSA read timeout at offset {hex(offset)}. Padding block.")
                payload += b'\x00' * (block_size - len(payload))
                
            data.extend(payload)
            progress_callback(offset + block_size, flash_size)
            
        return bytes(data)

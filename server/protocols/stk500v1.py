import time
import logging
from typing import Callable

logger = logging.getLogger("binino.protocols.stk500v1")

def read_flash(port: str, mcu_profile, flash_size: int, progress_callback: Callable[[int, int], None]) -> bytes:
    """Reads flash using the STK500v1 protocol."""
    logger.info(f"Opening STK500v1 interface on {port} for {mcu_profile.mcu_id}...")
    
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
        raise ImportError("pyserial is required to run the real STK500v1 protocol.")

    with serial.Serial(port, baudrate=mcu_profile.default_baud, timeout=1.0) as ser:
        # Perform connection handshake
        for _ in range(3):
            ser.write(b'\x30\x20')  # CRC_EOP / GET_SYNC
            time.sleep(0.05)
            resp = ser.read(2)
            if resp == b'\x14\x10':  # STK_INSYNC followed by STK_OK
                break
        else:
            raise Exception("STK500v1 sync handshake failed. Verify connections and DTR reset pins.")

        # Enter programming mode: 0x50 0x20
        ser.write(b'\x50\x20')
        time.sleep(0.05)
        resp = ser.read(2)
        if resp != b'\x14\x10':
            logger.warning("Failed to enter STK500v1 programming mode, continuing anyway...")

        data = bytearray()
        page_size = 128
        
        for offset in range(0, flash_size, page_size):
            # Load address (address is in words for AVR, so divide by 2)
            word_addr = offset // 2
            addr_h = (word_addr >> 8) & 0xFF
            addr_l = word_addr & 0xFF
            
            ser.write(bytes([0x55, addr_l, addr_h, 0x20]))
            time.sleep(0.01)
            resp = ser.read(2)
            if resp != b'\x14\x10':
                raise Exception(f"STK500v1 set address failed at offset {hex(offset)}")
                
            # Read Page: 0x74 SizeH SizeL 'F' 0x20
            size_h = (page_size >> 8) & 0xFF
            size_l = page_size & 0xFF
            
            ser.write(bytes([0x74, size_h, size_l, 0x46, 0x20])) # 'F' is 0x46
            time.sleep(0.02)
            
            # STK500v1 returns STK_INSYNC (0x14) followed by data bytes, followed by STK_OK (0x10)
            resp_bytes = ser.read(page_size + 2)
            if len(resp_bytes) < page_size + 2 or resp_bytes[0] != 0x14 or resp_bytes[-1] != 0x10:
                logger.warning(f"Short page read at offset {hex(offset)}. Padding.")
                payload = resp_bytes[1:-1] if len(resp_bytes) > 2 else b""
                payload += b'\x00' * (page_size - len(payload))
            else:
                payload = resp_bytes[1:-1]
                
            data.extend(payload)
            progress_callback(offset + page_size, flash_size)
            
        # Exit prog mode: 0x51 0x20
        ser.write(b'\x51\x20')
        time.sleep(0.05)
        
        return bytes(data)

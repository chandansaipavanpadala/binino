import time
import logging
from typing import Callable

logger = logging.getLogger("binino.protocols.xmodem_uart")

def crc16_ccitt(data: bytes) -> int:
    """Calculates CRC-16/CCITT with polynomial 0x1021 and initial value 0x0000."""
    crc = 0
    for byte in data:
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
            crc &= 0xFFFF
    return crc

def read_flash(port: str, mcu_profile, flash_size: int, progress_callback: Callable[[int, int], None]) -> bytes:
    """Reads flash using XMODEM-CRC protocol over UART (EFM32)."""
    logger.info(f"Opening XMODEM-UART interface on {port} for {mcu_profile.mcu_id}...")
    
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
        raise ImportError("pyserial is required to run the real XMODEM-UART protocol.")

    with serial.Serial(port, baudrate=mcu_profile.default_baud, timeout=2.0) as ser:
        # 1. Trigger the EFM32 bootloader read mode by sending 'r\r' or 'r'
        ser.write(b'r\r')
        time.sleep(0.1)
        ser.reset_input_buffer()
        
        # 2. Start XMODEM transmission by sending 'C' (0x43) to negotiate CRC-16 mode
        ser.write(b'\x43')
        
        data = bytearray()
        block_num = 1
        
        while len(data) < flash_size:
            # Packet: [SOH] [Block#] [255 - Block#] [128 bytes data] [CRC-H] [CRC-L]
            header = ser.read(3)
            if not header:
                # Try sending 'C' again to prompt the sender
                ser.write(b'\x43')
                header = ser.read(3)
                if not header:
                    raise Exception("XMODEM handshake timeout. Failed to negotiate transfer.")
                    
            if header[0] == 0x04: # EOT (End of Transmission)
                ser.write(b'\x06') # Send ACK
                break
                
            if header[0] != 0x01: # Not SOH
                # Invalidate packet, send NAK
                ser.write(b'\x15')
                continue
                
            pkt_block_num = header[1]
            pkt_block_inv = header[2]
            
            # Read 128 bytes of data
            payload = ser.read(128)
            # Read 2 bytes CRC
            crc_bytes = ser.read(2)
            
            if len(payload) < 128 or len(crc_bytes) < 2:
                ser.write(b'\x15') # Send NAK for retry
                continue
                
            # Verify block number inversion
            if pkt_block_num + pkt_block_inv != 255:
                ser.write(b'\x15')
                continue
                
            # Verify CRC
            computed_crc = crc16_ccitt(payload)
            expected_crc = (crc_bytes[0] << 8) | crc_bytes[1]
            
            if computed_crc != expected_crc:
                ser.write(b'\x15')
                continue
                
            # Accept block
            data.extend(payload)
            ser.write(b'\x06') # Send ACK
            
            progress_callback(len(data), flash_size)
            block_num = (block_num + 1) & 0xFF
            
        return bytes(data[:flash_size])

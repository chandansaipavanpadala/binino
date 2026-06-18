import time
import logging
from typing import Callable

logger = logging.getLogger("binino.protocols.lpc_isp")

def uu_decode_line(line: str) -> bytes:
    """Decodes a single UU-encoded line of ASCII text."""
    if not line or line.startswith('`'):
        return b""
    # UU-encoding offset is 32
    line_bytes = [min(max(ord(c) - 32, 0), 63) for c in line]
    length = line_bytes[0]
    
    out = bytearray()
    i = 1
    while len(out) < length and i + 3 < len(line_bytes):
        a, b, c, d = line_bytes[i:i+4]
        b1 = ((a << 2) | (b >> 4)) & 0xFF
        b2 = ((b << 4) | (c >> 2)) & 0xFF
        b3 = ((c << 6) | d) & 0xFF
        out.append(b1)
        if len(out) < length:
            out.append(b2)
        if len(out) < length:
            out.append(b3)
        i += 4
    return bytes(out[:length])

def read_flash(port: str, mcu_profile, flash_size: int, progress_callback: Callable[[int, int], None]) -> bytes:
    """Reads flash using the NXP LPC ASCII-based ISP protocol."""
    logger.info(f"Opening LPC-ISP interface on {port} for {mcu_profile.mcu_id}...")
    
    if port == "mock" or port == "simulated":
        temp_buffer = bytearray(flash_size)
        for offset in range(0, flash_size, 512):
            time.sleep(0.001)
            for j in range(min(512, flash_size - offset)):
                temp_buffer[offset + j] = (offset + j) % 256
            progress_callback(offset + 512, flash_size)
        return bytes(temp_buffer)

    try:
        import serial
    except ImportError:
        raise ImportError("pyserial is required to run the real LPC-ISP protocol.")

    with serial.Serial(port, baudrate=mcu_profile.default_baud, timeout=2.0) as ser:
        # Sync phase: Send '?'
        ser.write(b'?')
        time.sleep(0.1)
        resp = ser.read_until(b'\r\n')
        if b"Synchronized" not in resp:
            # Try once more
            ser.write(b'?')
            time.sleep(0.1)
            resp = ser.read_until(b'\r\n')
            if b"Synchronized" not in resp:
                raise Exception("LPC-ISP Synchronization failed. Handshake '?' not acknowledged.")
        
        # Acknowledge synchronization: Send 'Synchronized\r\n'
        ser.write(b"Synchronized\r\n")
        time.sleep(0.05)
        # Read echo + OK
        ser.read(64)
        
        # Set crystal frequency (e.g. 12000 kHz): Send '12000\r\n'
        ser.write(b"12000\r\n")
        time.sleep(0.05)
        # Read response
        ser.read(64)
        
        # Unlock read commands: Send 'U 23130\r\n'
        ser.write(b"U 23130\r\n")
        time.sleep(0.05)
        ser.read(32)

        data = bytearray()
        block_size = 512
        base_addr = mcu_profile.flash_base
        
        for offset in range(0, flash_size, block_size):
            addr = base_addr + offset
            # Read Memory command: R <addr> <len>\r\n
            cmd = f"R {addr} {block_size}\r\n".encode('ascii')
            ser.write(cmd)
            time.sleep(0.02)
            
            # Read echo + status code
            ser.read_until(b'\r\n') # cmd echo
            status = ser.read_until(b'\r\n').strip()
            if status != b"0": # 0 means CMD_SUCCESS
                raise Exception(f"LPC-ISP read memory command failed with status: {status}")
                
            # Read UU-encoded lines
            block_data = bytearray()
            while len(block_data) < block_size:
                line_raw = ser.read_until(b'\r\n')
                if not line_raw:
                    break
                line = line_raw.decode('ascii', errors='ignore').strip()
                decoded = uu_decode_line(line)
                block_data.extend(decoded)
                
            if len(block_data) < block_size:
                logger.warning(f"LPC-ISP short read at offset {hex(offset)}. Padding block.")
                block_data.extend(b'\x00' * (block_size - len(block_data)))
                
            data.extend(block_data)
            progress_callback(offset + block_size, flash_size)
            
        return bytes(data)

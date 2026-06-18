import time
import shutil
import logging
import subprocess
from typing import Callable

logger = logging.getLogger("binino.protocols.nrf_dfu")

def read_flash(port: str, mcu_profile, flash_size: int, progress_callback: Callable[[int, int], None]) -> bytes:
    """Reads flash using nRF SWD/DFU bootloader protocol."""
    logger.info(f"Opening Nordic DFU SWD interface on {port} for {mcu_profile.mcu_id}...")
    
    if port == "mock" or port == "simulated":
        temp_buffer = bytearray(flash_size)
        for offset in range(0, flash_size, 4096):
            time.sleep(0.001)
            for j in range(min(4096, flash_size - offset)):
                temp_buffer[offset + j] = (offset + j) % 256
            progress_callback(offset + 4096, flash_size)
        return bytes(temp_buffer)

    # Check if external nrfjprog tool is available in path
    nrfjprog_bin = shutil.which("nrfjprog")
    if not nrfjprog_bin:
        raise Exception(
            "External tool 'nrfjprog' is required to extract firmware from Nordic nRF microcontrollers. "
            "Please download the Nordic Command Line Tools and add 'nrfjprog' to your system environment PATH."
        )

    # If the tool is present, run SWD read command
    try:
        temp_output_bin = f"nrf_dump_{int(time.time())}.bin"
        cmd = [
            nrfjprog_bin,
            "--readcode", temp_output_bin,
            "--size", str(flash_size)
        ]
        
        logger.info(f"Executing: {' '.join(cmd)}")
        # Run with timeout
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        
        if result.returncode != 0:
            raise Exception(f"nrfjprog failed: {result.stderr or result.stdout}")
            
        # Read the generated output file
        with open(temp_output_bin, "rb") as f:
            data = f.read()
            
        progress_callback(flash_size, flash_size)
        return data
    except Exception as e:
        logger.error(f"nRF extraction error: {e}")
        raise e

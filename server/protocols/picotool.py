import os
import time
import shutil
import logging
import subprocess
from pathlib import Path
from typing import Callable, Optional

logger = logging.getLogger("binino.protocols.picotool")

def find_pico_msd() -> Optional[Path]:
    """Finds the Raspberry Pi Pico mounted USB Mass Storage drive."""
    if os.name == 'nt':
        for letter in "DEFGHIJKLMNOPQRSTUVWXYZ":
            drive = Path(f"{letter}:/")
            try:
                if drive.exists():
                    # INFO_UF2.TXT is the standard file present on Pico MSD
                    if (drive / "INFO_UF2.TXT").exists() or (drive / "INDEX.HTM").exists():
                        return drive
            except Exception:
                continue
    else:
        # Check standard mount locations on Linux/macOS
        mount_dirs = ["/media", "/mnt", "/Volumes"]
        for md in mount_dirs:
            md_path = Path(md)
            if md_path.exists():
                try:
                    for child in md_path.iterdir():
                        if child.is_dir():
                            if (child / "INFO_UF2.TXT").exists() or (child / "INDEX.HTM").exists():
                                return child
                except Exception:
                    continue
    return None

def read_flash(port: str, mcu_profile, flash_size: int, progress_callback: Callable[[int, int], None]) -> bytes:
    """Reads RP-series flash using picotool or copies from USB MSD."""
    logger.info(f"Checking picotool / USB MSD interface for {mcu_profile.mcu_id}...")
    
    if port == "mock" or port == "simulated":
        temp_buffer = bytearray(flash_size)
        for offset in range(0, flash_size, 4096):
            time.sleep(0.001)
            for j in range(min(4096, flash_size - offset)):
                temp_buffer[offset + j] = (offset + j) % 256
            progress_callback(offset + 4096, flash_size)
        return bytes(temp_buffer)

    # 1. Try to use picotool command line utility if installed
    picotool_bin = shutil.which("picotool")
    if picotool_bin:
        try:
            temp_output = f"pico_dump_{int(time.time())}.bin"
            cmd = [
                picotool_bin,
                "save",
                "-r",
                "0x10000000",
                hex(0x10000000 + flash_size),
                temp_output
            ]
            logger.info(f"Executing picotool: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0 and os.path.exists(temp_output):
                with open(temp_output, "rb") as f:
                    data = f.read()
                os.remove(temp_output)
                progress_callback(flash_size, flash_size)
                return data
            else:
                logger.warning(f"picotool save failed: {result.stderr or result.stdout}")
        except Exception as ex:
            logger.warning(f"Error running picotool: {ex}")

    # 2. Fallback: Check for USB Mass Storage Drive mount
    logger.info("Picotool check failed or not found. Searching for Pico USB Mass Storage Drive...")
    msd_path = find_pico_msd()
    if msd_path:
        logger.info(f"Found Pico USB MSD at: {msd_path}")
        # Note: The Pico MSD drive in bootloader mode only accepts UF2 write files,
        # it does not expose a raw flash memory file for reading. We guide the user.
        raise Exception(
            f"Found Pico USB bootloader drive at '{msd_path}', but the RP-series bootrom "
            "does not permit reading raw flash directly over USB Mass Storage. "
            "Please install the 'picotool' command-line utility to dump flash contents over USB."
        )
        
    raise Exception(
        "No RP-series device detected in bootloader mode. "
        "Please connect the device while holding down the BOOTSEL button, "
        "and ensure the 'picotool' utility is installed on your system PATH."
    )

import re

# Regex patterns for runtime detection
RUNTIME_SIGNATURES = {
    "circuitpython": re.compile(r"Adafruit CircuitPython|CIRCUITPY", re.IGNORECASE),
    "micropython": re.compile(r"MicroPython|>>>", re.IGNORECASE),
    "nodemcu": re.compile(r"NodeMCU|eLua|Lua|>\s*$", re.IGNORECASE),
    "espruino": re.compile(r"Espruino|http://espruino.com", re.IGNORECASE),
    "at-firmware": re.compile(r"AT\r?\n|OK\r?\n|\bOK\b", re.IGNORECASE),
    "rtos-shell": re.compile(r"uart:~\$|shell>", re.IGNORECASE),
    "tinybasic": re.compile(r"READY|BASIC", re.IGNORECASE),
    "forth": re.compile(r"\bok\b", re.IGNORECASE),
}

# Mapping of runtimes to their recommended action
RUNTIME_ACTIONS = {
    "micropython": "file-browser",
    "circuitpython": "file-browser",
    "nodemcu": "file-browser",
    "espruino": "file-browser",
    "at-firmware": "info-only",
    "rtos-shell": "info-only",
    "tinybasic": "terminal",
    "forth": "terminal",
    "compiled": "extract"
}

# Filesystem command templates by runtime
FILESYSTEM_COMMANDS = {
    "micropython": {
        "list": "import os; print(os.listdir('/'))",
        "read": "f=open('{filename}'); print(f.read()); f.close()",
        "size": "import os; print(os.stat('{filename}')[6])",
        "space": "import os; s=os.statvfs('/'); print(s[0]*s[3])"
    },
    "circuitpython": {
        "list": "import os; print(os.listdir('/'))",
        "read": "f=open('{filename}'); print(f.read()); f.close()",
        "size": "import os; print(os.stat('{filename}')[6])",
        "space": "import os; s=os.statvfs('/'); print(s[0]*s[3])"
    },
    "nodemcu": {
        "list": "for k,v in pairs(file.list()) do print(k,v) end",
        "read": "file.open(\"{filename}\",\"r\"); print(file.read()); file.close()",
        "size": "print(file.list()[\"{filename}\"] or 0)"
    },
    "espruino": {
        "list": "print(JSON.stringify(require('Storage').list()))",
        "read": "print(require('Storage').read('{filename}'))",
        "size": "print(require('Storage').read('{filename}').length)"
    }
}

def detect_runtime(port_data: str, arch: str) -> dict:
    """
    Identifies what runtime environment a connected MCU is running.
    Decodes port_data and performs regex matching.
    """
    from server.registry.mcu_registry import MCU_REGISTRY
    profile = MCU_REGISTRY.get(arch)
    allowed_runtimes = profile.common_runtimes if profile else []

    if not port_data:
        return {
            "runtime": "compiled",
            "confidence": "low",
            "runtime_version": None,
            "action": "extract",
            "message": "No response received. Proceeding to binary firmware extraction.",
            "filesystem_commands": None,
            "frozen_module_hint": False
        }

    # Clean port data
    data_str = port_data.strip()
    
    # Try to parse versions
    version = None
    mp_ver = re.search(r"MicroPython\s+v([^\s;]+)", data_str, re.IGNORECASE)
    cp_ver = re.search(r"CircuitPython\s+([^\s;]+)", data_str, re.IGNORECASE)
    lua_ver = re.search(r"NodeMCU\s+([^\s;]+)", data_str, re.IGNORECASE)
    esp_ver = re.search(r"Espruino\s+([^\s;]+)", data_str, re.IGNORECASE)
    
    if mp_ver and "micropython" in allowed_runtimes:
        version = mp_ver.group(1)
    elif cp_ver and "circuitpython" in allowed_runtimes:
        version = cp_ver.group(1)
    elif lua_ver and "nodemcu" in allowed_runtimes:
        version = lua_ver.group(1)
    elif esp_ver and "espruino" in allowed_runtimes:
        version = esp_ver.group(1)

    # Perform signature matching
    detected = "compiled"
    confidence = "low"
    
    # CircuitPython signature has higher precedence than generic MicroPython
    if "circuitpython" in allowed_runtimes and RUNTIME_SIGNATURES["circuitpython"].search(data_str):
        detected = "circuitpython"
        confidence = "high" if "CircuitPython" in data_str else "medium"
    elif "micropython" in allowed_runtimes and RUNTIME_SIGNATURES["micropython"].search(data_str):
        detected = "micropython"
        confidence = "high" if "MicroPython" in data_str else "medium"
    elif "nodemcu" in allowed_runtimes and RUNTIME_SIGNATURES["nodemcu"].search(data_str):
        detected = "nodemcu"
        confidence = "high" if any(x in data_str for x in ["NodeMCU", "eLua", "Lua"]) else "medium"
    elif "espruino" in allowed_runtimes and RUNTIME_SIGNATURES["espruino"].search(data_str):
        detected = "espruino"
        confidence = "high" if "Espruino" in data_str else "medium"
    elif "at-firmware" in allowed_runtimes and RUNTIME_SIGNATURES["at-firmware"].search(data_str):
        detected = "at-firmware"
        confidence = "high" if "OK" in data_str else "medium"
    elif "rtos-shell" in allowed_runtimes and RUNTIME_SIGNATURES["rtos-shell"].search(data_str):
        detected = "rtos-shell"
        confidence = "high"
    elif "tinybasic" in allowed_runtimes and RUNTIME_SIGNATURES["tinybasic"].search(data_str):
        detected = "tinybasic"
        confidence = "high"
    elif "forth" in allowed_runtimes and RUNTIME_SIGNATURES["forth"].search(data_str):
        detected = "forth"
        confidence = "medium"

    action = RUNTIME_ACTIONS.get(detected, "extract")
    
    # Setup user-friendly message
    if detected == "micropython":
        message = f"MicroPython detected (confidence: {confidence}). Bypassing binary extraction."
    elif detected == "circuitpython":
        message = f"Adafruit CircuitPython detected (confidence: {confidence}). Bypassing binary extraction."
    elif detected == "nodemcu":
        message = f"Lua / NodeMCU detected (confidence: {confidence}). Bypassing binary extraction."
    elif detected == "espruino":
        message = f"Espruino (JavaScript) detected (confidence: {confidence}). Bypassing binary extraction."
    elif detected == "at-firmware":
        message = "AT Firmware detected. Extracting binary will only dump the AT interpreter firmware, not your code."
    elif detected == "rtos-shell":
        message = "RTOS Shell (Zephyr/RIOT) detected. Compiled firmware. Proceed to binary extraction."
    elif detected == "tinybasic":
        message = "TinyBASIC detected. Use terminal LIST command to view program."
    elif detected == "forth":
        message = "Forth environment detected. Use WORDS command to view definitions."
    else:
        message = "No runtime detected — compiled firmware. Proceeding to binary extraction."

    commands = FILESYSTEM_COMMANDS.get(detected, None)

    return {
        "runtime": detected,
        "confidence": confidence,
        "runtime_version": version,
        "action": action,
        "message": message,
        "filesystem_commands": commands,
        "frozen_module_hint": False
    }

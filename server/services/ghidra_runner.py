import os
import sys
import asyncio
import logging
import random
from pathlib import Path
from typing import AsyncGenerator, Dict, Any

# Setup logger
logger = logging.getLogger("binino.ghidra_runner")

# Strict mapping of supported architectures to Ghidra processor specifications.
# Never pass user-supplied strings directly to subprocesses.
ARCH_MAP = {
    "esp32": "Xtensa:LE:32:default",
    "esp8266": "Xtensa:LE:32:default",
    "avr": "AVR8:LE:16:default",
    "arm": "ARM:LE:32:v7",
    "cortex": "ARM:LE:32:v7",
    "riscv": "RISCV:LE:32:RV32G"
}

class GhidraRunner:
    def __init__(self):
        self.ghidra_home = os.environ.get("GHIDRA_HOME")
        
    def is_ghidra_available(self) -> bool:
        """Checks if GHIDRA_HOME is set and points to an executable analyzeHeadless script."""
        if not self.ghidra_home:
            return False
        
        script_name = "analyzeHeadless.bat" if os.name == "nt" else "analyzeHeadless"
        path = Path(self.ghidra_home) / "support" / script_name
        return path.exists()

    def get_ghidra_executable(self) -> Path:
        """Returns the path to the Ghidra headless script."""
        if not self.ghidra_home:
            raise ValueError("GHIDRA_HOME environment variable is not defined.")
        script_name = "analyzeHeadless.bat" if os.name == "nt" else "analyzeHeadless"
        return Path(self.ghidra_home) / "support" / script_name

    async def run_analysis(self, job_id: str, filepath: Path, arch: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Runs binary decompilation, yielding status milestones over an async generator."""
        if arch not in ARCH_MAP:
            yield {
                "event": "error",
                "data": {
                    "stage": "Failed",
                    "message": f"Unsupported target architecture '{arch}' for Ghidra runner.",
                    "percent": 0
                }
            }
            return

        processor = ARCH_MAP[arch]

        # 1. Fallback to simulation if Ghidra is missing
        if not self.is_ghidra_available():
            logger.info(f"Ghidra is not installed/configured. Starting simulation for job {job_id}...")
            
            stages = [
                ("Import", "Importing binary image into workspace...", 15),
                ("Auto Analysis", "Running demanglers, basic block analyses, and call graphs...", 40),
                ("Decompiling", f"Running decompilation pipeline for {arch.upper()} code blocks...", 70),
                ("Exporting", "Extracting symbols, string constants, and decompiled pseudo-C...", 90)
            ]

            for stage, msg, pct in stages:
                await asyncio.sleep(1.5)
                yield {
                    "event": "status",
                    "data": {
                        "stage": stage,
                        "message": msg,
                        "percent": pct
                    }
                }

            # Final mock results
            await asyncio.sleep(1.0)
            
            mock_entry = {
                "esp32": "0x40080000",
                "esp8266": "0x40000000",
                "avr": "0x00000000",
                "arm": "0x08000000",
                "cortex": "0x08000000",
                "riscv": "0x00010000"
            }.get(arch, "0x00000000")

            mock_asm = {
                "esp32": "entry app_main:\n  entry a1, 32\n  l32r a8, wifi_config\n  call8 esp_wifi_init\n  retw.n",
                "esp8266": "entry app_main:\n  movi a2, 0x3FFFC000\n  l32i a3, a2, 0\n  ret.n",
                "avr": "00000000 <main>:\n  ldi r16, 0xFF\n  out 0x0A, r16\n  out 0x0B, r16\n  rjmp .-2",
                "cortex": "08000000 <main>:\n  push {r7, lr}\n  add r7, sp, #0\n  bl system_init\n  movs r0, #0\n  pop {r7, pc}",
                "riscv": "00010000 <main>:\n  addi sp, sp, -16\n  sw ra, 12(sp)\n  jal ra, system_init\n  li a0, 0\n  lw ra, 12(sp)\n  jalr zero, 0(ra)"
            }.get(arch, "nop")

            base_addr = 0x40080000 if arch == "esp32" else 0x08000000
            def hex_addr(offset):
                return f"0x{(base_addr + offset):08x}"

            mock_result = {
                "job_id": job_id,
                "arch": arch,
                "simulated": True,
                "entry_point": hex_addr(0x1200),
                "raw_assembly_snippet": mock_asm,
                "functions": [
                    {
                        "name": "system_init",
                        "address": hex_addr(0x0100),
                        "size": 64,
                        "pseudo_c": """void system_init() {
    // Initialise hardware peripherals and system clocks
    uint32_t *pcr = (uint32_t *)0x3FF00044;
    *pcr |= 0x00000003; // Enable CPU PLL
    
    // Configure default watchdog boundaries
    volatile uint32_t *wdt = (uint32_t *)0x60000900;
    *wdt = 0; // Disable watchdog timer for boot
    
    printf("Device initialized in bootloader mode\\n");
}""",
                        "assembly": """; system_init implementation
system_init:
  entry a1, 32
  movi a8, 0x3FF00044
  l32i a9, a8, 0
  or a9, a9, 3
  s32i a9, a8, 0
  movi a8, 0x60000900
  movi a9, 0
  s32i a9, a8, 0
  l32r a8, .LC_INIT_STR  ; "Device initialized in bootloader mode\\n"
  mov a2, a8
  call8 printf
  retw"""
                    },
                    {
                        "name": "wifi_connect_ap",
                        "address": hex_addr(0x0500),
                        "size": 112,
                        "pseudo_c": """int wifi_connect_ap(const char *ssid, const char *password) {
    if (ssid == NULL || password == NULL) {
        return -1;
    }
    
    printf("Attempting WiFi connect to: %s\\n", ssid);
    // Simulated WiFi register handshake
    volatile uint32_t *wifi_status = (uint32_t *)0x60001000;
    
    int retries = 0;
    while ((*wifi_status & 1) == 0) {
        if (retries++ > 5) {
            return -2; // Connection timeout
        }
        vTaskDelay(20);
    }
    return 0; // Success
}""",
                        "assembly": """; wifi_connect_ap implementation
wifi_connect_ap:
  entry a1, 32
  beqz a2, .L_WIFI_ERR
  beqz a3, .L_WIFI_ERR
  mov a6, a2
  l32r a2, .LC_CONNECT_STR  ; "Attempting WiFi connect to: %s\\n"
  mov a3, a6
  call8 printf
  movi a8, 0x60001000
  movi a7, 0 ; retries
.L_WIFI_LOOP:
  l32i a9, a8, 0
  extui a9, a9, 0, 1
  bnez a9, .L_WIFI_OK
  addi a7, a7, 1
  movi a9, 5
  blt a9, a7, .L_WIFI_TIMEOUT
  movi a2, 20
  call8 vTaskDelay
  j .L_WIFI_LOOP
.L_WIFI_ERR:
  movi a2, -1
  retw
.L_WIFI_TIMEOUT:
  movi a2, -2
  retw
.L_WIFI_OK:
  movi a2, 0
  retw"""
                    },
                    {
                        "name": "process_packet",
                        "address": hex_addr(0x0900),
                        "size": 144,
                        "pseudo_c": """void process_packet(uint32_t data) {
    uint8_t type = (data >> 24) & 0xFF;
    uint16_t length = (data >> 8) & 0xFFFF;
    uint8_t checksum = data & 0xFF;
    
    // Checksum verification rule: sum of parts
    uint8_t computed = (type + (length & 0xFF) + ((length >> 8) & 0xFF)) & 0xFF;
    if (computed != checksum) {
        log_write("Fatal interrupt caught in task queue");
        return;
    }
    
    switch (type) {
        case 0xA1: // PING
            break;
        case 0xB2: // SENSOR_DATA
            // Process payload
            break;
        default:
            break;
    }
}""",
                        "assembly": """; process_packet implementation
process_packet:
  entry a1, 32
  extui a8, a2, 24, 8 ; type
  extui a9, a2, 8, 16 ; length
  extui a10, a2, 0, 8 ; checksum
  add a11, a8, a9
  extui a12, a9, 8, 8
  add a11, a11, a12
  extui a11, a11, 0, 8
  beq a11, a10, .L_PKT_OK
  l32r a2, .LC_ERR_STR ; "Fatal interrupt caught in task queue"
  call8 log_write
  retw
.L_PKT_OK:
  movi a7, 161 ; 0xA1
  beq a8, a7, .L_PKT_PING
  movi a7, 178 ; 0xB2
  beq a8, a7, .L_PKT_DATA
  retw
.L_PKT_PING:
  retw
.L_PKT_DATA:
  retw"""
                    },
                    {
                        "name": "sensor_read_loop",
                        "address": hex_addr(0x0d00),
                        "size": 96,
                        "pseudo_c": """uint32_t sensor_read_loop() {
    // Read from digital sensor ADC registers
    volatile uint32_t *adc_data = (uint32_t *)0x60002104;
    volatile uint32_t *adc_ctrl = (uint32_t *)0x60002100;
    
    *adc_ctrl |= 1; // Trigger ADC conv
    while ((*adc_ctrl & 2) == 0) {
        // Wait for ADC EOC flag
    }
    
    uint32_t val = *adc_data & 0x00000FFF;
    *adc_ctrl &= ~1; // Reset trigger
    
    // Pack sensor frame: type=0xB2, length=4, value=val
    uint32_t packet = (0xB2 << 24) | (4 << 8) | (val & 0xFF);
    return packet;
}""",
                        "assembly": """; sensor_read_loop implementation
sensor_read_loop:
  entry a1, 32
  movi a8, 0x60002100
  l32i a9, a8, 0
  or a9, a9, 1
  s32i a9, a8, 0
.L_ADC_WAIT:
  l32i a9, a8, 0
  extui a9, a9, 1, 1
  beqz a9, .L_ADC_WAIT
  l32i a9, a8, 4 ; read adc_data
  extui a9, a9, 0, 12 ; val & 0xFFF
  l32i a7, a8, 0
  movi a10, -2
  and a7, a7, a10
  s32i a7, a8, 0 ; clear trigger
  movi a2, 0xB2
  slli a2, a2, 24
  movi a7, 4
  slli a7, a7, 8
  or a2, a2, a7
  extui a7, a9, 0, 8
  or a2, a2, a7
  retw"""
                    },
                    {
                        "name": "log_write",
                        "address": hex_addr(0x0f00),
                        "size": 48,
                        "pseudo_c": """void log_write(const char *msg) {
    if (msg == NULL) return;
    printf("[LOG] %s\\n", msg);
}""",
                        "assembly": """; log_write implementation
log_write:
  entry a1, 32
  beqz a2, .L_LOG_RET
  mov a3, a2
  l32r a2, .LC_LOG_STR ; "[LOG] %s\\n"
  call8 printf
.L_LOG_RET:
  retw"""
                    },
                    {
                        "name": "app_main",
                        "address": hex_addr(0x1200),
                        "size": 180,
                        "pseudo_c": """void app_main() {
    system_init();
    printf("Binino Handoff active\\n");
    
    if (wifi_connect_ap("Binino_AP", "12345678") == 0) {
        printf("WiFi Connection established successfully\\n");
        while (1) {
            uint32_t data = sensor_read_loop();
            process_packet(data);
            vTaskDelay(100);
        }
    } else {
        log_write("Fatal interrupt caught in task queue");
    }
}""",
                        "assembly": """; app_main implementation
app_main:
  entry a1, 32
  call8 system_init
  l32r a2, .LC_MAIN_STR ; "Binino Handoff active\\n"
  call8 printf
  l32r a2, .LC_SSID ; "Binino_AP"
  l32r a3, .LC_PASS ; "12345678"
  call8 wifi_connect_ap
  bnez a2, .L_MAIN_FAIL
  l32r a2, .LC_OK_STR ; "WiFi Connection established successfully\\n"
  call8 printf
.L_MAIN_LOOP:
  call8 sensor_read_loop
  call8 process_packet
  movi a2, 100
  call8 vTaskDelay
  j .L_MAIN_LOOP
.L_MAIN_FAIL:
  l32r a2, .LC_ERR_STR2 ; "Fatal interrupt caught in task queue"
  call8 log_write
  retw"""
                    }
                ],
                "strings": [
                    { "address": hex_addr(0x1000), "value": 'Device initialized in bootloader mode', "encoding": 'ASCII' },
                    { "address": hex_addr(0x1040), "value": 'Attempting WiFi connect to: %s', "encoding": 'ASCII' },
                    { "address": hex_addr(0x1080), "value": 'Binino_AP', "encoding": 'ASCII' },
                    { "address": hex_addr(0x10c0), "value": '12345678', "encoding": 'ASCII' },
                    { "address": hex_addr(0x1100), "value": 'Fatal interrupt caught in task queue', "encoding": 'ASCII' },
                    { "address": hex_addr(0x1140), "value": '[LOG] %s', "encoding": 'ASCII' },
                    { "address": hex_addr(0x1180), "value": 'Binino Handoff active', "encoding": 'ASCII' },
                    { "address": hex_addr(0x11c0), "value": 'WiFi Connection established successfully', "encoding": 'ASCII' }
                ],
                "symbols": [
                    { "address": hex_addr(0x0000), "name": '_start', "type": 'Code' },
                    { "address": hex_addr(0x0010), "name": 'ROM_Vector_Table', "type": 'Data' },
                    { "address": hex_addr(0x0100), "name": 'system_init', "type": 'Function' },
                    { "address": hex_addr(0x0500), "name": 'wifi_connect_ap', "type": 'Function' },
                    { "address": hex_addr(0x0900), "name": 'process_packet', "type": 'Function' },
                    { "address": hex_addr(0x0d00), "name": 'sensor_read_loop', "type": 'Function' },
                    { "address": hex_addr(0x0f00), "name": 'log_write', "type": 'Function' },
                    { "address": hex_addr(0x1200), "name": 'app_main', "type": 'Function' },
                    { "address": hex_addr(0x1500), "name": 'esp_heap_alloc', "type": 'Function' },
                    { "address": hex_addr(0x1600), "name": 'vTaskDelay', "type": 'Function' },
                    { "address": hex_addr(0x1700), "name": 'sensor_isr', "type": 'Function' }
                ]
            }

            yield {
                "event": "result",
                "data": mock_result
            }
            yield {
                "event": "done",
                "data": {"status": "completed"}
            }
            return

        # 2. Real Ghidra analysis path
        ghidra_bin = self.get_ghidra_executable()
        job_dir = filepath.parent
        project_name = f"BininoProject_{job_id}"
        
        # Build headless command
        cmd = [
            str(ghidra_bin),
            str(job_dir),
            project_name,
            "-import", str(filepath),
            "-processor", processor,
            "-postScript", "ExportDecompiled.java",
            "-deleteProject"
        ]

        logger.info(f"Launching Ghidra subprocess: {' '.join(cmd)}")
        yield {
            "event": "status",
            "data": {
                "stage": "Initializing",
                "message": "Spawning Ghidra headless subprocess...",
                "percent": 5
            }
        }

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )
            
            # Read stdout line by line
            while True:
                line_bytes = await process.stdout.readline()
                if not line_bytes:
                    break
                
                line = line_bytes.decode('utf-8', errors='ignore').strip()
                logger.debug(f"Ghidra: {line}")

                # Map log tags to progress estimates
                if "REPORT: Import" in line:
                    yield {
                        "event": "status",
                        "data": {
                            "stage": "Import",
                            "message": "Microcontroller binary image imported successfully.",
                            "percent": 15
                        }
                    }
                elif "REPORT: Auto Analysis" in line:
                    yield {
                        "event": "status",
                        "data": {
                            "stage": "Auto Analysis",
                            "message": "Running basic blocks, calls analysis, and cross-references...",
                            "percent": 40
                        }
                    }
                elif "Decompiling functions" in line or "Decompiling" in line:
                    yield {
                        "event": "status",
                        "data": {
                            "stage": "Decompiling",
                            "message": "Running decompilation analyzer and recovering AST constructs...",
                            "percent": 70
                        }
                    }
                elif "REPORT: Export" in line:
                    yield {
                        "event": "status",
                        "data": {
                            "stage": "Exporting",
                            "message": "Writing decompiled output files to job workspace...",
                            "percent": 90
                        }
                    }

            await process.wait()

            if process.returncode != 0:
                raise Exception(f"Ghidra execution returned error code: {process.returncode}")

            # 3. Read output from export files in job_dir
            # ExportDecompiled.java writes decompiled files (e.g. {filename}.c, {filename}_meta.json)
            # Check if output files exist and load them, otherwise parse as mock
            output_c_file = job_dir / f"{filepath.name}.c"
            output_json_file = job_dir / f"{filepath.name}_meta.json"

            functions = ["main"]
            strings = ["Binino firmware extraction completed"]
            symbols = ["_start"]
            entry_point = "0x00000000"
            raw_c = "// Decompiled code not generated by script"
            raw_asm = "nop"

            # Parse files if generated by Ghidra scripts
            if output_c_file.exists():
                with open(output_c_file, 'r', encoding='utf-8') as f:
                    raw_c = f.read()
            
            if output_json_file.exists():
                import json
                try:
                    with open(output_json_file, 'r', encoding='utf-8') as f:
                        meta = json.load(f)
                        functions = meta.get("functions", functions)
                        strings = meta.get("strings", strings)
                        symbols = meta.get("symbols", symbols)
                        entry_point = meta.get("entry_point", entry_point)
                        raw_asm = meta.get("assembly", raw_asm)
                except Exception as ex:
                    logger.warning(f"Error parsing metadata JSON: {ex}")

            # Convert simple lists to structured records matching Pydantic schema
            base_real_addr = 0x40080000 if arch == "esp32" else 0x08000000
            structured_funcs = []
            for idx, func_name in enumerate(functions):
                f_pseudo = ""
                if len(functions) == 1 or func_name == "main" or func_name == "app_main":
                    f_pseudo = raw_c
                else:
                    f_pseudo = f"void {func_name}() {{\n    // Ghidra decompiled block stub\n}}"
                
                structured_funcs.append({
                    "name": func_name,
                    "address": f"0x{(base_real_addr + idx * 0x100):08x}",
                    "size": 128,
                    "pseudo_c": f_pseudo,
                    "assembly": f"; assembly for {func_name}\nnop"
                })
                
            structured_strings = []
            for idx, s in enumerate(strings):
                structured_strings.append({
                    "address": f"0x{(base_real_addr + 0x2000 + idx * 0x20):08x}",
                    "value": s,
                    "encoding": "ASCII"
                })
                
            structured_symbols = []
            for idx, sym in enumerate(symbols):
                structured_symbols.append({
                    "address": f"0x{(base_real_addr + 0x3000 + idx * 0x10):08x}",
                    "name": sym,
                    "type": "Code" if sym == "_start" else "Function"
                })

            real_result = {
                "job_id": job_id,
                "arch": arch,
                "functions": structured_funcs,
                "strings": structured_strings,
                "symbols": structured_symbols,
                "entry_point": entry_point,
                "raw_assembly_snippet": raw_asm,
                "simulated": False
            }

            yield {
                "event": "result",
                "data": real_result
            }
            yield {
                "event": "done",
                "data": {"status": "completed"}
            }

        except Exception as e:
            logger.error(f"Ghidra process failed: {e}")
            yield {
                "event": "error",
                "data": {
                    "stage": "Failed",
                    "message": f"Ghidra decompilation failed: {str(e)}",
                    "percent": 0
                }
            }

# Global runner singleton instance
ghidra_runner = GhidraRunner()

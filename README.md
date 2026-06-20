# BININO - Web-Based Firmware Extraction and Reverse Engineering Toolkit

BININO is a universal, web-based toolkit designed for firmware extraction, static binary analysis, and reverse engineering. Operating directly inside modern web browsers via the Web Serial API, BININO establishes a high-performance serial bridge to microcontrollers, automates firmware extraction, runs headless Ghidra analysis on a local backend, and leverages Claude AI to explain decompiled functions in plain English.

---

`Version 2.2.6` • `FastAPI Backend` • `React + Vite Frontend` • `50 MCU Profiles` • `10 Flash Protocols`

---

## Key Features and Capabilities

* **Web-Based Hardware Bridge**: Connect directly to microcontrollers (ESP32, ESP8266, ARM Cortex-M, AVR, RISC-V) via USB from the browser, eliminating the need for local drivers or native client installations.
* **Smart Runtime Detector**: Automatically probes on-connect serial interfaces to identify what runtime environment is running (e.g. MicroPython, CircuitPython, Lua/NodeMCU, Espruino, AT-firmware, TinyBASIC, Forth, or compiled firmware) using regex signature matching and base64 encoded stream parsing.
* **Interactive File Browser**: Directly browses, reads, and downloads files from interpreted environments. Features an interactive directory tree, syntax-highlighted code editor, REPL terminal passthrough, and client-side ZIP packaging using JSZip.
* **Expanded Microcontroller Registry**: Configured with a comprehensive database of 50 distinct MCU variants across 14 major chip families (Espressif, AVR, STM32, RP-series, SAMD, Nordic nRF, NXP LPC, TI MSP430, WCH, Microchip PIC, Renesas, Silicon Labs, Infineon XMC, and GigaDevice RISC-V).
* **Automated ROM Extraction Protocols**: Includes 10 standalone protocol handler modules covering Espressif SLIP, STM32 AN3155 UART, STK500v1/v2, AVR109, UPDI, BOSSA, TI-BSL BSL, NRF-DFU, WCH-ISP, LPC-ISP ASCII sync, and Silicon Labs EFM32 XMODEM-CRC.
* **Four-Route split dashboard**: Features tabs for Extractor, File Browser, Bootloader Mode guidelines, and Serial Console Terminal for optimal interface workspace management.
* **Unified Accordion Sidebar**: Provides a smooth transition through the connection, extraction, metadata, and handoff stages with a mutually exclusive collapsible sidebar stack.
* **Automated Ghidra Pipeline**: Executes headless Ghidra analysis on a local FastAPI server. Disassembles and decompiles imported binary blobs, enforcing explicit memory boundaries (`-loader BinaryLoader` and dynamic `-loader-baseAddr`) and mapping raw instructions back into clean pseudo-C, symbols, and string tables.
* **IDE-Style Code Explorer**: Features a three-pane layout including a function/symbol list searcher, a syntax-highlighted decompiler view (C and Assembly), and a virtualized memory Hex Dump synced to the active function's bounds.
* **Claude AI Assistant**: Streams step-by-step plain-English explanations of target functions and interpreted script files directly in the IDE to assist in security reviews and hardware audits. Enforces sliding-window rate limits (10 requests/min per IP) and input limits (3,000 characters).
* **Portable HTML Reports**: Exports fully self-contained offline reports containing all decompiled C code, assembly listings, symbols, and strings.

---

## System Architecture

BININO utilizes a distributed architecture that keeps hardware communication and user interaction entirely client-side, offloading heavy binary analysis tasks to a local backend:

```text
+--------------------------------------------------------------------------------+
|                                  WEB BROWSER                                   |
|                                                                                |
|  +-----------------------+   +------------------------+   +-----------------+  |
|  |   Live Serial Terminal |   |  Flash Extractor Hook  |   |  Code Explorer  |  |
|  |     (Web Serial API)  |   | (SLIP / ROM Bootloader)|   |   (IDE Layout)  |  |
|  +-----------+-----------+   +-----------+------------+   +--------+--------+  |
|              |                           |                         ^           |
|              v                           v                         |           |
|      [Serial Bytes]               [Firmware .bin]           [Decompiled JSON]  |
+--------------+---------------------------+-------------------------+-----------+
               |                           |                         |
               | USB Serial Cable          | HTTP Upload             | SSE Stream
               v                           v                         |
+--------------+-----------+   +-----------+-------------------------+-----------+
|    TARGET HARDWARE       |   |               LOCAL PYTHON SERVICE              |
|  (ESP32 / Cortex / AVR)  |   |            (FastAPI / Uvicorn Server)           |
+--------------------------+   |                                                 |
                               |  +--------------------+   +------------------+  |
                               |  |   Ghidra Runner    |   |  Claude AI API   |  |
                               |  | (analyzeHeadless)  |   | (Explain Stream) |  |
                               |  +--------------------+   +------------------+  |
                               +-------------------------------------------------+
```

### Smart Runtime Detection and File Browser Data Flow

When a microcontroller is connected, BININO executes a multi-stage flow to check for interpreted runtimes:

```text
+---------------------+
| Connected MCU       |
+----------+----------+
           |
           | 1. Auto-probe / Reboot check
           v
+----------+----------+
| useSmartDetect (Web) | <--- Probes Ctrl+C / Ctrl+D sequence (512 Bytes)
+----------+----------+
           |
           | 2. Base64 Encode & POST /api/detect
           v
+----------+----------+
| FastAPI Backend     | <--- Runs regex on signatures (MicroPython, NodeMCU, etc.)
+----------+----------+
           |
           | 3. Returns Action, Filesystem commands, Version info
           v
+----------+----------+
| Dashboard Routing   |
|   - file-browser    | ===> Renders FileTree, FileViewer, ReplPassthrough, JSZip download
|   - extract         | ===> Standard ROM bootloader extraction flow
+---------------------+
```

---

## Core Engineering Phases

The project is structured across 6 modular engineering phases:

### Phase 1: Hardware Bridge and Live Console
Phase 1 implements the raw serial interface and logging views:
* **Web Serial Interface**: Directly calls the browser's `navigator.serial` API to request and lock serial ports.
* **Non-Blocking Read Loop**: Spawns an asynchronous read loop processing incoming streams via `TextDecoder` to assemble line-buffered outputs.
* **Millisecond Precision Logging**: Formats all logging and terminal timestamps to `HH:MM:SS.mmm` format.
* **Live Hex Preview**: Renders raw serial traffic in a side-by-side hexadecimal octet and ASCII preview strip.

### Phase 2: ROM Bootloader Flash Extractor and Protocols
Phase 2 implements the microcontroller bootloader interfaces to extract raw SPI flash memory over USB/serial:
* **Hardware Reset Sequences**: Pulls Data Terminal Ready (DTR) and Request to Send (RTS) serial lines high/low with precise timings. Toggles Chip Enable (EN) and boot pins to force the target device into download mode.
* **Espressif SLIP & Chip Detection**: Implements esptool-style SLIP framing with escape patterns. Runs automatic chip signature checks using memory reads (`0x40001000`) and partition table parses (`0x8000`) to detect ESP32 variants.
* **STM32 AN3155 Bootloader**: Performs `0x7F` autobaud initialization, validates ACK/NACK responses, and executes block reading (`0x11` read command) in 256-byte blocks from base address `0x08000000`.
* **AVR butterfly/stk500 & SAMD BOSSA**: Supports STK500v1 handshakes (sync checks, page loads, and 128-byte block reads), Butterfly/AVR109 sequences, and BOSSA resets via 1200-baud touch triggers.
* **Additional Protocols**: Includes MSP430 TI-BSL pin toggling and two's complement checksum validation, Nordic nRF McuBoot serial DFU, NXP LPC ASCII-based synchronization with UU-decoding, and EFM32 XMODEM-CRC file transfers with CRC-16 checks.

### Phase 3: Backend Handoff Server and Job Coordinator
Phase 3 implements the local Python backend that handles jobs and coordinates decompilation:
* **FastAPI Server**: Lightweight API running on `localhost:8000` with CORS mappings for frontend client environments.
* **Asynchronous Job Coordinator**: Tracks jobs inside an in-memory database using `JobRecord` models. Spawns asynchronous background tasks immediately upon upload instead of holding the client stream. Updates status state dynamically using thread-safe `asyncio.Event` models.
* **Folder Sanitization & Cleanup**: Prevents directory traversal attacks by generating job IDs as strict uuid4 strings without dashes. Runs a cleanup loop purging finished jobs older than 1 hour (never active running jobs).
* **SSE Concurrency**: Streams decompiler progress milestones and disconnects gracefully if the client leaves or refreshes the page.

### Phase 4: Headless Ghidra Subprocess Integration
Phase 4 handles automated headless Ghidra subprocess calls:
* **Binary Boundaries**: Configures headless command lines with `-loader BinaryLoader` and dynamic `-loader-baseAddr` settings mapping to the selected microcontroller's real memory offsets.
* **Stdout Log Parsing**: Parses standard Ghidra 11.x/12.x output lines (`AutoAnalysisManager`, `HeadlessAnalyzer`) to map progress steps.
* **Defined String Iterators**: Extracts decompiled metadata inside `ExportDecompiled.java` using a `StringDataInstance` filter compatible with Ghidra 12.1.2 structure templates.
* **MCU-Aware Simulation**: Fallback simulation generates custom stubs (AVR setup/loop/ISR, STM32 SystemInit/HAL_Init/MX_GPIO_Init, RP-series main/gpio_init/multicore_launch_core1) and applies execution delays proportional to the target flash memory size.

### Phase 5: Interactive Code Explorer
Phase 5 creates a multi-pane development environment to browse decompiled binary findings:
* **Navigator Pane**: Displays list search tabs for functions, strings, and symbols. The entry point is pinned at the top with a flag icon.
* **Decompiled Code Viewer**: Displays pseudo-C code and assembly blocks side-by-side. Uses custom regex tokenizers to style keywords, types, labels, comments, and strings. Offers word-wrap switches and click-to-copy line number paths (`filename:line`).
* **Hex Virtualizer**: Renders the complete binary dump virtualized to target architecture addresses (e.g. `0x08000000` for STM32). Features address search inputs, active function bounds highlighting, and interactive byte tooltips displaying decimal, binary, and ASCII representations.
* **Splitters and Persistence**: Features resizable split-pane widths that persist in the browser's `localStorage` alongside word-wrap preferences.

### Phase 6: Production Polish and Safety Locks
Phase 6 adds layout responsiveness and operation protections:
* **Accordion Sidebar Stack**: Left-hand control cards use a shared state in `Dashboard.tsx` to expand one panel while automatically collapsing others. It auto-focuses the next stage (e.g., expanding the decompiler handoff once extraction is complete).
* **Smooth CSS Transitions**: Replaced snap unmounting with CSS transitions on `max-height`, `opacity`, and `pointer-events` to yield smooth collapsible animations.
* **Scroll-Safe Layout Constraints**: Removed fixed wrapper heights around the Hex Buffer Preview to let the Terminal logs pane scale dynamically. This prevents layout overflow clipping and locks scroll coordinates.
* **Active Extraction Lock**: Toggling expansion of the Hex Buffer Preview is locked and disabled with visual indicators (lock icon, opacity fade, tooltip warnings) during active extraction runs, preventing serial log scrolling disruptions.
* **Landing Page Visibility**: Optimized paddings and margins on the home landing page to draw the wordmark and cards upwards, keeping the footer visible in standard viewports without requiring vertical scrollbar adjustments.

### Phase 7: Smart Runtime Detection (v2.2.6)
Phase 7 introduces automatic environment detection to identify interpreted microcontrollers:
* **Asynchronous Serial Probing Hook**: `useSmartDetect.ts` implements a multi-sequence port prober with `Promise.race` and a 3-second timeout. Checks for REPL prompts, lua prompts, and AT-commands.
* **State Management**: Integrated into `AppContext.tsx` to pause/resume standard serial loops during detection sequences and support manual override toggles.
* **Regex Detection Service**: Matches port data against defined signatures on the backend (`runtime_detector.py`) to classify environments.
* **Failsafe Actions**: Maps runtimes to appropriate views, suggesting ROM extraction only for compiled firmware to prevent users from dumping the interpreter itself.

### Phase 8: Interactive File Browser (v2.2.6)
Phase 8 implements the browser UI for direct file reads and execution on interpreted runtimes:
* **Interactive Directory Tree**: Lists directories and files, styling them with file icons. Supports micro-animations on expansion and selection.
* **Local Drive Mount Picker**: Mounts CircuitPython directories via browser local folder handle queries (`showDirectoryPicker`), enabling local system syncs.
* **Syntax Highlighted Viewer**: Displays scripts in Python, Javascript, Lua, Basic, and Forth. Integrates Claude AI script analysis and code structure explanations.
* **Repl CLI Console**: Provides an interactive terminal console to send direct CLI commands to MicroPython, CircuitPython, NodeMCU, and Espruino devices.
* **Client-Side ZIP Exporter**: Packages directories and files on the fly into compressed `.zip` files using JSZip.

---

## API Documentation

The FastAPI backend exposes the following endpoints:

### 1. Get Microcontroller Registry
* **Route**: `GET /api/mcu/list`
* **Response (JSON)**:
  ```json
  {
    "mcus": {
      "esp32": {
        "mcu_id": "esp32",
        "display_name": "ESP32 (Xtensa dual-core)",
        "family": "Espressif",
        "protocol": "SLIP",
        "ghidra_lang": "Xtensa:LE:32:default",
        "default_baud": 115200,
        "flash_base": 0,
        "default_flash_size": 4194304,
        "flash_sizes": [1048576, 2097152, 4194304, 8388608, 16777216],
        "bootloader_note": "Hold the BOOT/GPIO0 button..."
      }
    }
  }
  ```

### 2. Upload Firmware
* **Route**: `POST /api/upload`
* **Content-Type**: `multipart/form-data`
* **Request**:
  - `file`: Raw firmware binary (`.bin`).
  - `arch`: Target architecture (validated against registry `mcu_id`, e.g. `esp32c3`, `atmega328p`, `stm32f4`).
  - `flash_size`: Expected file size in bytes.
* **Response (JSON)**:
  ```json
  {
    "job_id": "joba1b2c3d4e5f6g7h8i9j0",
    "filename": "firmware.bin",
    "size_bytes": 4194304,
    "arch": "esp32",
    "status": "queued",
    "created_at": "2026-06-18T09:30:00Z"
  }
  ```

### 3. Stream Ghidra Progress
* **Route**: `GET /api/analyze/{job_id}`
* **Response**: `text/event-stream` (Server-Sent Events)
* **Events**:
  - `event: status`: Emits JSON status chunks:
    ```json
    {
      "stage": "Decompiling",
      "percent": 70
    }
    ```
  - `event: result`: Emits the parsed `AnalysisResult` JSON payload containing symbols, strings, functions list, base address, and registry profiles.
  - `event: done`: Signals stream termination.
  - `event: error`: Emits failure messages.

### 4. Stream Claude AI Explanations
* **Route**: `POST /api/explain`
* **Headers**: `X-Forwarded-For` / IP details mapped to rate limit checkers.
* **Request (JSON)**:
  ```json
  {
    "function_name": "wifi_connect_ap",
    "arch": "esp32",
    "pseudo_c": "int wifi_connect_ap(...) { ... }",
    "context_strings": ["Connecting to SSID"],
    "context_symbols": ["wifi_init"]
  }
  ```
* **Response**: `text/event-stream` (subject to 10 requests/min/IP rate limiting; truncates `pseudo_c` at 3,000 characters).

### 5. Smart Runtime Detection
* **Route**: `POST /api/detect`
* **Request (JSON)**:
  ```json
  {
    "port_data": "dTI9Pj4gY29tcGxldGUgcHJvYmUgZGF0YQ==",
    "arch": "esp32"
  }
  ```
* **Response (JSON)**:
  ```json
  {
    "runtime": "micropython",
    "confidence": "high",
    "runtime_version": "1.22.0",
    "action": "file-browser",
    "message": "MicroPython detected (confidence: high). Bypassing binary extraction.",
    "filesystem_commands": {
      "list": "import os; print(os.listdir('/'))",
      "read": "f=open('{filename}'); print(f.read()); f.close()",
      "size": "import os; print(os.stat('{filename}')[6])",
      "space": "import os; s=os.statvfs('/'); print(s[0]*s[3])"
    },
    "frozen_module_hint": false
  }
  ```

### 6. Stream Claude AI Source Script Explanations
* **Route**: `POST /api/explain-source`
* **Request (JSON)**:
  ```json
  {
    "filename": "boot.py",
    "runtime": "micropython",
    "source_code": "import gc\ngc.collect()"
  }
  ```
* **Response**: `text/event-stream` (Subject to 10 requests/min/IP rate limiting; streams plain English explanations for source code scripts).

---

## Microcontroller Registry Reference Table

BININO v2.2.6 includes support for 50 distinct microcontroller variants across 14 major chip families:

| Family | MCU ID | Display Name | Bootloader Protocol | Flash Base | Default Flash Size | Common Runtimes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Espressif** | `esp32` | ESP32 (Xtensa dual-core) | SLIP | `0x0` | 4 MB | micropython, circuitpython, nodemcu, espruino, at-firmware, compiled |
| | `esp32s2` | ESP32-S2 (Xtensa single) | SLIP | `0x0` | 4 MB | micropython, circuitpython, nodemcu, espruino, at-firmware, compiled |
| | `esp32s3` | ESP32-S3 (Xtensa dual) | SLIP | `0x0` | 8 MB | micropython, circuitpython, nodemcu, espruino, at-firmware, compiled |
| | `esp32c3` | ESP32-C3 (RISC-V) | SLIP | `0x0` | 4 MB | micropython, compiled |
| | `esp32c6` | ESP32-C6 (RISC-V) | SLIP | `0x0` | 4 MB | micropython, compiled |
| | `esp32h2` | ESP32-H2 (RISC-V) | SLIP | `0x0` | 4 MB | micropython, compiled |
| | `esp8266` | ESP8266 (Xtensa) | SLIP | `0x0` | 4 MB | micropython, nodemcu, espruino, at-firmware, compiled |
| **AVR** | `atmega328p` | ATmega328P (Arduino Uno/Nano) | STK500v1 | `0x0` | 32 KB | compiled |
| | `atmega2560` | ATmega2560 (Arduino Mega) | STK500v2 | `0x0` | 256 KB | compiled |
| | `atmega32u4` | ATmega32U4 (Leonardo/Micro) | AVR109 | `0x0` | 32 KB | compiled |
| | `attiny85` | ATtiny85 | STK500v1 | `0x0` | 8 KB | compiled |
| | `attiny45` | ATtiny45 | STK500v1 | `0x0` | 4 KB | compiled |
| | `atmega4809` | ATmega4809 (Nano Every) | UPDI | `0x0` | 48 KB | compiled |
| **STM32** | `stm32f1` | STM32F1xx (Blue Pill) | STM32-UART | `0x08000000` | 64 KB | micropython, espruino, elua, forth, rtos-riot, zephyr, compiled |
| | `stm32f4` | STM32F4xx (Black Pill) | STM32-UART | `0x08000000` | 512 KB | micropython, espruino, elua, forth, rtos-riot, zephyr, compiled |
| | `stm32l0` | STM32L0xx | STM32-UART | `0x08000000` | 64 KB | compiled |
| | `stm32l4` | STM32L4xx | STM32-UART | `0x08000000` | 262 KB | micropython, espruino, elua, forth, rtos-riot, zephyr, compiled |
| | `stm32g0` | STM32G0xx | STM32-UART | `0x08000000` | 131 KB | micropython, espruino, elua, forth, rtos-riot, zephyr, compiled |
| | `stm32g4` | STM32G4xx | STM32-UART | `0x08000000` | 262 KB | micropython, espruino, elua, forth, rtos-riot, zephyr, compiled |
| | `stm32h7` | STM32H7xx | STM32-UART | `0x08000000` | 1 MB | micropython, espruino, elua, forth, rtos-riot, zephyr, compiled |
| | `gd32f1` | GD32F103 (STM32 clone) | STM32-UART | `0x08000000` | 64 KB | compiled |
| **RP-series** | `rp2040` | RP2040 (Raspberry Pi Pico) | PICOTOOL | `0x10000000` | 2 MB | micropython, circuitpython, compiled |
| | `rp2350` | RP2350 (Pico 2) | PICOTOOL | `0x10000000` | 4 MB | micropython, circuitpython, compiled |
| **SAMD** | `samd21` | SAMD21 (Arduino Zero, MKR) | BOSSA | `0x0` | 256 KB | circuitpython, openmv, espruino, compiled |
| | `samd51` | SAMD51 (Adafruit M4) | BOSSA | `0x0` | 512 KB | circuitpython, openmv, espruino, compiled |
| **Nordic nRF** | `nrf52840` | nRF52840 | NRF-DFU | `0x0` | 1 MB | circuitpython, espruino, compiled |
| | `nrf52833` | nRF52833 | NRF-DFU | `0x0` | 512 KB | circuitpython, espruino, compiled |
| | `nrf51822` | nRF51822 | NRF-DFU | `0x0` | 256 KB | compiled |
| **NXP LPC** | `lpc1768` | LPC1768 (mbed) | LPC-ISP | `0x0` | 512 KB | compiled, forth |
| | `lpc1114` | LPC1114 (M0) | LPC-ISP | `0x0` | 32 KB | compiled |
| | `lpc54608` | LPC54608 | LPC-ISP | `0x0` | 512 KB | compiled |
| | `mimxrt1060` | iMX RT1060 (Teensy 4.x) | HID-DFU | `0x60000000` | 2 MB | circuitpython, micropython, compiled |
| **TI MSP430** | `msp430g2` | MSP430G2 | TI-BSL | `0xc000` | 16 KB | compiled |
| | `msp430f5` | MSP430F5xx | TI-BSL | `0x8000` | 128 KB | compiled |
| | `msp430fr5` | MSP430FR5xx FRAM | TI-BSL | `0x8000` | 64 KB | compiled |
| **WCH** | `ch32v003` | CH32V003 | WCH-ISP | `0x8000000` | 16 KB | compiled |
| | `ch32v203` | CH32V203 | WCH-ISP | `0x8000000` | 64 KB | compiled |
| | `ch552` | CH552 (8051) | WCH-ISP | `0x0` | 16 KB | compiled |
| | `ch554` | CH554 (8051) | WCH-ISP | `0x0` | 16 KB | compiled |
| **Microchip PIC** | `pic16f` | PIC16F | ICSP | `0x0` | 14 KB | compiled |
| | `pic18f` | PIC18F | ICSP | `0x0` | 32 KB | compiled |
| | `pic32mx` | PIC32MX (MIPS) | ICSP | `0x1fc00000` | 512 KB | compiled |
| **Renesas** | `rl78` | Renesas RL78 | RENESAS-UART | `0x0` | 64 KB | compiled |
| | `rx65n` | Renesas RX65N | RENESAS-UART | `0xffe00000` | 1 MB | compiled |
| | `ra4m1` | Renesas RA4M1 | RENESAS-UART | `0x0` | 256 KB | compiled |
| **Silicon Labs** | `efm32gg` | EFM32 Giant Gecko | XMODEM-UART | `0x0` | 1 MB | compiled |
| | `efm32tg` | EFM32 Tiny Gecko | XMODEM-UART | `0x0` | 32 KB | compiled |
| **Infineon XMC** | `xmc1100` | XMC1100 (M0) | UART-BSL | `0x10001000` | 64 KB | compiled |
| | `xmc4700` | XMC4700 (M4) | UART-BSL | `0xc000000` | 2 MB | compiled |
| **GigaDevice RISC-V** | `gd32vf103` | GD32VF103 (Longan Nano) | DFU-USB | `0x8000000` | 128 KB | compiled |

---

## Installation and Setup

### Prerequisites and Requirements

For a complete breakdown of version requirements, library versions, frameworks, and microcontroller support, refer to the [Requirements, Versions, and Frameworks Guide](requirements.md).

To compile and execute the complete pipeline, your system must have:
1. **Java Development Kit (JDK)**: OpenJDK 17 or OpenJDK 21 installed.
2. **Ghidra**: Download and extract Ghidra 11.0+ or 12.0+ (from the official Ghidra website).
3. **Environment Variable**: Set `GHIDRA_HOME` pointing to your Ghidra installation path.

---

### Step 1: Run the Backend Server

1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```

2. Install Python packages:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure your API key (Optional - required for real Claude AI calls):
   * **Windows PowerShell**:
     ```powershell
     $env:ANTHROPIC_API_KEY="your-api-key"
     ```
   * **Linux / macOS Bash**:
     ```bash
     export ANTHROPIC_API_KEY="your-api-key"
     ```
   *Note: If ANTHROPIC_API_KEY is not defined, the backend defaults to Simulation Mode, streaming simulated descriptions for testing.*

4. Copy the Ghidra script:
   Copy `server/ExportDecompiled.java` into your user scripts directory (defaults to `~/ghidra_scripts`).

5. Run the FastAPI application:
   ```bash
   python -m uvicorn main:app --port 8000
   ```

---

### Step 2: Run the Frontend Application

1. Open a new terminal in the project root folder.

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in a supported browser (Google Chrome, Microsoft Edge, or Opera).

---

## Testing in Demo Mode

If you do not have microcontrollers or a Ghidra environment set up, you can run the complete workflow using **Demo Mode**:

1. Toggle **Demo Mode: ON** in the top navigation bar.
2. Click **Establish Bridge** in the connection panel. The terminal logs a virtual hardware connection to a mock microcontroller.
3. Click **Extract Firmware** to execute a simulated extraction sequence. You can inspect the live SLIP training commands and block updates.
4. Toggling the Hex Preview tab to **Flash Dump** displays the read binary memory buffer.
5. Click **Send to Decompiler**. An emulated progress timeline will trigger upload packets, and stream decompiler step milestones (Import, Auto Analysis, Decompilation, Export) to the panel stepper.
6. Click **View in Code Explorer** to open the IDE layout.
7. Click **Explain** on any function to watch the typewriter effect stream pre-written analyses.
8. Click **Export Report** to compile and save the offline decompiler HTML report.
9. **Simulate Runtime Detection**: When establishing a bridge in Demo Mode, the detector simulates a MicroPython serial banner. It offers an immediate recommendation to jump to the **File Browser** layout.
10. **Browse Simulated Files**: Under the **File Browser** tab, click files in the tree to view their source code, run AI explanations on the scripts, execute mock command queries via the REPL input console, or download the workspace as a ZIP archive.

---

## Directory Structure

```text
binino/
├── dist/                          # Compiled static bundle assets
├── server/                        # Python FastAPI backend
│   ├── models/
│   │   └── schemas.py             # Pydantic validation schemas
│   ├── protocols/                 # 10 hardware serial protocol modules
│   │   ├── __init__.py
│   │   ├── slip.py                # Espressif SLIP logic & signatures
│   │   ├── stm32_uart.py          # STM32 AN3155 bootloader
│   │   ├── stk500v1.py            # AVR STK500v1 protocol
│   │   ├── bossa.py               # SAMD BOSSA protocol
│   │   ├── ti_bsl.py              # MSP430 Bootstrap Loader (BSL)
│   │   ├── nrf_dfu.py             # Nordic nRF serial DFU
│   │   ├── wch_isp.py             # WCH RISC-V and 8051 ISP
│   │   ├── lpc_isp.py             # NXP LPC ASCII ISP
│   │   ├── picotool.py            # Picotool USB MSD copy bridge
│   │   └── xmodem_uart.py         # EFM32 XMODEM-CRC protocol
│   ├── registry/
│   │   └── mcu_registry.py        # Complete 50 MCU variant registry database
│   ├── routes/
│   │   ├── mcu.py                 # Registry list API route
│   │   ├── upload.py              # Multipart firmware uploads route
│   │   ├── analyze.py             # Ghidra analysis and SSE progress route
│   │   ├── detect.py              # [NEW] Smart runtime detection route
│   │   └── explain.py             # Anthropic Claude API explain route
│   ├── services/
│   │   ├── job_manager.py         # Job tracking and folder cleanup service
│   │   ├── runtime_detector.py    # [NEW] Signature evaluation and filesystem commands mapper
│   │   └── ghidra_runner.py       # Subprocess invocation and log parser
│   ├── ExportDecompiled.java      # Headless Ghidra decompiler exporter script
│   ├── main.py                    # FastAPI application initialization
│   ├── requirements.txt           # Python backend dependencies
│   └── README_server.md           # Backend installation guide
├── src/                           # Frontend React application
│   ├── assets/                    # Image files and favicon graphics
│   ├── types/
│   │   └── analysis.ts            # Analysis result types definitions
│   ├── utils/
│   │   ├── mcuRegistry.ts         # Frontend local registry fallback copy
│   │   └── reportGenerator.ts     # Standalone HTML report generator
│   ├── hooks/
│   │   ├── useSerialPort.ts       # Web Serial bridge state hook
│   │   ├── useFlashExtractor.ts   # esptool ROM extraction protocol hook
│   │   ├── useSmartDetect.ts      # [NEW] Port prober and environment signature check hook
│   │   ├── useBackendHandoff.ts   # API handoff and SSE progress hook
│   │   ├── useCodeExplorer.ts     # Code Explorer coordination hook
│   │   └── useAIExplain.ts        # Claude AI streaming hook
│   ├── context/
│   │   └── AppContext.tsx         # Shared frontend application context provider
│   ├── components/
│   │   ├── Navbar.tsx             # Navigation bar and Demo mode controls
│   │   ├── ConnectionPanel.tsx    # Port select and baud configuration dropdowns
│   │   ├── DeviceInfoCard.tsx     # USB device metadata displays
│   │   ├── ExtractionPanel.tsx    # Flash memory block reading pane
│   │   ├── HandoffPanel.tsx       # Local server connection and SSE stepper
│   │   ├── WorkflowStepper.tsx    # Stage progress indicator header
│   │   ├── TerminalPane.tsx       # Live terminal logging panel
│   │   ├── HexPreviewStrip.tsx    # Collapsible hex grid previewer
│   │   ├── Dashboard.tsx          # Master sidebar control and layout structure
│   │   ├── Footer.tsx             # Unified system status footer
│   │   ├── StatusBar.tsx          # System status bar details
│   │   ├── FAQ/                   # Frequently Asked Questions component
│   │   │   └── index.tsx          # FAQ items and list wrapper
│   │   ├── UserManual/            # Interactive user operations manual
│   │   │   └── index.tsx          # Detailed hardware and setup instructions
│   │   ├── FileBrowser/           # [NEW] File browser workspace layout
│   │   │   ├── index.tsx          # Master browser shell pane routing
│   │   │   ├── FileTree.tsx       # Directory tree navigation & CircuitPython local mount picker
│   │   │   ├── FileViewer.tsx     # Syntax editor view and AI code explanation assistant
│   │   │   ├── ReplPassthrough.tsx # Terminal console execution command passthrough
│   │   │   └── RuntimeBadge.tsx   # Environment visual display badge
│   │   └── CodeExplorer/          # Three-pane Code Explorer IDE
│   │       ├── ErrorBoundary.tsx  # React Error Boundary crash layouts
│   │       ├── GlobalSearch.tsx   # Ctrl+K fuzzy symbol locator
│   │       ├── NavigatorPane.tsx  # Functions/Strings/Symbols sidebar list
│   │       ├── CodeViewerPane.tsx # Decompiled source viewer and AI drawer
│   │       ├── HexDumpPane.tsx    # Virtualized memory hex dump column
│   │       ├── SyntaxHighlighter.tsx # Pseudo-C/Asm regex highlighting
│   │       └── index.tsx          # Main explorer overlay shell and keybinds
│   ├── index.css                  # Core CSS and design style definitions
│   └── main.tsx                   # React root entry point
├── package.json                   # Build configs and script dependencies
├── postcss.config.js              # PostCSS configuration file
├── tailwind.config.js             # Tailwind CSS custom presets
├── tsconfig.json                  # TypeScript compiler rules
└── vite.config.ts                 # Vite bundler options
```

---

## Security Considerations and Safety

* **Hardware Safety**: When interfacing with microcontrollers directly via hardware serial lines, ensure that voltage levels are compatible (typically 3.3V logic levels). Avoid connecting 5V lines directly to low-voltage pins to prevent hardware damage.
* **Data Privacy and AI Explanations**: When using the Claude AI Explanation feature, target function decompiled C code is transmitted to Anthropic APIs. Verify that you are permitted to transmit sensitive code blocks prior to calling AI features on proprietary firmware.
* **Extraction Interruptions**: Keep target devices stable and connected during active extraction sequences. Interruptions in serial communication during bootloader dumps can lead to corrupted hex logs, necessitating a manual chip reset.

---

## Future Development Roadmap

* **Write and Flash Capabilities**: Introduce support for writing and flashing custom or patched binaries back to microcontrollers directly from the web dashboard interface.
* **Offline Local LLM Support**: Integrate local inference options (such as Ollama, llama.cpp, or local API gateways) to enable offline AI code explanations without cloud dependencies.
* **Cross-Reference Visualizations**: Develop interactive cross-reference (Xref) mapping and control-flow graph (CFG) visualizers inside the Code Explorer.
* **Dynamic Analysis Integration**: Support active serial feedback debugging interfaces (such as interactive GDB stubs over Web Serial) for real-time memory monitoring.

---

## Contributing

Contributions to BININO are welcome. To contribute:
1. Fork the repository.
2. Create a new topic branch for your feature or bug fix.
3. Commit your changes with clear, descriptive commit messages.
4. Push your branch and open a pull request against the main branch.

Ensure that all modifications respect the project styling system and compile cleanly via standard builds (`npm run build`).

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for the full text.

Copyright (c) 2026 Chandan Sai Pavan Padala.

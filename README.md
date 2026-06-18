# BININO - Web-Based Firmware Extraction and Reverse Engineering Toolkit

BININO is a universal, web-based toolkit designed for firmware extraction, static binary analysis, and reverse engineering. Operating directly inside modern web browsers via the Web Serial API, BININO establishes a high-performance serial bridge to microcontrollers, automates firmware extraction, runs headless Ghidra analysis on a local backend, and leverages Claude AI to explain decompiled functions in plain English.

---

## Key Features and Capabilities

* **Web-Based Hardware Bridge**: Connect directly to microcontrollers (ESP32, ESP8266, ARM Cortex-M, AVR, RISC-V) via USB from the browser, eliminating the need for local drivers or native client installations.
* **Expanded Microcontroller Registry**: Configured with a comprehensive database of 36 distinct MCU variants across 11 major chip families (Espressif, AVR, STM32, RP-series, SAMD, Nordic nRF, NXP LPC, TI MSP430, WCH, Renesas, Silicon Labs, Infineon, and GigaDevice).
* **Automated ROM Extraction Protocols**: Includes 10 standalone protocol handler modules covering Espressif SLIP, STM32 AN3155 UART, STK500v1/v2, AVR109, UPDI, BOSSA, TI-BSL BSL, NRF-DFU, WCH-ISP, LPC-ISP ASCII sync, and Silicon Labs EFM32 XMODEM-CRC.
* **Unified Accordion Sidebar**: Provides a smooth transition through the connection, extraction, metadata, and handoff stages with a mutually exclusive collapsible sidebar stack.
* **Automated Ghidra Pipeline**: Executes headless Ghidra analysis on a local FastAPI server. Disassembles and decompiles imported binary blobs, enforcing explicit memory boundaries (`-loader BinaryLoader` and dynamic `-loader-baseAddr`) and mapping raw instructions back into clean pseudo-C, symbols, and string tables.
* **IDE-Style Code Explorer**: Features a three-pane layout including a function/symbol list searcher, a syntax-highlighted decompiler view (C and Assembly), and a virtualized memory Hex Dump synced to the active function's bounds.
* **Claude AI Assistant**: Streams step-by-step plain-English explanations of target functions directly in the IDE to assist in security reviews and hardware audits. Enforces sliding-window rate limits (10 requests/min per IP) and input limits (3,000 characters).
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
│   │   └── mcu_registry.py        # 36 MCU variant registry database
│   ├── routes/
│   │   ├── mcu.py                 # Registry list API route
│   │   ├── upload.py              # Multipart firmware uploads route
│   │   ├── analyze.py             # Ghidra analysis and SSE progress route
│   │   └── explain.py             # Anthropic Claude API explain route
│   ├── services/
│   │   ├── job_manager.py         # Job tracking and folder cleanup service
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
├── vite.config.ts                 # Dev server configuration
└── tsconfig.json                  # TypeScript compiler settings
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

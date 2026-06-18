# BININO - Web-Based Firmware Extraction and Reverse Engineering Toolkit

BININO is a universal, web-based toolkit designed for firmware extraction, static binary analysis, and reverse engineering. Operating directly inside modern web browsers via the Web Serial API, BININO establishes a high-performance serial bridge to microcontrollers, automates firmware extraction, runs headless Ghidra analysis on a local backend, and leverages Claude AI to explain decompiled functions in plain English.

---

## Key Features and Capabilities

* **Web-Based Hardware Bridge**: Connect directly to microcontrollers (ESP32, ESP8266, ARM Cortex-M, AVR, RISC-V) via USB from the browser, eliminating the need for local drivers or native client installations.
* **ROM Bootloader Extractor**: Employs esptool-style SLIP bootloader handshakes to cycle DTR/RTS lines, force target devices into download mode, and extract raw flash memory blocks with active XOR checksum verification.
* **Unified Accordion Sidebar**: Provides a smooth transition through the connection, extraction, metadata, and handoff stages with a mutually exclusive collapsible sidebar stack.
* **Automated Ghidra Pipeline**: Executes headless Ghidra analysis on a local FastAPI server. Disassembles and decompiles imported binary blobs, mapping raw instructions back into clean pseudo-C, symbols, and string tables.
* **IDE-Style Code Explorer**: Features a three-pane layout including a function/symbol list searcher, a syntax-highlighted decompiler view (C and Assembly), and a virtualized memory Hex Dump synced to the active function's bounds.
* **Claude AI Assistant**: Streams step-by-step plain-English explanations of target functions directly in the IDE to assist in security reviews and hardware audits.
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

### Phase 2: ROM Bootloader Flash Extractor
Phase 2 implements the Espressif bootloader interface to extract raw SPI flash memory over USB:
* **Hardware Reset Sequences**: Pulls Data Terminal Ready (DTR) and Request to Send (RTS) serial lines high/low with precise 100ms timings. Toggles target Chip Enable (EN) and boot pins (GPIO0) to force the microcontroller into its internal ROM download mode.
* **SLIP Framing**: Encapsulates command packets using Serial Line Internet Protocol (SLIP). Frames data with boundary characters (`0xC0`) and escapes occurrences of control characters (`0xC0` -> `0xDB 0xDC`, `0xDB` -> `0xDB 0xDD`).
* **SYNC Handshake**: Transmits command `0x08` along with a 36-byte training pattern, validating incoming responses and retrying up to 10 times with 500ms timeouts on failures.
* **Flash Memory Reading**: Sends `READ_FLASH` command (`0x03`) in sequential 1024-byte block increments. Validates incoming payload layouts and calculates an 8-bit XOR checksum (seed value `0xEF`) to check data integrity. Retries block read operations up to 3 times on checksum errors before terminating the sequence.

### Phase 3: Backend Handoff Server and Ghidra 12 Compatibility
Phase 3 implements the local Python backend that parses raw binary blobs using static reverse-engineering tools:
* **FastAPI Server**: Lightweight API running on `localhost:8000` with CORS mappings for frontend client environments.
* **Job Queue Manager**: Allocates a workspace directory for each decompilation job. Runs a background garbage-collection loop that purges job outputs older than 1 hour to prevent disk depletion.
* **Ghidra Headless Integration**: Spawns `$GHIDRA_HOME/support/analyzeHeadless.bat` in a non-blocking subprocess. Registers a post-analysis Java script (`ExportDecompiled.java`) to iterate through functions, extracting assembly sequences and pseudo-C code blocks.
* **API Classpath Fixes**: Rewrote the headless decompiler script (`ExportDecompiled.java`) string extractor to use `DefinedDataIterator.byDataInstance` combined with a `StringDataInstance` filter. This ensures compatibility with Ghidra 12.1.2 where the static `definedStrings(Program)` method is absent.
* **Server-Sent Events (SSE)**: Streams real-time subprocess stdout logs back to the browser. The frontend decodes these events to update progress steps (Import, Auto Analysis, Decompilation, Export) and percent metrics.

### Phase 4: Interactive Code Explorer
Phase 4 creates a multi-pane development environment to browse decompiled binary findings:
* **Navigator Pane**: Displays list search tabs for functions, strings, and symbols. The entry point is pinned at the top with a flag icon.
* **Decompiled Code Viewer**: Displays pseudo-C code and assembly blocks side-by-side. Uses custom regex tokenizers to style keywords, types, labels, comments, and strings. Offers word-wrap switches and click-to-copy line number paths (`filename:line`).
* **Hex Virtualizer**: Renders the complete binary dump virtualized to target architecture addresses (e.g. `0x40080000` for ESP32). Features address search inputs, active function bounds highlighting, and interactive byte tooltips displaying decimal, binary, and ASCII representations.
* **Splitters and Persistence**: Features resizable split-pane widths that persist in the browser's `localStorage` alongside word-wrap preferences.

### Phase 5: Claude AI Explain and Production Polish
Phase 5 implements AI-assisted code walkthroughs and production-grade audits:
* **AI Explain API**: Integrates the Anthropic Python client in the backend. Streams token-by-token function explanations using Claude model `claude-3-5-sonnet-20241022` to describe function goals, hardware register reads, loops, and security audit flags.
* **Typewriter Hook**: Uses `fetch` and `ReadableStream` to stream text blocks in real time.
* **Offline HTML Report**: Generates a self-contained report containing all functions, pseudo-C blocks with syntax highlighting CSS, and symbols for offline review.
* **Fault Tolerant Boundaries**: Wraps the Code Explorer overlay in React `ErrorBoundary` handlers that display crash diagnostics and log issues to the terminal.
* **Accessibility and Focus**: Traps keyboard focus inside the modal overlays, adds appropriate `aria-label` tags, and flags `role="tab"` and `role="tablist"` attributes.
* **Responsive Layouts**: Collapses panels on viewports less than 900px wide into a single-pane tabbed selector.

### Phase 6: Animated Transitions, Layout Height, and Safety Locks
Phase 6 adds layout responsiveness and operation protections:
* **Accordion Sidebar Stack**: Left-hand control cards use a shared state in `Dashboard.tsx` to expand one panel while automatically collapsing others. It auto-focuses the next stage (e.g., expanding the decompiler handoff once extraction is complete).
* **Smooth CSS Transitions**: Replaced snap unmounting with CSS transitions on `max-height`, `opacity`, and `pointer-events` to yield smooth collapsible animations.
* **Scroll-Safe Layout Constraints**: Removed fixed wrapper heights around the Hex Buffer Preview to let the Terminal logs pane scale dynamically. This prevents layout overflow clipping and locks scroll coordinates.
* **Active Extraction Lock**: Toggling expansion of the Hex Buffer Preview is locked and disabled with visual indicators (lock icon, opacity fade, tooltip warnings) during active extraction runs, preventing serial log scrolling disruptions.
* **Landing Page Visibility**: Optimized paddings and margins on the home landing page to draw the wordmark and cards upwards, keeping the footer visible in standard viewports without requiring vertical scrollbar adjustments.

---

## API Documentation

The FastAPI backend exposes the following endpoints:

### 1. Upload Firmware
* **Route**: `POST /api/upload`
* **Content-Type**: `multipart/form-data`
* **Request**:
  - `file`: Raw firmware binary (`.bin`).
  - `arch`: Target architecture (`esp32`, `esp8266`, `avr`, `cortex`, `riscv`).
  - `flash_size`: Expected file size in bytes.
* **Response (JSON)**:
  ```json
  {
    "job_id": "job_a1b2c3d4",
    "filename": "firmware_esp32.bin",
    "size_bytes": 4194304,
    "arch": "esp32",
    "status": "queued",
    "created_at": "2026-06-18T09:30:00Z"
  }
  ```

### 2. Stream Ghidra Progress
* **Route**: `GET /api/analyze/{job_id}`
* **Response**: `text/event-stream` (Server-Sent Events)
* **Events**:
  - `event: status`: Emits JSON status chunks:
    ```json
    {
      "stage": "Decompiling",
      "message": "Running decompilation analyzer and recovering AST constructs...",
      "percent": 70
    }
    ```
  - `event: result`: Emits the parsed `AnalysisResult` JSON payload upon completion.
  - `event: done`: Signals stream termination.
  - `event: error`: Emits failure messages.

### 3. Stream Claude AI Explanations
* **Route**: `POST /api/explain`
* **Request (JSON)**:
  ```json
  {
    "function_name": "wifi_connect_ap",
    "arch": "esp32",
    "pseudo_c": "int wifi_connect_ap(...) { ... }",
    "context_strings": ["Connecting to SSID", "auth error"],
    "context_symbols": ["wifi_init", "printf"]
  }
  ```
* **Response**: `text/event-stream`
* **Events**:
  - `event: token`: Emits text delta chunks: `{"token": "This function "}`.
  - `event: done`: Emits usage tokens counts: `{"tokens_used": 412}`.

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

If you do not have physical microcontrollers or a Ghidra environment set up, you can run the complete workflow using **Demo Mode**:

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
│   ├── routes/
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
│   ├── assets/                    # Image files and graphic layouts
│   ├── types/
│   │   └── analysis.ts            # Analysis result types definitions
│   ├── utils/
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


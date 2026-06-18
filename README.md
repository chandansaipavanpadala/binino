# Binino — Web-Based Firmware Extraction and Reverse Engineering Bridge

Binino is a comprehensive embedded security engineering toolkit that bridges the gap between raw hardware microcontrollers and readable decompiled source code. Operating directly in the browser via the Web Serial API, Binino enables hardware security analysts to extract raw flash firmware, upload it to a local decompilation backend, explore the decompiled function ASTs, and get instant explanations of the decompiled code powered by Claude AI.

---

## Technical Architecture & Lifecycle Phases

Binino is structured into 5 cohesive engineering phases:

### Phase 1: Hardware Bridge and Live Terminal
Establishes the browser-to-hardware serial connection, managing port lifecycles and incoming streams.
- **Web Serial Interface**: Directly calls the browser's `navigator.serial` API to request and lock serial interfaces without plugins.
- **Asynchronous Read Loop**: Spawns a non-blocking stream reader decoding binary bytes into line-buffered logs with millisecond-precision timestamps (`HH:MM:SS.mmm`).
- **Hex/ASCII Preview**: Displays a live-updating hexadecimal preview of raw incoming serial bytes.

### Phase 2: Flash Extractor
Implements a browser-side subset of the Espressif `esptool` ROM bootloader protocol.
- **SLIP Framing**: Packages and decodes bootloader packets using Serial Line Internet Protocol (SLIP) framing (0xC0).
- **DTR/RTS Reset Sequence**: Cyclically toggles DTR and RTS lines with precise 100ms transitions to reset target ESP32/ESP8266 chips into flash download mode.
- **SYNC Handshake**: Transmits training sequences to auto-detect baud rates and synchronize with ROM loaders.
- **Flash Reader**: Issues sequential block read commands, validates checksums client-side, and yields a downloadable `.bin` firmware file generated entirely in browser memory.

### Phase 3: Backend Handoff Server
A lightweight, local Python service that interfaces the browser with native binary analysis tools.
- **FastAPI Endpoint**: Receives target firmware binaries via secure multipart uploads and indexes jobs.
- **Headless Ghidra Subprocess**: Programmatically runs Ghidra's headless decompiler (`analyzeHeadless`) to parse Xtensa/ARM/AVR machine instructions.
- **Server-Sent Events (SSE)**: Streams Ghidra progress logs back to the browser, displaying stages (Import, Analysis, Decompilation, Export) in real time.

### Phase 4: Code Explorer IDE
An interactive, full-screen three-pane reverse-engineering interface that overlays on the dashboard.
- **Pane A (Navigator)**: Sidebar containing virtualized scroll lists of decompiled functions, string tables, and imported/exported symbols.
- **Pane B (Code Viewer)**: Displaying pseudo-C and raw disassembly side-by-side with custom inline syntax highlighting.
- **Pane C (Hex Dump)**: Virtualized memory viewer mapping raw binary offsets to virtual addresses (e.g. `0x40080000` for ESP32) with a hover tooltip showing dec/bin/char values.

### Phase 5: AI Explain & Production Polish
The final delivery layer adding deep AI explanation and production-grade software engineering polish.
- **AI Explain**: Streams real-time token-by-token explanations of decompiled code from the Anthropic Claude API using SSE. Explains high-level logic, peripheral register offsets, and potential vulnerabilities.
- **Export Report**: Compiles the entire analysis result (decompile functions with CSS styling, symbols, strings) into a single, self-contained HTML file for off-line audits.
- **Transitions & Boundaries**: Smooth CSS overlay entrance animations, class-based responsive viewports (<900px switches to tabs), and dual-layer React Error Boundaries isolating UI faults.

---

## Installation & Quickstart

To run a complete decompiler analysis pipeline, launch both the client-side development server and the local handoff backend.

### Prerequisites

1. **Browser Support**: Web Serial API is supported in Google Chrome, Microsoft Edge, and Opera.
2. **Java Runtime**: Ghidra requires OpenJDK 17 or OpenJDK 21 configured on your path.
3. **Ghidra Installation**: Ensure `GHIDRA_HOME` is set pointing to your Ghidra directory.

---

### Step 1: Backend Setup

1. **Navigate to the server folder**:
   ```bash
   cd server
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set your API keys (Optional)**:
   To enable AI Explain with the live Claude API, set your Anthropic key:
   - **Windows PowerShell**:
     ```powershell
     $env:ANTHROPIC_API_KEY="sk-ant-..."
     ```
   - **Linux / macOS Bash**:
     ```bash
     export ANTHROPIC_API_KEY="sk-ant-..."
     ```
   *If unset, the backend streams a high-fidelity typewriter simulation.*

4. **Copy the Ghidra Script**:
   Copy `server/ExportDecompiled.java` to your user scripts directory:
   `$HOME/ghidra_scripts/`

5. **Start the FastAPI Server**:
   ```bash
   python -m uvicorn main:app --port 8000
   ```

---

### Step 2: Frontend Setup

1. **Open a new terminal at the project root directory**:
   ```bash
   npm install
   ```

2. **Start the Vite Dev Server**:
   ```bash
   npm run dev
   ```

3. **Access Binino**:
   Navigate to `http://localhost:5173`.

---

## Production Build & Bundle Size

To build the static frontend bundle:
```bash
npm run build
```
This generates a production-optimized package inside `dist/`. The bundle size is thoroughly optimized to compile under **300KB gzipped** (typically ~77KB gzipped), ensuring instant loads.

---

## Emulation and Testing (Demo Mode)

Binino features a zero-dependency **Demo Mode** toggle:
1. Turn **Demo Mode: ON** in the navigation bar.
2. Click **Establish Bridge** to simulate a serial connection.
3. Click **Extract Firmware** to observe simulated SLIP-framed reading.
4. Once complete, click **Decompile Firmware** to upload the dummy binary.
5. Open the **Code Explorer** overlay to inspect mock function lists, virtual hex viewers, and trigger simulated AI explanations.
6. Click **Export Report** to test report generation outputs.

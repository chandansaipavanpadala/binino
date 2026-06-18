# Binino Backend Handoff Server

The Binino Handoff Server is a lightweight, self-hosted FastAPI service that handles microcontroller firmware upload pipelines, invokes headless Ghidra subprocesses, and streams analysis progress using Server-Sent Events (SSE).

---

## Technical Architecture

1. **Microcontroller Registry**: Contains a comprehensive profile database of 36 distinct MCU variants across 11 chip families. Every profile defines the target architecture, default baud rate, flash memory base address, default and alternative flash sizes, requires_tool flags, and contextual bootloader connection notes.
2. **Upload Handler**: Validates binary images up to 32MB against allowed MCU registry targets. Instantly triggers a background asynchronous analysis task upon saving.
3. **Asynchronous Subprocess**: Spawns `$GHIDRA_HOME/support/analyzeHeadless` in a thread-safe process. Enforces explicit memory boundary parameters (`-loader BinaryLoader` and `-loader-baseAddr`) to ensure raw binary images decompile with correct absolute memory layouts.
4. **SSE Progress Stream**: Monitored by `asyncio.Event` synchronization. Progress markers read stdout log messages (including standard Ghidra 11.x/12.x output lines) and pipe status milestones in real time.
5. **Simulation Fallback**: If Ghidra is not available, the server launches an MCU-aware simulation mode generating specific C functions (e.g. AVR setup/loop/ISR, STM32 SystemInit/HAL_Init/MX_GPIO_Init) and runs with a progress speed proportional to the target flash memory size.
6. **API Security & Constraints**: Limits AI decompilation explanations to a maximum of 10 requests per minute per IP address (tracked via sliding-window deques) and truncates input logic beyond 3,000 characters.

---

## API Endpoints

- **GET /api/mcu/list**: Returns the complete microcontroller registry.
- **POST /api/upload**: Accepts binary firmware uploads, checks architecture validity, and schedules the background analysis runner.
- **GET /api/analyze/{job_id}**: Establishes the real-time Server-Sent Events progress stream.
- **GET /api/jobs/{job_id}**: Reports current status percent and availability of results.
- **GET /api/result/{job_id}**: Fetches decompiled functions, symbols table, and character strings.
- **POST /api/explain**: Streams detailed AI-powered explanations of decompiled code.

---

## Installation & Setup

### 1. Python Environment Setup
Install the dependencies listed in `requirements.txt`:
```bash
pip install -r requirements.txt
```

### 2. Ghidra Installation
To perform real hardware firmware decompilations:
1. Download and extract **Ghidra 11.0+** from [ghidra-sre.org](https://ghidra-sre.org/).
2. Set the `GHIDRA_HOME` environment variable pointing to your Ghidra installation root.
   - **Windows PowerShell**:
     ```powershell
     $env:GHIDRA_HOME="C:\Path\To\ghidra_directory"
     ```
   - **Linux / macOS Bash**:
     ```bash
     export GHIDRA_HOME="/path/to/ghidra_directory"
     ```

### 3. Ghidra Script Placement
To enable automated function exports, make sure the `ExportDecompiled.java` script is discoverable by Ghidra:
- Copy `server/ExportDecompiled.java` into your user's Ghidra scripts directory (defaults to `$HOME/ghidra_scripts/` or `$GHIDRA_HOME/Ghidra/Features/Decompiler/ghidra_scripts/`).

---

## Running the Server

Start the Uvicorn hot-reloader from the root project directory:
```bash
uvicorn server.main:app --reload --port 8000
```

The API will bind to `http://localhost:8000`. You can review the interactive OpenAPI documentation by visiting `http://localhost:8000/docs`.

---

## AI Explain Integration (Claude API)

Binino leverages the Anthropic Claude API to provide intelligent, natural language explanations of decompiled pseudo-C functions inside the Code Explorer.

### 1. Configuration
To use the real Anthropic Claude API, set the `ANTHROPIC_API_KEY` environment variable prior to starting the server:

- **Windows PowerShell**:
  ```powershell
  $env:ANTHROPIC_API_KEY="your-api-key-here"
  ```
- **Linux / macOS Bash**:
  ```bash
  export ANTHROPIC_API_KEY="your-api-key-here"
  ```

### 2. Simulation Fallback
If `ANTHROPIC_API_KEY` is not defined, the server automatically defaults to **Simulation Mode**. In this mode, the server streams realistic explanations of common functions (like clock setup, WiFi connect, packet parsing, ADC loops) directly from pre-written templates. This allows full testing and demonstration of the UI's typewriter effect and loading/drawer flows without incurring any real API cost or requiring credentials.

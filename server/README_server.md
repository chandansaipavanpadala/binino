# Binino Backend Handoff Server

The Binino Handoff Server is a lightweight, self-hosted FastAPI service that handles microcontroller firmware upload pipelines, invokes headless Ghidra subprocesses, and streams analysis progress using Server-Sent Events (SSE).

---

## Technical Architecture

1. **Upload Handler**: Validates binary images up to 32MB. Sanitizes input filenames to block path traversal, and stores files in clean workspace directories.
2. **Asynchronous Subprocess**: Spawns `$GHIDRA_HOME/support/analyzeHeadless` in a non-blocking process.
3. **SSE Progress Stream**: Monitors process output logs and pipes status milestones (Import, Auto Analysis, Decompilation, Export) in real time back to the browser interface.
4. **Simulation Fallback**: If Ghidra is not installed, the server automatically starts a simulation timeline emitting milestones and mock code.

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

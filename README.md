# Binino — Web-Based Firmware Extraction and Reverse Engineering Bridge

Binino is a universal toolkit designed to bridge the gap between compiled microcontroller firmware and high-level readable source code. Operating entirely within the web browser via the Web Serial API, Binino enables hardware analysts and embedded systems engineers to extract binary data directly from connected microcontrollers, monitor live serial output, and analyze the resulting firmware structure without the need for native desktop applications or backend server components.

---

## Architecture Overview

Binino is designed to be highly modular, separating low-level hardware serial communication from high-level interface components. The project is implemented in React 18, utilizing functional components and custom React hooks for state management and protocol sequencing.

### Phase 1: Hardware Bridge and Live Terminal
Phase 1 establishes the core browser-to-hardware serial interface, managing port lifecycle, data streaming, and live console visualization.
- **Web Serial Interface**: Directly calls the browser's `navigator.serial` API to request and open serial interfaces.
- **Asynchronous Read Loop**: Runs a non-blocking stream reader that processes incoming data chunks, uses a `TextDecoder` to format binary data into text lines, and appends them to the live terminal logs as serial data.
- **HxD-Style Hex Viewer**: Accumulates raw bytes into a local buffer and renders them in a side-by-side hexadecimal octet and ASCII grid layout.

### Phase 2: Flash Extractor
Phase 2 implements a subset of the Espressif `esptool` UART bootloader protocol entirely client-side.
- **SLIP Framing**: Encapsulates all bootloader command packets using Serial Line Internet Protocol (SLIP) boundaries (0xC0), escaping command payload occurrences of 0xC0 and 0xDB.
- **Hardware Reset Sequence**: Cyclically toggles the Data Terminal Ready (DTR) and Request To Send (RTS) lines with precise 100ms timings to pull GPIO0 low and toggle the Enable (EN) pin, resetting the microcontroller into its internal ROM bootloader mode.
- **SYNC Handshake**: Transmits command 0x08 with a specific 36-byte training pattern to synchronize baud rates and verify bootloader readiness, retrying up to 10 times with 500ms timeouts.
- **Flash Memory Reading**: Transmits `READ_FLASH` commands (0x03) in sequential 1024-byte block requests, validating incoming packet structures and verifying the data integrity using an 8-bit XOR checksum (seed value 0xEF).
- **Emulation Engine (Demo Mode)**: Simulates the entire bootloader connection, progress intervals, throughput speeds, warning retries, and file generation to facilitate visual testing in non-serial or virtual environments.

---

## Technical Specifications

### Custom Hooks

#### useSerialPort
Manages port connection, selection prompts, unexpected disconnect event handlers, and data chunk accumulations.
- **Inputs**: Exposes configuration states for target architecture and baud rates.
- **Outputs**: Returns state objects for connection status (`idle`, `connecting`, `connected`, `error`), live serial log entries, accumulated raw serial buffers, and control methods.
- **Lock Management**: Offers `pauseReadLoop()` and `resumeReadLoop()` to temporarily suspend background terminal reading during high-priority binary transactions.

#### useFlashExtractor
Coordinates SLIP-framed bootloader transactions to dump SPI flash contents.
- **Inputs**: Accesses target `portRef`, terminal log streams, and read loop controls from `useSerialPort`.
- **Outputs**: Returns extraction status (`idle`, `syncing`, `reading`, `done`, `error`), transfer metrics (bytes read, percentage, transfer speed, and ETA), the generated binary array, and execution commands.
- **Fault Tolerance**: If a checksum mismatch is detected, the hook logs a warning and retries the block read sequence up to 3 times before terminating the dump.

---

## Getting Started

### Prerequisites
To communicate with physical microcontrollers, you must run the application in a browser that supports the Web Serial API:
- Google Chrome (Desktop)
- Microsoft Edge (Desktop)
- Opera (Desktop)

*Note: Safari, Firefox, and mobile browsers are not supported. If run on an unsupported browser, the application will display a warning banner indicating that hardware connection functions are disabled.*

### Installation

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Start the local development server**:
   ```bash
   npm run dev
   ```

3. **Build the production package**:
   ```bash
   npm run build
   ```

---

## Emulation and Testing (Demo Mode)

To inspect the visual interface and protocol logs without connecting physical hardware:
1. Enable the **Demo Mode** switch in the top navigation bar.
2. Click **Establish Bridge** in the hardware panel. A virtual serial connection will instantly connect to a simulated ESP32 chip.
3. Click **Extract Firmware** to execute the simulated firmware backup sequence.
4. Observe the terminal logs representing the bootloader reset, sync sequence, block reading, and a simulated checksum mismatch recovery.
5. Toggle the segmented control at the top of the Hex viewer to **Flash Dump** to inspect the read bytes.
6. Click **Download** to obtain the compiled `.bin` firmware file generated in memory.

---

## Codebase Directory Structure

```text
binino/
├── dist/                          # Production-ready compiled assets
├── node_modules/                  # Project dependencies
├── postcss.config.js              # PostCSS plugin configurations (ESM)
├── tailwind.config.js             # Tailwind CSS theme extension configurations (ESM)
├── tsconfig.json                  # TypeScript compiler rules
├── vite.config.ts                 # Vite bundler alias definitions and dev settings
├── index.html                     # Standard HTML template entry point
├── package.json                   # Build dependencies and utility scripts
├── README.md                      # Developer documentation
└── src/
    ├── main.tsx                   # React DOM mounting initialization
    ├── App.tsx                    # Layout grid structures and global hooks integration
    ├── index.css                  # Tailwinds css entries and custom scrollbar styles
    ├── hooks/
    │   ├── useSerialPort.ts       # Serial port interface hooks
    │   └── useFlashExtractor.ts   # esptool bootloader and SLIP protocol hooks
    └── components/
        ├── Navbar.tsx             # Header navigation and emulation toggles
        ├── ConnectionPanel.tsx    # Hardware interface drop-downs and connect buttons
        ├── DeviceInfoCard.tsx     # Connected device metadata displays
        ├── TerminalPane.tsx       # Live serial terminal output viewports
        └── HexPreviewStrip.tsx    # Hexadecimal and ASCII dual-segment previewers
```

---

## Project Roadmap

- **Phase 1**: Establishing hardware bridge and live serial terminal streams (Completed).
- **Phase 2**: Assembling ROM bootloader flash extraction protocol and buffer downloader (Completed).
- **Phase 3**: Integrating AVR/Arduino target programmers and AVRDUDE protocol adapters (Pending).
- **Phase 4**: Constructing backend-free machine code decompilation pipeline (Pending).
- **Phase 5**: Designing source code reverse engineering and pseudo-C visualization interface (Pending).

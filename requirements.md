# Binino — Requirements, Versions, and Frameworks

This document details the software versions, frameworks, tools, and hardware support required to run, compile, and develop the **Binino** toolkit.

---

## 1. Frontend Web Application

The frontend is a React Single Page Application (SPA) structured with a custom, premium dark monochrome design system, built using **Vite** and **TypeScript**.

| Technology / Library | Version / Constraint | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.0.0` (LTS recommended) | Local development runtime and package manager |
| **React** | `^18.3.1` | UI component library |
| **Vite** | `^5.4.1` | Superfast frontend dev server and bundler |
| **TypeScript** | `^5.5.2` | Strong type checking and developer safety |
| **react-router-dom** | `^7.18.0` | Client-side routing (configured via `HashRouter`) |
| **Tailwind CSS** | `^3.4.10` | Utility CSS mapping styling structures |
| **Lucide React** | `^0.446.0` | Clean developer icons |
| **@types/w3c-web-serial**| `^1.0.6` | TypeScript type declarations for Web Serial APIs |

---

## 2. Backend Decompiler & Handoff Server

The backend is a high-performance Python API designed to orchestrate firmware binary uploads, manage analysis workspaces, spawn Ghidra subprocesses, and interact with the Claude AI explanation model.

| Library / Module | Version / Constraint | Purpose |
| :--- | :--- | :--- |
| **Python** | `>= 3.9` (e.g. `3.13`) | Core programming runtime |
| **FastAPI** | `>= 0.100.0` | High-performance, async web API framework |
| **Uvicorn** | `>= 0.22.0` | ASGI server implementation for FastAPI |
| **python-multipart** | `>= 0.0.9` | Multipart form-data parser for firmware uploads |
| **sse-starlette** | `>= 2.0.0` | Server-Sent Events (SSE) streaming logs |
| **Pydantic** | `>= 2.0.0` | Data validation and schemas |
| **Anthropic** | `>= 0.16.0` | Official client library for the Claude AI explaining API |

---

## 3. Reverse Engineering & Decompiler Environment

To support static reverse-engineering, a local Ghidra installation is necessary.

| Tool / Framework | Supported Version | Purpose |
| :--- | :--- | :--- |
| **Ghidra SRE** | `11.0+` (tested with `12.1.2_PUBLIC`) | Headless decompilation and symbol analysis |
| **Java Development Kit (JDK)**| `JDK 17` or `JDK 21` (tested with OpenJDK 21) | Required to run Ghidra and compile post-analysis scripts |
| **Environment Variable** | `GHIDRA_HOME` | Absolute path pointing to the root of the Ghidra folder |

---

## 4. Hardware Support & Microcontrollers

Binino communicates with target microcontrollers directly through the browser.

* **Browser Compatibility**: Requires a browser supporting the **Web Serial API** (Google Chrome, Microsoft Edge, Opera, Chromium-based browsers).
* **Supported Architectures**:
  - **ESP32**: Xtensa 32-bit (UART Bootloader SLIP synchronization)
  - **ESP8266**: Xtensa 32-bit (UART Bootloader SLIP synchronization)
  - **Raspberry Pi Pico (RP2040)**: ARM Cortex-M0+ (UART CDC serial bridge bypass emulator)
  - **Generic ARM Cortex / RISC-V**: Simulation or handoff backend analysis support.

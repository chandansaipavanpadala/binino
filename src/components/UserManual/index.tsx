import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Menu, X } from 'lucide-react';

const sections = [
  {
    id: 'overview',
    title: 'Overview',
    content: `BININO is a browser-based firmware extraction and reverse-engineering toolkit designed for embedded engineers, security researchers, and hardware enthusiasts. It provides a complete pipeline from physical hardware connection to decompiled code analysis — entirely from a web browser.

The toolkit consists of five integrated phases:
• Phase 1 — Hardware Bridge: Connect to microcontrollers via USB using the Web Serial API.
• Phase 2 — Flash Extractor: Read raw flash memory using the esptool SLIP bootloader protocol.
• Phase 3 — Backend Handoff: Upload the binary to a local FastAPI server for Ghidra headless analysis.
• Phase 4 — Code Explorer: View decompiled pseudo-C, assembly, hex dumps, strings, and symbols in an IDE-style interface.
• Phase 5 — AI Explain: Get Claude-powered plain-English explanations of decompiled firmware functions.`,
  },
  {
    id: 'requirements',
    title: 'System Requirements',
    content: `Frontend (Browser):
• Google Chrome v89+, Microsoft Edge v89+, or Opera v76+
• Web Serial API support required for hardware connectivity
• Demo Mode works in all modern browsers without Web Serial

Backend (Local Server):
• Python 3.9 or later
• Java 17+ (Adoptium Temurin JDK recommended for ARM64/x86)
• Ghidra 10.x or 11.x (download from ghidra-sre.org)
• 4 GB RAM minimum (8 GB recommended for large binaries)

Hardware:
• USB cable (Type-A to Micro-USB or USB-C depending on your dev board)
• Supported microcontroller: ESP32, ESP8266, ARM Cortex-M, AVR, or RISC-V`,
  },
  {
    id: 'installation',
    title: 'Installation',
    content: `1. Clone the repository:
   git clone https://github.com/chandansaipavanpadala/binino.git
   cd binino

2. Install frontend dependencies:
   npm install

3. Start the development server:
   npm run dev

4. Install backend dependencies:
   cd server
   pip install -r requirements.txt

5. Set environment variables:
   • GHIDRA_HOME — Path to your Ghidra installation (e.g., C:\\Program Files\\ghidra_12.1.2_PUBLIC)
   • ANTHROPIC_API_KEY — Your Anthropic API key (optional, for AI Explain)

6. Start the backend server:
   python -m uvicorn main:app --port 8000`,
  },
  {
    id: 'connecting',
    title: 'Connecting a Device',
    content: `1. Open BININO in Chrome/Edge and navigate to the Dashboard.
2. Select your microcontroller architecture from the dropdown (ESP32, ESP8266, ARM Cortex-M, AVR, or RISC-V).
3. Select the baud rate (115200 is the default for most ESP devices).
4. Click "Establish Bridge" — a browser dialog will prompt you to select a COM/serial port.
5. Grant permission to the selected port.
6. The status indicator will change to "Live" when the connection is established.

Troubleshooting:
• Ensure your USB cable supports data (not charge-only).
• Install the appropriate USB-to-UART driver (CH340/CP2102) for your development board.
• On Windows, check Device Manager for the COM port assignment.
• Only one application can access a COM port at a time — close Arduino IDE or other serial monitors.`,
  },
  {
    id: 'smart-detect',
    title: 'Smart Runtime Detection & File Browser',
    content: `BININO v2.0.5 introduces automated Smart Runtime Detection and an interactive File Browser for interpreted environments. 

Smart Runtime Detector:
When a device bridge is established, the tool automatically sends background command probes (including REPL sequences, Lua triggers, JS queries, and AT sync requests) to identify the running firmware category. 

Classification & Layout Routes:
• Route A — Interpreted Runtimes: Detects MicroPython, CircuitPython, NodeMCU Lua, or Espruino JS. This opens the interactive File Browser directly, letting you read, inspect, and analyze plain-text source scripts.
• Route B — Compiled Firmware: Triggered when no runtime is detected. Bypasses the file browser to guide you straight through the standard raw binary firmware extraction and Ghidra analysis.
• Route C — Bootloader Mode: Detects active bootloader synchronization, skipping probing to launch extraction.
• Route D — Utilities/AT: Detects shells (RTOS, Forth, TinyBASIC) and routes to a full terminal passthrough.

File Browser & AI Source Explanations:
The File Browser exposes a collapsible directory tree. Selecting a file displays code with line numbers and syntax highlighting. Clicking 'Explain script' sends the plain-text script to the AI (Claude) to explain hardware peripherals, control loop designs, and potential coding bugs in real-time. You can package and download all files at once as a ZIP archive using JSZip.`,
  },
  {
    id: 'extraction',
    title: 'Extracting Firmware',
    content: `Once connected, the Flash Extractor panel becomes active:

1. Select the target flash memory size (1 MB to 16 MB). Most ESP32 modules use 4 MB.
2. Click "Extract Firmware" to begin the extraction process.
3. BININO enters bootloader mode by cycling the DTR/RTS pins, then sends the esptool SYNC handshake.
4. Flash blocks are read in 1024-byte chunks with XOR checksum verification.
5. Progress is displayed in real-time with throughput speed and ETA.
6. On completion, the binary is stored in browser memory and the "Download" button becomes available.

The extraction can be cancelled at any time. If an error occurs mid-read, partial data can still be downloaded.

Important: The device will reset into bootloader mode during extraction. Any running application code will be interrupted.`,
  },
  {
    id: 'decompilation',
    title: 'Decompilation Pipeline',
    content: `After extraction, the Decompiler Handoff panel appears:

1. Click "Send to Decompiler" to upload the binary to your local FastAPI backend.
2. The backend stores the binary temporarily and spawns a Ghidra headless analysis job.
3. Progress is streamed back via Server-Sent Events (SSE) through four stages:
   • Import — Reading and partitioning the binary image
   • Analyse — Scanning function tables, basic blocks, and call graphs
   • Decompile — Reconstructing control flow and generating pseudo-C
   • Export — Writing symbols, strings, and formatted source output

4. When complete, the structured AnalysisResult is sent to the browser.
5. Click "View in Code Explorer" to open the IDE interface.

The backend must be running on localhost:8000 for real decompilation. In Demo Mode, a simulated analysis runs entirely client-side.`,
  },
  {
    id: 'explorer',
    title: 'Code Explorer',
    content: `The Code Explorer is a full-screen, three-pane IDE interface:

Pane A — Navigator (left):
• Lists all decompiled functions with their addresses and sizes
• Click any function to view its code
• Tabs for Functions, Strings, and Symbols
• Search filter to find functions by name

Pane B — Code Viewer (center):
• Displays pseudo-C and assembly for the selected function
• Toggle between C and ASM views
• Syntax-highlighted with keyword, string, and comment coloring
• Word wrap toggle and line numbers
• "AI Explain" button sends the code to Claude for analysis

Pane C — Hex Dump (right):
• Raw hexadecimal view of the firmware binary
• ASCII representation alongside hex bytes
• Navigate to any offset

Additional features:
• Global Search (Ctrl+K) — Search across all function names, strings, and symbols
• Export HTML Report — Generate a standalone, offline-compatible analysis report
• Resizable panes — Drag the dividers to adjust pane widths`,
  },
  {
    id: 'ai-explain',
    title: 'AI Explain',
    content: `The AI Explain feature uses Anthropic's Claude API to explain decompiled functions:

Setup:
1. Set your ANTHROPIC_API_KEY in the backend .env file
2. Restart the FastAPI server

Usage:
1. Select a function in the Code Explorer
2. Click the "Explain" button in the Code Viewer pane
3. The pseudo-C code is sent to Claude via the backend
4. The explanation streams back in real-time

The explanation includes:
• What the function does in plain English
• What hardware registers or peripherals it interacts with
• Any security concerns or vulnerabilities
• Context about the function's role in the firmware

Privacy: Only the selected function's code is sent to the API. The full binary or other functions are never transmitted.`,
  },
  {
    id: 'demo-mode',
    title: 'Demo Mode',
    content: `Demo Mode allows you to explore the full BININO interface without physical hardware:

• Simulates a virtual ESP32 bridge connection
• Generates realistic mock firmware binary data
• Runs a simulated Ghidra analysis with timed progress updates
• Produces six realistic decompiled functions (system_init, wifi_connect_ap, process_packet, sensor_read_loop, log_write, app_main)
• AI Explain works in demo mode with a simulated response

To activate: Click "Demo Mode: ON" in the navbar, or click "Try Demo Mode" on the landing page.

Demo Mode is ideal for:
• Learning the BININO workflow before connecting real hardware
• Testing UI changes during development
• Presentations and demonstrations`,
  },
  {
    id: 'deployment',
    title: 'Deployment',
    content: `Frontend Deployment (Static):
The frontend builds to a static dist/ folder. Deploy to any static host:

• GitHub Pages: Push to main branch — the included GitHub Actions workflow automatically builds and deploys.
• Vercel: Import the repository — vercel.json handles SPA rewrites.
• Netlify: Set build command to "npm run build" and publish directory to "dist".

Backend Deployment:
The FastAPI backend should run on a server with Ghidra and Java installed:

• Development: python -m uvicorn main:app --port 8000 --reload
• Production: Use gunicorn with uvicorn workers behind nginx
• Docker: A Dockerfile can be created with Java + Ghidra + Python base image

Environment Variables:
• GHIDRA_HOME — Required for headless analysis
• ANTHROPIC_API_KEY — Optional, for AI Explain
• BININO_ALLOWED_ORIGINS — CORS origins (defaults to localhost)`,
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    content: `Common Issues:

"Web Serial API not supported"
→ Use Chrome, Edge, or Opera. Firefox and Safari don't support Web Serial.

"Port is busy or in use"
→ Close Arduino IDE, PuTTY, or any other serial monitor. Only one app can use a COM port.

"SYNC failed after 10 attempts"
→ Check baud rate (try 115200). Ensure GPIO0 is LOW during boot. Try pressing the BOOT button on your ESP32 while clicking Extract.

"Cannot connect to server on localhost:8000"
→ Start the backend: cd server && python -m uvicorn main:app --port 8000

"Ghidra analysis fails"
→ Verify GHIDRA_HOME is set correctly. Ensure Java 17+ is installed. Check that analyzeHeadless.bat exists in GHIDRA_HOME/support/.

"AI Explain returns an error"
→ Check your ANTHROPIC_API_KEY in the .env file. Ensure the backend can reach api.anthropic.com.

Build Issues:
→ Run npm ci to clean install dependencies. Ensure Node.js 18+ is installed.`,
  },
];

export const UserManual: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const isClickScrolling = useRef<boolean>(false);
  const scrollTimeout = useRef<number | null>(null);

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    setIsMobileNavOpen(false);
    
    isClickScrolling.current = true;
    if (scrollTimeout.current) {
      window.clearTimeout(scrollTimeout.current);
    }

    const el = document.getElementById(`section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    scrollTimeout.current = window.setTimeout(() => {
      isClickScrolling.current = false;
    }, 800);
  };

  // Clean up timeouts
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        window.clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  // Scroll spy observer to highlight sections automatically while scrolling
  useEffect(() => {
    const observerOptions = {
      root: contentRef.current,
      rootMargin: '-40px 0px -70% 0px',
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      if (isClickScrolling.current) return;
      
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id.replace('section-', '');
          setActiveSection(sectionId);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    const sectionElements = document.querySelectorAll('[id^="section-"]');
    sectionElements.forEach((el) => observer.observe(el));

    return () => {
      sectionElements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  // Focus trap implementation
  useEffect(() => {
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusable = containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, []);

  // Handle escape key to close/navigate back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div ref={containerRef} className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="w-full px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded transition-colors hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h1 className="text-base font-semibold">User Manual</h1>
          </div>
        </div>

        {/* Mobile nav toggle */}
        <button
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="lg:hidden p-1.5 rounded"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          {isMobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        {/* Left nav — sticky on desktop, dropdown on mobile */}
        <nav
          className={`
            lg:h-full lg:w-56 lg:shrink-0 lg:block
            ${isMobileNavOpen ? 'absolute z-50 inset-x-0 top-0 block' : 'hidden lg:block'}
          `}
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <div className="p-4 space-y-0.5 overflow-y-auto h-full">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSectionClick(s.id)}
                className="w-full text-left px-3 py-2 rounded text-xs font-medium transition-all duration-150"
                style={{
                  backgroundColor: activeSection === s.id ? 'var(--bg-elevated)' : 'transparent',
                  color: activeSection === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderLeft: activeSection === s.id ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 lg:px-12 py-10 space-y-12">
          {sections.map((s) => (
            <section key={s.id} id={`section-${s.id}`} style={{ scrollMarginTop: '24px' }}>
              <h2
                className="text-lg font-semibold mb-4 pb-2"
                style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                {s.title}
              </h2>
              <div
                className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}
              >
                {s.content}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserManual;

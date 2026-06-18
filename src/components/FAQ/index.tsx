import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowLeft, HelpCircle } from 'lucide-react';

const faqData = [
  {
    q: 'What is BININO?',
    a: 'BININO is a browser-based firmware extraction and reverse-engineering toolkit. It connects to microcontrollers via USB using the Web Serial API, extracts raw flash memory, decompiles it using Ghidra headless analysis, and presents the results in an IDE-style code explorer with AI-powered explanations.',
  },
  {
    q: 'Which browsers are supported?',
    a: 'BININO requires a browser that supports the Web Serial API. Currently, Google Chrome (v89+), Microsoft Edge (v89+), and Opera (v76+) are supported. Firefox and Safari do not support Web Serial. Demo Mode works in all modern browsers.',
  },
  {
    q: 'What microcontrollers can I connect?',
    a: 'BININO supports ESP32 (WROOM/WROVER), ESP8266 (NodeMCU), ARM Cortex-M (STM32/NXP), AVR/ATmega (Arduino), and RISC-V (CH32/ESP32-C3). The flash extraction protocol is currently optimized for Espressif chips; other architectures use stub protocols.',
  },
  {
    q: 'Do I need to install any software?',
    a: 'The frontend runs entirely in the browser — no installation needed. For decompilation, you need a local Python backend (FastAPI) with Ghidra installed. Java 17+ (Temurin JDK recommended) is required for Ghidra. See the User Manual for setup instructions.',
  },
  {
    q: 'What is Demo Mode?',
    a: 'Demo Mode simulates the entire pipeline without physical hardware. It emulates a virtual ESP32 bridge, generates mock firmware binary data, runs a simulated Ghidra analysis, and produces realistic decompiled output. It is perfect for exploring the UI and understanding the workflow.',
  },
  {
    q: 'Is my firmware data sent to any external server?',
    a: 'No. All flash extraction happens locally via USB. The decompilation server runs on your own machine (localhost:8000). The only external API call is the optional AI Explain feature, which sends individual function code to Claude via the Anthropic API. You control your own API key.',
  },
  {
    q: 'How do I set up the Ghidra backend?',
    a: 'Install Java 17+ (Adoptium Temurin), download Ghidra from ghidra-sre.org, set the GHIDRA_HOME environment variable, then run the FastAPI server with: cd server && pip install -r requirements.txt && python -m uvicorn main:app --port 8000. Full instructions are in the User Manual.',
  },
  {
    q: 'Can I export the analysis results?',
    a: 'Yes. The Code Explorer provides two export options: (1) Download a standalone HTML report with all functions, assembly, strings, and symbols, and (2) download the raw .bin firmware file. The HTML report is fully offline-compatible and self-contained.',
  },
  {
    q: 'What does the AI Explain feature do?',
    a: 'AI Explain sends the pseudo-C code of a selected function to the Anthropic Claude API and streams back a plain-English explanation of what the firmware function does. This requires an ANTHROPIC_API_KEY configured in the backend .env file.',
  },
  {
    q: 'What are interpreted runtimes on microcontrollers?',
    a: 'Interpreted runtimes (like MicroPython, CircuitPython, NodeMCU Lua, and Espruino JavaScript) run plain-text scripts directly from a flash file system instead of executing pre-compiled binary machine code. BININO detects these and launches the File Browser so you can inspect script files directly rather than extracting the huge compiled runtime interpreter binary.',
  },
  {
    q: 'How does Smart Runtime Detection work?',
    a: 'Upon connection, BININO pauses the terminal logger and writes short probe sequences (like REPL reset keys Ctrl+C/Ctrl+D, Lua triggers, JS queries, and AT synchronization requests) to the serial TX line. It listens to the incoming RX line for 3 seconds. The decoded traffic is sent to the backend endpoint, which runs a regex signature match to recognize the runtime environment.',
  },
  {
    q: 'Is script code sent to the AI secure?',
    a: 'Yes. When you click \'Explain script\' in the File Browser, only the specific file script text you are currently viewing is transmitted to the Anthropic API via your local FastAPI server. The rest of the filesystem remains entirely offline.',
  },
  {
    q: 'Is BININO open source?',
    a: 'Yes. BININO is fully open-source and available on GitHub at github.com/chandansaipavanpadala/binino. Contributions, issues, and pull requests are welcome.',
  },
];

const FAQItem: React.FC<{ q: string; a: string; isOpen: boolean; onToggle: () => void }> = ({ q, a, isOpen, onToggle }) => (
  <div
    className="transition-all duration-200"
    style={{ borderBottom: '1px solid var(--border-subtle)' }}
  >
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-4 px-1 text-left transition-colors"
      style={{ color: isOpen ? 'var(--text-primary)' : 'var(--text-secondary)' }}
    >
      <span className="text-sm font-medium pr-4">{q}</span>
      <ChevronDown
        className="h-4 w-4 shrink-0 transition-transform duration-300"
        style={{
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          color: 'var(--text-muted)',
        }}
      />
    </button>
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        maxHeight: isOpen ? '300px' : '0px',
        opacity: isOpen ? 1 : 0,
      }}
    >
      <p
        className="pb-4 px-1 text-[13px] leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {a}
      </p>
    </div>
  </div>
);

export const FAQ: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="w-full px-6 py-4 flex items-center space-x-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded transition-colors hover:opacity-80"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center space-x-2">
          <HelpCircle className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <h1 className="text-base font-semibold">Frequently Asked Questions</h1>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10">
        <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          Common questions about BININO's hardware bridge, firmware extraction pipeline, Ghidra decompilation, and deployment.
        </p>

        <div>
          {faqData.map((item, i) => (
            <FAQItem
              key={i}
              q={item.q}
              a={item.a}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </main>

      {/* Bottom */}
      <div className="py-6 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Can't find an answer? Open an issue on{' '}
        <a
          href="https://github.com/chandansaipavanpadala/binino/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          GitHub
        </a>
        .
      </div>
    </div>
  );
};

export default FAQ;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Cpu, Zap, Shield, Code, ArrowRight, Github, BookOpen, HelpCircle } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setIsDemoMode, isBrowserSupported } = useAppContext();

  const handleDemo = () => {
    setIsDemoMode(true);
    navigate('/dashboard');
  };

  const features = [
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Hardware Bridge',
      description: 'Connect directly to ESP32, ARM Cortex, AVR, and RISC-V microcontrollers via Web Serial for real-time firmware extraction.',
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: 'Ghidra Decompiler',
      description: 'Automated headless Ghidra analysis pipeline reconstructs pseudo-C, assembly, symbols, and string tables from raw binary.',
    },
    {
      icon: <Code className="h-5 w-5" />,
      title: 'AI Code Explorer',
      description: 'IDE-style multi-pane viewer with syntax-highlighted decompiled code, hex dump, global search, and Claude-powered explanations.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Top Nav */}
      <nav className="w-full px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <Cpu className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </div>
          <span className="text-lg font-bold tracking-wider" style={{ fontFamily: 'var(--font-ui)' }}>
            BININO<span style={{ color: 'var(--text-muted)' }}>.</span>
          </span>
        </div>

        <div className="flex items-center space-x-5">
          <button onClick={() => navigate('/manual')} className="flex items-center space-x-1.5 text-xs font-medium transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
            <BookOpen className="h-3.5 w-3.5" />
            <span>Docs</span>
          </button>
          <button onClick={() => navigate('/faq')} className="flex items-center space-x-1.5 text-xs font-medium transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
            <HelpCircle className="h-3.5 w-3.5" />
            <span>FAQ</span>
          </button>
          <a href="https://github.com/chandansaipavanpadala/binino" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1.5 text-xs font-medium transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
            <Github className="h-3.5 w-3.5" />
            <span>GitHub</span>
          </a>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 md:py-12">
        <div className="max-w-2xl text-center space-y-4 md:space-y-5">
          {/* Version badge */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-[11px] font-mono tracking-wide" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--status-live)' }}></span>
            <span>v2.0.4 — Production Release</span>
          </div>

          {/* Wordmark */}
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-wider leading-tight" style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-primary)' }}>
            BININO
          </h1>

          {/* Tagline */}
          <p className="text-base md:text-lg leading-relaxed max-w-lg mx-auto" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
            Browser-based firmware extraction and reverse engineering toolkit. Extract, decompile, and analyse microcontroller flash memory — entirely from your browser.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="group flex items-center space-x-2 px-6 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 hover:translate-y-[-1px]"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-base)' }}
            >
              <Cpu className="h-4 w-4" />
              <span>Connect Device</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              onClick={handleDemo}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-y-[-1px]"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            >
              <Zap className="h-4 w-4" />
              <span>Try Demo Mode</span>
            </button>
          </div>

          {/* Browser compat warning */}
          {!isBrowserSupported && (
            <div className="mt-6 px-4 py-3 rounded-md text-xs text-left flex items-start space-x-2" style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--status-warn)' }}>
              <Shield className="h-4 w-4 shrink-0 mt-0.5" />
              <span>The Web Serial API is not supported in this browser. Use Chrome, Edge, or Opera for hardware connectivity. Demo mode is always available.</span>
            </div>
          )}
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full mt-8 md:mt-10 px-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="p-5 rounded-lg transition-all duration-300 hover:translate-y-[-2px]"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="mb-3 p-2 rounded-md inline-flex" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--accent)' }}>
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer (inline on landing) */}
      <footer className="py-4 px-6 flex items-center justify-between text-[10px]" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
        <span>BININO v2.0.4</span>
        <span>Built by Chandan Sai Pavan Padala</span>
        <a href="https://github.com/chandansaipavanpadala/binino" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 hover:opacity-80 transition-opacity" style={{ color: 'var(--text-muted)' }}>
          <Github className="h-3 w-3" />
          <span>Star on GitHub</span>
        </a>
      </footer>
    </div>
  );
};

export default LandingPage;

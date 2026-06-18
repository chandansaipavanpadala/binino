import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Cpu, Github, HelpCircle } from 'lucide-react';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { isDemoMode, setIsDemoMode } = useAppContext();

  return (
    <header
      className="w-full flex items-center justify-between px-6 select-none bg-[#111111]"
      style={{
        height: '48px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Left: Brand & Version */}
      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
        <div
          className="p-1 rounded flex items-center justify-center bg-[#1A1A1A]"
          style={{ border: '1px solid var(--border-subtle)' }}
        >
          <Cpu className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        </div>
        <span className="text-sm font-semibold tracking-tight font-sans text-[#F0F0F0]">
          Binino<span style={{ color: 'var(--text-muted)' }}>.</span>
        </span>
        <span
          className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-[#1A1A1A] text-[#888888]"
          style={{ border: '1px solid var(--border-subtle)' }}
        >
          v1.0.0
        </span>
      </div>

      {/* Right: Controls & Navigation */}
      <div className="flex items-center space-x-3">
        {/* Demo Mode Toggle */}
        <button
          onClick={() => setIsDemoMode(!isDemoMode)}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-all duration-150"
          style={{
            backgroundColor: isDemoMode ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
            border: `1px solid ${isDemoMode ? 'var(--accent)' : 'var(--border-subtle)'}`,
            color: isDemoMode ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
          title="Toggle Hardware Simulation Mode"
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: isDemoMode ? 'var(--status-live)' : 'var(--text-muted)',
              boxShadow: isDemoMode ? '0 0 4px var(--status-live)' : 'none',
            }}
          />
          <span>Demo Mode</span>
        </button>

        {/* Separator */}
        <div className="w-[1px] h-4" style={{ backgroundColor: 'var(--border-subtle)' }} />

        {/* User Manual Button */}
        <button
          onClick={() => navigate('/manual')}
          className="p-1 rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
          title="User Manual"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* GitHub Link */}
        <a
          href="https://github.com/chandansaipavanpadala/binino"
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
          title="GitHub Repository"
        >
          <Github className="h-4 w-4" />
        </a>
      </div>
    </header>
  );
};

export default Navbar;

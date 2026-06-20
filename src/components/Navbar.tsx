import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Cpu, Github, HelpCircle } from 'lucide-react';
import { APP_VERSION } from '../utils/version';
import { getBackendUrl } from '../utils/backend';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { isDemoMode, setIsDemoMode, connectionStatus, extractionStatus } = useAppContext();

  const [serverOnline, setServerOnline] = useState<boolean>(false);

  useEffect(() => {
    const checkServer = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      try {
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/`, { 
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        setServerOnline(res.ok);
      } catch (_) {
        clearTimeout(timeoutId);
        setServerOnline(false);
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, []);

  const isDisableToggle = (!isDemoMode && connectionStatus === 'connected') || extractionStatus === 'reading';
  const tooltipText = isDisableToggle
    ? "Disconnect device before switching to Demo Mode."
    : "Toggle Hardware Simulation Mode";

  return (
    <header
      className="w-full flex items-center justify-between px-6 select-none bg-[#111111]"
      style={{
        height: '48px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Left: Brand & Version */}
      <div
        className="flex items-center space-x-3 cursor-pointer"
        onClick={() => {
          setIsDemoMode(false);
          navigate('/');
        }}
      >
        <div
          className="p-1 rounded flex items-center justify-center bg-[#1A1A1A]"
          style={{ border: '1px solid var(--border-subtle)' }}
        >
          <Cpu className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        </div>
        <span className="text-sm font-bold tracking-wider font-sans text-[#F0F0F0]">
          BININO<span style={{ color: 'var(--text-muted)' }}>.</span>
        </span>
        <span
          className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-[#1A1A1A] text-[#888888]"
          style={{ border: '1px solid var(--border-subtle)' }}
        >
          v{APP_VERSION}
        </span>
      </div>

      {/* Right: Controls & Navigation */}
      <div className="flex items-center space-x-3">
        {/* Server Status Indicator */}
        <div 
          className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-medium rounded border select-none transition-all duration-150 cursor-pointer hover:opacity-85 active:scale-95"
          style={{
            borderColor: serverOnline ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
            backgroundColor: serverOnline ? 'rgba(74, 222, 128, 0.04)' : 'rgba(248, 113, 113, 0.04)',
            color: serverOnline ? 'var(--status-live)' : 'var(--status-error)',
          }}
          title={serverOnline ? "Backend Decompiler Server is active. Click to configure IP." : "Backend Decompiler Server is unreachable. Click to configure IP."}
          onClick={() => {
            const currentUrl = localStorage.getItem('binino_backend_url') || 'http://localhost:8000';
            const newUrl = prompt('Enter your Backend Server URL:', currentUrl);
            if (newUrl !== null) {
              const trimmed = newUrl.trim();
              if (trimmed) {
                localStorage.setItem('binino_backend_url', trimmed);
              } else {
                localStorage.removeItem('binino_backend_url');
              }
              window.location.reload();
            }
          }}
        >
          <span 
            className="w-1.5 h-1.5 rounded-full" 
            style={{ 
              backgroundColor: serverOnline ? 'var(--status-live)' : 'var(--status-error)',
              boxShadow: serverOnline ? '0 0 4px var(--status-live)' : 'none'
            }}
          />
          <span>{serverOnline ? 'Server Online' : 'Server Offline'}</span>
        </div>

        {/* Demo Mode Toggle */}
        <button
          onClick={() => {
            if (!isDisableToggle) {
              setIsDemoMode(!isDemoMode);
            }
          }}
          disabled={isDisableToggle}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isDemoMode ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
            border: `1px solid ${isDemoMode ? 'var(--accent)' : 'var(--border-subtle)'}`,
            color: isDemoMode ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
          title={tooltipText}
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

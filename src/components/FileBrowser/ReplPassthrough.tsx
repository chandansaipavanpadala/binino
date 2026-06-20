import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Trash2, Terminal, Send } from 'lucide-react';
import { TerminalLog } from '../../hooks/useSerialPort';

export const ReplPassthrough: React.FC = () => {
  const {
    connectionStatus,
    portRef,
    terminalLogs,
    clearLogs,
    detectedRuntime,
    isDemoMode,
    appendLog
  } = useAppContext();

  const [inputValue, setInputValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const isConnected = connectionStatus === 'connected';

  // Filter logs for DATA level (and INFO comments relating to commands)
  const filteredLogs = terminalLogs.filter(
    (log) => log.level === 'DATA' || log.message.includes('[SmartDetect]') || log.message.includes('Sent:')
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const cmd = inputValue.trim();
    appendLog('INFO', `Sent: ${cmd}`);

    if (isDemoMode) {
      // Demo mode REPL simulator responses
      setTimeout(() => {
        if (cmd === 'help()' || cmd === 'help') {
          appendLog('DATA', '>>> help()\r\nWelcome to MicroPython!\r\nFor online docs visit micropython.org\r\n');
        } else if (cmd.includes('listdir')) {
          appendLog('DATA', ">>> import os; os.listdir('/')\r\n['boot.py', 'main.py', 'lib', 'sensor.py']\r\n");
        } else {
          appendLog('DATA', `>>> ${cmd}\r\nCommand executed in demo environment.\r\n`);
        }
      }, 300);
      setInputValue('');
      return;
    }

    if (!portRef.current || !portRef.current.writable) {
      appendLog('ERROR', 'Serial port write stream not available.');
      return;
    }

    try {
      const writer = portRef.current.writable.getWriter();
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(cmd + '\r\n'));
      writer.releaseLock();
    } catch (err: any) {
      console.error('REPL Write Error:', err);
      appendLog('ERROR', `REPL transmission failed: ${err.message}`);
    }

    setInputValue('');
  };

  const getLevelStyle = (level: TerminalLog['level']) => {
    switch (level) {
      case 'INFO':
        return { color: 'var(--status-info)' };
      case 'WARN':
        return { color: 'var(--status-warn)' };
      case 'ERROR':
        return { color: 'var(--status-error)' };
      case 'DATA':
      default:
        return { color: 'var(--text-secondary)' };
    }
  };

  const promptSymbol = detectedRuntime === 'micropython' || detectedRuntime === 'circuitpython' ? '>>>' : '>';

  return (
    <div 
      className="flex flex-col h-full min-h-0 w-full rounded-lg overflow-hidden bg-[#111111]"
      style={{ border: '1px solid var(--border-subtle)' }}
    >
      {/* Header bar */}
      <div 
        className="flex items-center justify-between px-4 py-2 bg-[#111111]"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center space-x-2">
          <Terminal className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
            Interactive REPL Console ({detectedRuntime})
          </span>
        </div>
        <button
          onClick={clearLogs}
          className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium rounded transition-all duration-150"
          style={{ 
            border: '1px solid var(--border-subtle)', 
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-inset)'
          }}
          title="Clear console logs"
        >
          <Trash2 className="h-3 w-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* Terminal log panel */}
      <div
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-1.5 select-text selection:bg-[rgba(255,255,255,0.08)] selection:text-white"
        style={{ backgroundColor: 'var(--bg-inset)' }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-1" style={{ color: 'var(--text-muted)' }}>
            <span className="font-sans text-xs">REPL Console Active. Connect device and execute commands.</span>
            <span className="text-[10px] font-mono">runtime: {(detectedRuntime || 'compiled').toUpperCase()}</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const levelStyle = getLevelStyle(log.level);
            return (
              <div 
                key={log.id} 
                className="flex items-start space-x-2 py-0.5 px-1 rounded transition-colors duration-150 hover:bg-[#1A1A1A]"
              >
                <span style={{ color: 'var(--text-muted)' }} className="select-none">[{log.timestamp}]</span>
                <span className="flex-1 whitespace-pre-wrap break-all" style={levelStyle}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command prompt form */}
      <form onSubmit={handleSubmit} className="flex items-center bg-[#111111] px-4 py-2 border-t border-[var(--border-subtle)]">
        <span className="font-mono text-xs font-bold mr-2 select-none" style={{ color: 'var(--accent)' }}>
          {promptSymbol}
        </span>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={!isConnected}
          placeholder={isConnected ? "Type REPL command and press Enter..." : "Connect device to interact with REPL..."}
          className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-[#F0F0F0] placeholder:text-[var(--text-muted)] focus:ring-0 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!isConnected || !inputValue.trim()}
          className="ml-2 px-3 py-1 text-xs font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-1"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent)',
          }}
        >
          <Send className="h-3 w-3" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};

export default ReplPassthrough;

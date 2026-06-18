import React, { useEffect, useRef } from 'react';
import { TerminalLog } from '../hooks/useSerialPort';
import { Trash2, Terminal } from 'lucide-react';

interface TerminalPaneProps {
  logs: TerminalLog[];
  clearLogs: () => void;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({ logs, clearLogs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when logs list updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Map levels to color variables
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
            Live Terminal Stream
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
          title="Clear logs"
        >
          <Trash2 className="h-3 w-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* Terminal logs list */}
      <div
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-1.5 select-text selection:bg-[rgba(255,255,255,0.08)] selection:text-white"
        style={{ backgroundColor: 'var(--bg-inset)' }}
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-1" style={{ color: 'var(--text-muted)' }}>
            <span className="font-sans text-xs">No logs generated. Connect a device to start receiving stream data.</span>
            <span className="text-[10px] font-mono">bridge status: IDLE</span>
          </div>
        ) : (
          logs.map((log) => {
            const levelStyle = getLevelStyle(log.level);
            return (
              <div 
                key={log.id} 
                className="flex items-start space-x-2 py-0.5 px-1 rounded transition-colors duration-150 hover:bg-[#1A1A1A]"
              >
                {/* Timestamp */}
                <span style={{ color: 'var(--text-muted)' }} className="select-none">[{log.timestamp}]</span>
                
                {/* Level prefix */}
                <span 
                  className="font-bold select-none min-w-[50px] inline-block"
                  style={levelStyle}
                >
                  {log.level}
                </span>

                {/* Message */}
                <span 
                  className="flex-1 whitespace-pre-wrap break-all"
                  style={levelStyle}
                >
                  {log.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default TerminalPane;

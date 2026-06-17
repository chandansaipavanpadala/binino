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

  // Map levels to color Tailwind classes
  const getLevelColor = (level: TerminalLog['level']) => {
    switch (level) {
      case 'INFO':
        return 'text-[#00FFC8]';
      case 'WARN':
        return 'text-[#FFB347]';
      case 'ERROR':
        return 'text-[#FF4C4C]';
      case 'DATA':
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-[500px] md:h-[600px] bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0A0A0F] border-b border-[#1E1E2E]">
        <div className="flex items-center space-x-2 text-slate-400">
          <Terminal className="h-4 w-4 text-[#00FFC8]" />
          <span className="text-xs font-semibold tracking-wider uppercase">Live Terminal Stream</span>
        </div>
        <button
          onClick={clearLogs}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded-md border border-[#1E1E2E] text-slate-400 hover:text-[#FF4C4C] hover:border-[#FF4C4C]/50 transition-colors"
          title="Clear logs"
        >
          <Trash2 className="h-3 w-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* Terminal logs list */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed space-y-1.5 selection:bg-[#00FFC8]/20 selection:text-[#00FFC8]">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-1">
            <span className="font-sans">No logs generated. Connect a device to start receiving stream data.</span>
            <span className="text-[10px] font-mono text-slate-600">bridge status: IDLE</span>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2 border-b border-transparent hover:bg-[#1E1E2E]/20 py-0.5 px-1 rounded">
              {/* Timestamp */}
              <span className="text-slate-600 select-none">[{log.timestamp}]</span>
              
              {/* Level prefix */}
              <span className={`font-bold select-none min-w-[50px] inline-block ${getLevelColor(log.level)}`}>
                {log.level}
              </span>

              {/* Message */}
              <span className={`flex-1 whitespace-pre-wrap break-all ${getLevelColor(log.level)}`}>
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

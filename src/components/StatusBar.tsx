import React from 'react';
import { useAppContext } from '../context/AppContext';

export const StatusBar: React.FC = () => {
  const { connectionStatus, portInfo, selectedArch, flashBuffer } = useAppContext();

  const isConnected = connectionStatus === 'connected';

  const archLabel: Record<string, string> = {
    esp32: 'ESP32',
    esp8266: 'ESP8266',
    avr: 'AVR',
    cortex: 'Cortex-M',
    riscv: 'RISC-V',
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  return (
    <div
      className="w-full flex items-center justify-between px-4 select-none"
      style={{
        height: '28px',
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'var(--text-muted)',
      }}
    >
      {/* Left: connection status */}
      <div className="flex items-center space-x-2">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: isConnected ? 'var(--status-live)' : 'var(--status-error)',
            boxShadow: isConnected ? '0 0 6px rgba(74,222,128,0.4)' : 'none',
          }}
        />
        <span style={{ color: 'var(--text-secondary)' }}>
          {isConnected && portInfo ? portInfo.displayName : 'No device'}
        </span>
      </div>

      {/* Center: arch + flash */}
      <div className="flex items-center space-x-3">
        <span>{archLabel[selectedArch] || selectedArch}</span>
        {flashBuffer && (
          <>
            <span style={{ color: 'var(--border-strong)' }}>•</span>
            <span>{formatSize(flashBuffer.length)}</span>
          </>
        )}
      </div>

      {/* Right: version */}
      <span>Binino v1.0.0</span>
    </div>
  );
};

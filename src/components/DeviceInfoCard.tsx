import React from 'react';
import { ConnectionStatus, PortMetadata } from '../hooks/useSerialPort';
import { Info } from 'lucide-react';

interface DeviceInfoCardProps {
  connectionStatus: ConnectionStatus;
  portInfo: PortMetadata | null;
  selectedArch: string;
  selectedBaud: number;
  connectionTimestamp: string | null;
}

export const DeviceInfoCard: React.FC<DeviceInfoCardProps> = ({
  connectionStatus,
  portInfo,
  selectedArch,
  selectedBaud,
  connectionTimestamp,
}) => {
  const isConnected = connectionStatus === 'connected';

  // Format arch label for display
  const getArchLabel = (arch: string) => {
    const archMap: Record<string, string> = {
      esp32: 'ESP32 (Tensilica)',
      esp8266: 'ESP8266 (L106)',
      rp2040: 'RP2040 (Cortex-M0+)',
      avr: 'AVR / ATmega',
      cortex: 'ARM Cortex-M',
      riscv: 'RISC-V 32-bit',
    };
    return archMap[arch] || arch;
  };

  return (
    <div 
      className="rounded-lg p-5 flex flex-col space-y-4 bg-[#111111]"
      style={{ border: '1px solid var(--border-subtle)' }}
    >
      <div 
        className="flex items-center space-x-2 pb-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Info className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
        <h2 className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
          Device Metadata
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs font-sans">
        <div>
          <span className="block mb-0.5 text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Port Name</span>
          <span className="font-mono block truncate" style={{ color: 'var(--text-primary)' }} title={isConnected && portInfo ? portInfo.displayName : ''}>
            {isConnected && portInfo ? portInfo.displayName : '—'}
          </span>
        </div>
        <div>
          <span className="block mb-0.5 text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Architecture</span>
          <span className="font-medium block" style={{ color: 'var(--text-primary)' }}>
            {isConnected ? getArchLabel(selectedArch) : '—'}
          </span>
        </div>
        <div>
          <span className="block mb-0.5 text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Baud Rate</span>
          <span className="font-mono block" style={{ color: 'var(--text-primary)' }}>
            {isConnected ? `${selectedBaud} bps` : '—'}
          </span>
        </div>
        <div>
          <span className="block mb-0.5 text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Bridge Time</span>
          <span className="font-mono block" style={{ color: 'var(--text-primary)' }}>
            {isConnected && connectionTimestamp ? connectionTimestamp : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DeviceInfoCard;

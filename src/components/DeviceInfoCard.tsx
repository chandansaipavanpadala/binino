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
      avr: 'AVR / ATmega',
      cortex: 'ARM Cortex-M',
      riscv: 'RISC-V 32-bit',
    };
    return archMap[arch] || arch;
  };

  return (
    <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg p-5 flex flex-col space-y-4">
      <div className="flex items-center space-x-2 border-b border-[#1E1E2E] pb-3">
        <Info className="h-4 w-4 text-[#00FFC8]" />
        <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">
          Device Metadata
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs font-sans">
        <div>
          <span className="block text-slate-500 mb-0.5">Port Name</span>
          <span className="font-mono text-slate-200 block truncate" title={isConnected && portInfo ? portInfo.displayName : ''}>
            {isConnected && portInfo ? portInfo.displayName : '—'}
          </span>
        </div>
        <div>
          <span className="block text-slate-500 mb-0.5">Architecture</span>
          <span className="font-medium text-slate-200 block">
            {isConnected ? getArchLabel(selectedArch) : '—'}
          </span>
        </div>
        <div>
          <span className="block text-slate-500 mb-0.5">Baud Rate</span>
          <span className="font-mono text-slate-200 block">
            {isConnected ? `${selectedBaud} bps` : '—'}
          </span>
        </div>
        <div>
          <span className="block text-slate-500 mb-0.5">Bridge Time</span>
          <span className="font-mono text-slate-200 block">
            {isConnected && connectionTimestamp ? connectionTimestamp : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

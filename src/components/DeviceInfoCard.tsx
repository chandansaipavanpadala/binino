import React from 'react';
import { ConnectionStatus, PortMetadata } from '../hooks/useSerialPort';
import { Info } from 'lucide-react';
import { MCU_REGISTRY } from '../utils/mcuRegistry';
import { useAppContext } from '../context/AppContext';

interface DeviceInfoCardProps {
  connectionStatus: ConnectionStatus;
  portInfo: PortMetadata | null;
  selectedArch: string;
  selectedBaud: number;
  connectionTimestamp: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}

export const DeviceInfoCard: React.FC<DeviceInfoCardProps> = ({
  connectionStatus,
  portInfo,
  selectedArch,
  selectedBaud,
  connectionTimestamp,
  isExpanded,
  onToggle,
}) => {
  const isConnected = connectionStatus === 'connected';
  const isCollapsed = !isExpanded;

  const { detectStatus, detectedRuntime, runtimeVersion, confidence, extractionStatus } = useAppContext();
  const selectedMcu = MCU_REGISTRY[selectedArch];
  const protocol = selectedMcu ? selectedMcu.protocol : '—';

  // Format arch label for display
  const getArchLabel = (arch: string) => {
    const mcu = MCU_REGISTRY[arch];
    return mcu ? mcu.display_name : arch;
  };

  return (
    <div 
      className="rounded-lg p-5 flex flex-col bg-[#111111]"
      style={{ border: '1px solid var(--border-subtle)' }}
    >
      <div 
        onClick={onToggle}
        className="flex items-center justify-between cursor-pointer select-none pb-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center space-x-2">
          <Info className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          <h2 className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
            Device Metadata
          </h2>
          {isConnected && (extractionStatus === 'syncing' || extractionStatus === 'reading' || detectedRuntime === 'bootloader') && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">
              BOOTLOADER MODE
            </span>
          )}
        </div>

        {/* Collapse/Expand Toggle chevron trigger */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-1 rounded hover:bg-[#222222] transition-colors duration-150"
          style={{ color: 'var(--text-secondary)' }}
          title={isCollapsed ? "Expand Device Metadata" : "Collapse Device Metadata"}
          aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          <svg 
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isCollapsed ? '0px' : '300px',
          opacity: isCollapsed ? 0 : 1,
          pointerEvents: isCollapsed ? 'none' : 'auto',
        }}
      >
        <div className="pt-4 grid grid-cols-2 gap-4 text-xs font-sans">
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
            <span className="block mb-0.5 text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Protocol</span>
            <span className="font-mono block" style={{ color: 'var(--text-primary)' }}>
              {isConnected ? protocol : '—'}
            </span>
          </div>
          <div>
            <span className="block mb-0.5 text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Baud Rate</span>
            <span className="font-mono block" style={{ color: 'var(--text-primary)' }}>
              {isConnected ? (selectedBaud === 0 ? 'N/A (USB CDC)' : `${selectedBaud} bps`) : '—'}
            </span>
          </div>
          <div>
            <span className="block mb-0.5 text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Bridge Time</span>
            <span className="font-mono block" style={{ color: 'var(--text-primary)' }}>
              {isConnected && connectionTimestamp ? connectionTimestamp : '—'}
            </span>
          </div>
          {isConnected && detectStatus === 'detected' && detectedRuntime !== 'compiled' && (
            <>
              <div>
                <span className="block mb-0.5 text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Runtime</span>
                <span className="font-mono block font-semibold text-amber-500 uppercase tracking-wide">
                  {detectedRuntime} {runtimeVersion ? `v${runtimeVersion}` : ''}
                </span>
              </div>
              <div>
                <span className="block mb-0.5 text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Confidence</span>
                <span className="font-mono block uppercase text-[10px] font-semibold" style={{ color: confidence === 'high' ? 'var(--status-live)' : confidence === 'medium' ? 'var(--status-warn)' : 'var(--status-error)' }}>
                  {confidence}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceInfoCard;

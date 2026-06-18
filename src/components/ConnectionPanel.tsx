import React, { useState, useEffect, useMemo } from 'react';
import { ConnectionStatus } from '../hooks/useSerialPort';
import { ExtractionStatus } from '../hooks/useFlashExtractor';
import { ExtractionPanel } from './ExtractionPanel';
import { RefreshCw, Play, Square, AlertTriangle } from 'lucide-react';
import { MCU_REGISTRY, MCUProfile } from '../utils/mcuRegistry';
import { useAppContext } from '../context/AppContext';

interface ConnectionPanelProps {
  connectionStatus: ConnectionStatus;
  selectedArch: string;
  setSelectedArch: (arch: string) => void;
  selectedBaud: number;
  setSelectedBaud: (baud: number) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Phase 2 extraction props
  isDemoMode: boolean;
  extractionStatus: ExtractionStatus;
  bytesRead: number;
  totalBytes: number;
  progressPercent: number;
  downloadBin: () => void;
  cancelExtraction: () => void;
  startExtraction: (arch: string, targetSize: number) => Promise<void>;
  flashBuffer: Uint8Array | null;
  isBrowserSupported?: boolean;
  // Accordion props
  isHardwareExpanded: boolean;
  onToggleHardware: () => void;
  isExtractorExpanded: boolean;
  onToggleExtractor: () => void;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  connectionStatus,
  selectedArch,
  setSelectedArch,
  selectedBaud,
  setSelectedBaud,
  connect,
  disconnect,
  isDemoMode,
  extractionStatus,
  bytesRead,
  totalBytes,
  progressPercent,
  downloadBin,
  cancelExtraction,
  startExtraction,
  flashBuffer,
  isBrowserSupported = true,
  isHardwareExpanded,
  onToggleHardware,
  isExtractorExpanded,
  onToggleExtractor,
}) => {
  const isCollapsed = !isHardwareExpanded;
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  const { detectStatus, detectionMessage } = useAppContext();
  const [mcuList, setMcuList] = useState<Record<string, MCUProfile>>(MCU_REGISTRY);

  // Fetch MCU registry dynamically from backend, fall back to local import on error
  useEffect(() => {
    fetch('http://localhost:8000/api/mcu/list')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch MCU list');
        return res.json();
      })
      .then((data) => {
        if (data && data.mcus) {
          setMcuList(data.mcus);
        }
      })
      .catch((err) => {
        console.warn('Backend MCU registry unavailable. Using local fallback.', err);
        setMcuList(MCU_REGISTRY);
      });
  }, []);

  const selectedMcu = mcuList[selectedArch] || MCU_REGISTRY[selectedArch];

  // Group MCUs by family
  const groupedMcus = useMemo(() => {
    const groups: Record<string, MCUProfile[]> = {};
    Object.values(mcuList).forEach((mcu) => {
      if (!groups[mcu.family]) {
        groups[mcu.family] = [];
      }
      groups[mcu.family].push(mcu);
    });
    return groups;
  }, [mcuList]);

  const handleArchChange = (arch: string) => {
    setSelectedArch(arch);
    const mcu = mcuList[arch];
    if (mcu) {
      setSelectedBaud(mcu.default_baud);
    }
  };
  
  const getStatusDetails = () => {
    if (connectionStatus === 'connected' && detectStatus === 'probing') {
      return { label: 'Probing...', color: 'var(--status-warn)' };
    }
    switch (connectionStatus) {
      case 'connected':
        return { label: 'Live', color: 'var(--status-live)' };
      case 'connecting':
        return { label: 'Connecting', color: 'var(--status-warn)' };
      case 'error':
        return { label: 'Connection Error', color: 'var(--status-error)' };
      case 'idle':
      default:
        return { label: 'Disconnected', color: 'var(--text-muted)' };
    }
  };

  const status = getStatusDetails();

  return (
    <div className="flex flex-col space-y-4">
      <div 
        className="rounded-lg p-5 flex flex-col bg-[#111111]"
        style={{ border: '1px solid var(--border-subtle)' }}
      >
        <div 
          onClick={onToggleHardware}
          className="flex items-center justify-between cursor-pointer select-none pb-3"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <h2 className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
            Hardware Control
          </h2>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {/* Status Indicator Dot */}
              <span className="relative flex h-2 w-2">
                {connectionStatus !== 'idle' && connectionStatus !== 'error' && (
                  <span 
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: status.color }}
                  />
                )}
                <span 
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ 
                    backgroundColor: status.color,
                    boxShadow: isConnected ? `0 0 6px ${status.color}` : 'none'
                  }}
                />
              </span>
              <span className="text-xs font-medium font-sans text-[#F0F0F0]">
                {status.label}
              </span>
            </div>

            {/* Collapse/Expand Toggle chevron trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleHardware();
              }}
              className="p-1 rounded hover:bg-[#222222] transition-colors duration-150"
              style={{ color: 'var(--text-secondary)' }}
              title={isCollapsed ? "Expand Hardware Control" : "Collapse Hardware Control"}
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
        </div>

        <div
          className="transition-all duration-300 ease-in-out overflow-hidden"
          style={{
            maxHeight: isCollapsed ? '0px' : '550px',
            opacity: isCollapsed ? 0 : 1,
            pointerEvents: isCollapsed ? 'none' : 'auto',
          }}
        >
          <div className="pt-4 space-y-3.5">
            {/* Architecture Selector */}
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="arch-select" className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                Microcontroller Architecture
              </label>
              <select
                id="arch-select"
                value={selectedArch}
                onChange={(e) => handleArchChange(e.target.value)}
                disabled={isConnected || isConnecting}
                className="w-full h-9 px-3 py-1.5 rounded text-xs font-sans text-[#F0F0F0] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-inset)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {Object.entries(groupedMcus).map(([family, mcus]) => (
                  <optgroup key={family} label={family} style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                    {mcus.map((mcu) => (
                      <option 
                        key={mcu.mcu_id} 
                        value={mcu.mcu_id}
                        disabled={mcu.supported === false}
                      >
                        {mcu.display_name} {mcu.requires_tool ? ' (requires tool)' : ''} {mcu.supported === false ? ' (coming soon)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Tool Warning if required */}
            {selectedMcu && selectedMcu.requires_tool && (
              <div 
                className="flex items-center space-x-2 p-2 rounded text-[11px] font-sans text-amber-500 bg-amber-500/5 border border-amber-500/20"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>Requires external tool: <strong>{selectedMcu.requires_tool}</strong> for extraction</span>
              </div>
            )}

            {/* Bootloader Note */}
            {selectedMcu && selectedMcu.bootloader_note && (
              <div 
                className="p-2.5 rounded text-[10px] font-sans leading-relaxed text-[#A0A0A0]"
                style={{ 
                  backgroundColor: 'var(--bg-inset)', 
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span className="block font-semibold uppercase tracking-wider text-[9px] mb-1 text-amber-500">Bootloader Note</span>
                {selectedMcu.bootloader_note}
              </div>
            )}

            {/* Smart Detection Probing Status */}
            {isConnected && detectStatus === 'probing' && (
              <div 
                className="flex items-center space-x-2.5 p-3 rounded text-[11px] font-sans bg-amber-500/5 border border-amber-500/20 text-[#E0E0E0]"
              >
                <RefreshCw className="h-4 w-4 animate-spin text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block font-semibold uppercase tracking-wider text-[9px] text-amber-500 mb-0.5">Smart Probing Active</span>
                  <p className="truncate text-[#CCCCCC]">{detectionMessage || 'Testing REPL, Lua, JS and AT prompts...'}</p>
                </div>
              </div>
            )}

            {/* Baud Rate Selector */}
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="baud-select" className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                Baud Rate (bps)
              </label>
              <select
                id="baud-select"
                value={selectedBaud}
                onChange={(e) => setSelectedBaud(Number(e.target.value))}
                disabled={isConnected || isConnecting || selectedMcu?.default_baud === 0}
                className="w-full h-9 px-3 py-1.5 rounded text-xs font-sans text-[#F0F0F0] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-inset)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {selectedMcu?.default_baud === 0 ? (
                  <option value="0">N/A (USB-only)</option>
                ) : (
                  <>
                    <option value="1200">1200 bps</option>
                    <option value="9600">9600 bps</option>
                    <option value="19200">19200 bps</option>
                    <option value="38400">38400 bps</option>
                    <option value="57600">57600 bps</option>
                    <option value="115200">115200 bps</option>
                    <option value="230400">230400 bps</option>
                    <option value="460800">460800 bps</option>
                  </>
                )}
              </select>
            </div>

            {/* Control Actions */}
            <div className="flex flex-col space-y-2 pt-2">
              {isConnected ? (
                <button
                  onClick={() => disconnect()}
                  className="w-full h-9 flex items-center justify-center space-x-2 text-xs font-semibold rounded transition-all duration-150 hover:opacity-90"
                  style={{
                    border: '1px solid var(--status-error)',
                    color: 'var(--status-error)',
                    backgroundColor: 'rgba(248, 113, 113, 0.05)',
                  }}
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Disconnect Link</span>
                </button>
              ) : (
                <button
                  onClick={connect}
                  disabled={isConnecting}
                  className="w-full h-9 flex items-center justify-center space-x-2 text-xs font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--bg-base)',
                  }}
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Establishing Bridge...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      <span>Establish Bridge</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Extraction Section (Phase 2) */}
      <ExtractionPanel
        connectionStatus={connectionStatus}
        selectedArch={selectedArch}
        isDemoMode={isDemoMode}
        extractionStatus={extractionStatus}
        bytesRead={bytesRead}
        totalBytes={totalBytes}
        progressPercent={progressPercent}
        downloadBin={downloadBin}
        cancelExtraction={cancelExtraction}
        startExtraction={startExtraction}
        flashBuffer={flashBuffer}
        isBrowserSupported={isBrowserSupported}
        isExpanded={isExtractorExpanded}
        onToggle={onToggleExtractor}
        flashSizes={selectedMcu?.flash_sizes}
        defaultFlashSize={selectedMcu?.default_flash_size}
      />
    </div>
  );
};

export default ConnectionPanel;

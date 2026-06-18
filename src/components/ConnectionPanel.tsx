import React from 'react';
import { ConnectionStatus } from '../hooks/useSerialPort';
import { ExtractionStatus } from '../hooks/useFlashExtractor';
import { ExtractionPanel } from './ExtractionPanel';
import { RefreshCw, Play, Square } from 'lucide-react';

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
  
  const getStatusDetails = () => {
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
  const isConnecting = connectionStatus === 'connecting';

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
            maxHeight: isCollapsed ? '0px' : '400px',
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
                onChange={(e) => setSelectedArch(e.target.value)}
                disabled={isConnected || isConnecting}
                className="w-full h-9 px-3 py-1.5 rounded text-xs font-sans text-[#F0F0F0] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-inset)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <option value="esp32">ESP32 (WROOM / WROVER)</option>
                <option value="esp8266">ESP8266 (EX / NodeMCU)</option>
                <option value="rp2040">Raspberry Pi Pico (RP2040 ARM Cortex-M0+)</option>
                <option value="avr">AVR / Arduino (ATmega328P)</option>
                <option value="cortex">ARM Cortex-M (STM32 / NXP)</option>
                <option value="riscv">RISC-V (CH32 / ESP32-C3)</option>
              </select>
            </div>

            {/* Baud Rate Selector */}
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="baud-select" className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                Baud Rate (bps)
              </label>
              <select
                id="baud-select"
                value={selectedBaud}
                onChange={(e) => setSelectedBaud(Number(e.target.value))}
                disabled={isConnected || isConnecting}
                className="w-full h-9 px-3 py-1.5 rounded text-xs font-sans text-[#F0F0F0] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-inset)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <option value="9600">9600 bps</option>
                <option value="57600">57600 bps</option>
                <option value="115200">115200 bps (Default)</option>
                <option value="230400">230400 bps</option>
                <option value="460800">460800 bps</option>
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
      />
    </div>
  );
};

export default ConnectionPanel;

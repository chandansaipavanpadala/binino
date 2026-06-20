import React, { useState, useEffect, useRef } from 'react';
import { ExtractionStatus } from '../hooks/useFlashExtractor';
import { ConnectionStatus } from '../hooks/useSerialPort';
import { Download, Cpu, XCircle, FileUp } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface ExtractionPanelProps {
  connectionStatus: ConnectionStatus;
  selectedArch: string;
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
  isExpanded: boolean;
  onToggle: () => void;
  flashSizes?: number[];
  defaultFlashSize?: number;
}

export const ExtractionPanel: React.FC<ExtractionPanelProps> = ({
  connectionStatus,
  selectedArch,
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
  isExpanded,
  onToggle,
  flashSizes,
  defaultFlashSize,
}) => {
  const [selectedSize, setSelectedSize] = useState<number>(defaultFlashSize || 0x400000); // Default 4MB
  const isCollapsed = !isExpanded;
  
  const { loadBinary } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        const buffer = new Uint8Array(reader.result);
        loadBinary(buffer);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Sync selected size with selected MCU defaults
  useEffect(() => {
    if (defaultFlashSize !== undefined) {
      setSelectedSize(defaultFlashSize);
    }
  }, [defaultFlashSize]);

  // ETA and Speed calculations state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [eta, setEta] = useState<number | null>(null);

  // Monitor read session for speed / ETA computation
  useEffect(() => {
    if (extractionStatus === 'reading') {
      if (startTime === null) {
        setStartTime(Date.now());
      } else {
        const elapsed = (Date.now() - startTime) / 1000; // in seconds
        if (elapsed > 0.5 && bytesRead > 0) {
          const currentSpeed = bytesRead / elapsed; // bytes/sec
          setSpeed(currentSpeed);
          const remaining = totalBytes - bytesRead;
          setEta(currentSpeed > 0 ? Math.round(remaining / currentSpeed) : 0);
        }
      }
    } else {
      setStartTime(null);
      setSpeed(0);
      setEta(null);
    }
  }, [bytesRead, extractionStatus, totalBytes, startTime]);

  const isRunning = extractionStatus === 'syncing' || extractionStatus === 'reading';
  const isConnected = connectionStatus === 'connected';

  // Toggle button availability
  const isExtractDisabled = (!isConnected && !isDemoMode) || isRunning || !isBrowserSupported;

  // Helper to format bytes to readable size
  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024) {
      return `${bytes / (1024 * 1024)} MB`;
    }
    if (bytes >= 1024) {
      return `${bytes / 1024} KB`;
    }
    return `${bytes} B`;
  };

  const finalFlashSizes = flashSizes && flashSizes.length > 0 
    ? flashSizes 
    : [0x100000, 0x200000, 0x400000, 0x800000, 0x1000000];

  // Helper: format speed output string
  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec >= 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    if (bytesPerSec >= 1024) {
      return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    }
    return `${bytesPerSec.toFixed(0)} B/s`;
  };

  // Helper: format ETA output string
  const formatEta = (seconds: number | null): string => {
    if (seconds === null) return '—';
    if (seconds >= 60) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}m ${s}s`;
    }
    return `${seconds}s`;
  };

  // Badge layouts based on extractionStatus
  const getBadgeDetails = () => {
    switch (extractionStatus) {
      case 'syncing':
        return { 
          label: 'Syncing', 
          style: { backgroundColor: 'rgba(245, 158, 11, 0.05)', borderColor: 'var(--status-warn)', color: 'var(--status-warn)' },
          class: 'animate-pulse'
        };
      case 'reading':
        return { 
          label: 'Reading ROM', 
          style: { backgroundColor: 'rgba(232, 232, 232, 0.05)', borderColor: 'var(--accent)', color: 'var(--text-primary)' },
          class: 'animate-pulse'
        };
      case 'done':
        return { 
          label: 'Dump Success', 
          style: { backgroundColor: 'rgba(74, 222, 128, 0.05)', borderColor: 'var(--status-live)', color: 'var(--status-live)' },
          class: ''
        };
      case 'error':
        return { 
          label: 'Dump Failed', 
          style: { backgroundColor: 'rgba(248, 113, 113, 0.05)', borderColor: 'var(--status-error)', color: 'var(--status-error)' },
          class: ''
        };
      case 'idle':
      default:
        return { 
          label: 'Idle', 
          style: { backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' },
          class: ''
        };
    }
  };

  const badge = getBadgeDetails();

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
          <Cpu className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          <h2 className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
            Flash Extractor
          </h2>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Status Badge */}
          <span 
            className={`px-2 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider rounded border ${badge.class}`}
            style={badge.style}
          >
            {badge.label}
          </span>

          {/* Collapse/Expand Toggle chevron trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="p-1 rounded hover:bg-[#222222] transition-colors duration-150"
            style={{ color: 'var(--text-secondary)' }}
            title={isCollapsed ? "Expand Flash Extractor" : "Collapse Flash Extractor"}
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
          maxHeight: isCollapsed ? '0px' : '500px',
          opacity: isCollapsed ? 0 : 1,
          pointerEvents: isCollapsed ? 'none' : 'auto',
        }}
      >
        <div className="pt-4 space-y-4">
          {/* Select Flash size */}
          <div className="flex flex-col space-y-1.5">
            <label htmlFor="flash-size" className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Target Flash Memory Size
            </label>
            <select
              id="flash-size"
              value={selectedSize}
              onChange={(e) => setSelectedSize(Number(e.target.value))}
              disabled={isRunning}
              className="w-full h-9 px-3 py-1.5 rounded text-xs font-sans text-[#F0F0F0] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-inset)',
                border: '1px solid var(--border-default)',
              }}
            >
              {finalFlashSizes.map((size) => (
                <option key={size} value={size}>
                  {formatBytes(size)} {size === defaultFlashSize ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-col space-y-2">
            {!isRunning ? (
              <div
                title={!isBrowserSupported ? "Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera." : undefined}
                className="w-full"
              >
                <button
                  onClick={() => startExtraction(selectedArch, selectedSize)}
                  disabled={isExtractDisabled}
                  className="w-full h-9 flex items-center justify-center space-x-2 text-xs font-semibold rounded transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: isExtractDisabled ? 'var(--bg-elevated)' : 'var(--accent)',
                    color: isExtractDisabled ? 'var(--text-muted)' : 'var(--bg-base)',
                    border: isExtractDisabled ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Extract Firmware</span>
                </button>
              </div>
            ) : (
              <button
                onClick={cancelExtraction}
                className="w-full h-9 flex items-center justify-center space-x-2 text-xs font-semibold rounded transition-all duration-150"
                style={{
                  border: '1px solid var(--status-error)',
                  color: 'var(--status-error)',
                  backgroundColor: 'rgba(248, 113, 113, 0.05)',
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Cancel Extraction</span>
              </button>
            )}

            {/* Download Trigger */}
            {extractionStatus === 'done' && (
              <button
                onClick={downloadBin}
                className="w-full h-9 flex items-center justify-center space-x-2 text-xs font-semibold rounded transition-all duration-150 hover:opacity-90"
                style={{
                  backgroundColor: 'var(--status-live)',
                  color: 'var(--bg-base)',
                }}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download binino_image.bin</span>
              </button>
            )}

            {/* Offer partial download on error if there's partial data */}
            {extractionStatus === 'error' && flashBuffer && bytesRead > 0 && (
              <button
                onClick={downloadBin}
                className="w-full h-9 flex items-center justify-center space-x-2 text-xs font-semibold rounded transition-all duration-150 hover:opacity-90"
                style={{
                  border: '1px solid var(--status-warn)',
                  color: 'var(--status-warn)',
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                }}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Partial Backup ({Math.round(bytesRead / 1024)}KB)</span>
              </button>
            )}

            {/* Local Binary Upload Bypass */}
            {!isRunning && (
              <div className="pt-3 flex flex-col space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span className="text-[9px] font-mono tracking-wider text-[var(--text-muted)] uppercase">
                  Alternative: Local File
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".bin,.img,.hex"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-9 flex items-center justify-center space-x-2 text-xs font-semibold rounded border border-[var(--border-strong)] bg-[#1A1A1A] hover:bg-[#222222] transition-all duration-150 text-[var(--text-primary)]"
                >
                  <FileUp className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span>Upload Local Binary (.bin)</span>
                </button>
              </div>
            )}
          </div>

          {/* Progress Bar Indicators */}
          {isRunning && (
            <div className="space-y-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {/* Progress fill */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-sans">
                  <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
                  <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{progressPercent}%</span>
                </div>
                <div className="w-full h-1.5 rounded overflow-hidden" style={{ backgroundColor: 'var(--bg-inset)' }}>
                  <div
                    className="h-full transition-all duration-150"
                    style={{ 
                      width: `${progressPercent}%`,
                      backgroundColor: 'var(--accent)',
                    }}
                  ></div>
                </div>
              </div>

              {/* Transfer stats */}
              <div className="grid grid-cols-3 gap-2 text-[9px] font-mono">
                <div>
                  <span className="block text-[8px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Retrieved</span>
                  <span className="block truncate" style={{ color: 'var(--text-primary)' }}>
                    {Math.round(bytesRead / 1024)} KB
                  </span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Throughput</span>
                  <span className="block truncate" style={{ color: 'var(--text-primary)' }}>
                    {extractionStatus === 'reading' ? formatSpeed(speed) : 'Waiting'}
                  </span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>ETA</span>
                  <span className="block truncate" style={{ color: 'var(--text-primary)' }}>
                    {extractionStatus === 'reading' ? formatEta(eta) : 'Estimating'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExtractionPanel;

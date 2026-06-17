import React, { useState, useEffect } from 'react';
import { ExtractionStatus } from '../hooks/useFlashExtractor';
import { ConnectionStatus } from '../hooks/useSerialPort';
import { Download, Cpu, XCircle } from 'lucide-react';


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
}) => {
  const [selectedSize, setSelectedSize] = useState<number>(0x400000); // Default 4MB

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
  const isExtractDisabled = (!isConnected && !isDemoMode) || isRunning;

  // Format size dropdown choices
  const sizeOptions = [
    { label: '1 MB', value: 0x100000 },
    { label: '2 MB', value: 0x200000 },
    { label: '4 MB (Default)', value: 0x400000 },
    { label: '8 MB', value: 0x800000 },
    { label: '16 MB', value: 0x1000000 },
  ];

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
        return { label: 'Syncing', bg: 'bg-[#FFB347]/10 border-[#FFB347] text-[#FFB347] animate-pulse' };
      case 'reading':
        return { label: 'Reading ROM', bg: 'bg-[#00FFC8]/10 border-[#00FFC8] text-[#00FFC8] animate-pulse' };
      case 'done':
        return { label: 'Dump Success', bg: 'bg-[#00FFC8]/10 border-[#00FFC8] text-[#00FFC8]' };
      case 'error':
        return { label: 'Dump Failed', bg: 'bg-[#FF4C4C]/10 border-[#FF4C4C] text-[#FF4C4C]' };
      case 'idle':
      default:
        return { label: 'Idle', bg: 'bg-slate-800/40 border-slate-700 text-slate-400' };
    }
  };

  const badge = getBadgeDetails();

  return (
    <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg p-5 flex flex-col space-y-5">
      <div className="flex items-center justify-between border-b border-[#1E1E2E] pb-3">
        <div className="flex items-center space-x-2">
          <Cpu className="h-4 w-4 text-[#00FFC8]" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">
            Flash Extractor
          </h2>
        </div>
        
        {/* Status Badge */}
        <span className={`px-2 py-0.5 text-[10px] font-sans font-medium uppercase tracking-wider rounded border ${badge.bg}`}>
          {badge.label}
        </span>
      </div>

      {/* Select Flash size */}
      <div className="flex flex-col space-y-1.5">
        <label htmlFor="flash-size" className="text-xs font-medium text-slate-400">
          Target Flash Memory Size
        </label>
        <select
          id="flash-size"
          value={selectedSize}
          onChange={(e) => setSelectedSize(Number(e.target.value))}
          disabled={isRunning}
          className="w-full h-10 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-md text-sm text-slate-200 focus:outline-none focus:border-[#00FFC8] focus:ring-1 focus:ring-[#00FFC8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sizeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-col space-y-2">
        {!isRunning ? (
          <button
            onClick={() => startExtraction(selectedArch, selectedSize)}
            disabled={isExtractDisabled}
            className="w-full h-10 flex items-center justify-center space-x-2 text-sm font-semibold rounded-md bg-[#00FFC8] text-[#0A0A0F] hover:bg-[#00E0B0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Extract Firmware</span>
          </button>
        ) : (
          <button
            onClick={cancelExtraction}
            className="w-full h-10 flex items-center justify-center space-x-2 text-sm font-semibold rounded-md border border-[#FF4C4C] text-[#FF4C4C] hover:bg-[#FF4C4C]/10 transition-colors"
          >
            <XCircle className="h-4 w-4" />
            <span>Cancel Extraction</span>
          </button>
        )}

        {/* Download Trigger */}
        {extractionStatus === 'done' && (
          <button
            onClick={downloadBin}
            className="w-full h-10 flex items-center justify-center space-x-2 text-sm font-semibold rounded-md bg-[#FFB347] text-[#0A0A0F] hover:bg-[#FFA330] transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download binino_image.bin</span>
          </button>
        )}

        {/* Offer partial download on error if there's partial data */}
        {extractionStatus === 'error' && flashBuffer && bytesRead > 0 && (
          <button
            onClick={downloadBin}
            className="w-full h-10 flex items-center justify-center space-x-2 text-sm font-semibold rounded-md border border-[#FFB347] text-[#FFB347] hover:bg-[#FFB347]/10 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download Partial Backup ({Math.round(bytesRead / 1024)}KB)</span>
          </button>
        )}
      </div>

      {/* Progress Bar Indicators */}
      {isRunning && (
        <div className="space-y-3 pt-2">
          {/* Progress fill */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-sans text-slate-400">
              <span>Progress</span>
              <span className="font-mono text-[#00FFC8]">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-[#1E1E2E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00FFC8] transition-all duration-150"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Transfer stats */}
          <div className="grid grid-cols-3 gap-2 border-t border-[#1E1E2E] pt-3 text-[10px] text-slate-400 font-sans">
            <div>
              <span className="block text-slate-500 mb-0.5">Retrieved</span>
              <span className="font-mono text-slate-200 block truncate">
                {Math.round(bytesRead / 1024)} KB
              </span>
            </div>
            <div>
              <span className="block text-slate-500 mb-0.5">Throughput</span>
              <span className="font-mono text-slate-200 block truncate">
                {extractionStatus === 'reading' ? formatSpeed(speed) : 'Waiting'}
              </span>
            </div>
            <div>
              <span className="block text-slate-500 mb-0.5">ETA</span>
              <span className="font-mono text-slate-200 block truncate">
                {extractionStatus === 'reading' ? formatEta(eta) : 'Estimating'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

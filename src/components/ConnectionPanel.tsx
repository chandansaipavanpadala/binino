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
}) => {
  
  // Map connection states to readable labels and dot color classes
  const getStatusDetails = () => {
    switch (connectionStatus) {
      case 'connected':
        return { label: 'Live', dotClass: 'bg-[#00FFC8] shadow-[0_0_8px_#00FFC8]' };
      case 'connecting':
        return { label: 'Connecting', dotClass: 'bg-[#FFB347] shadow-[0_0_8px_#FFB347]' };
      case 'error':
        return { label: 'Connection Error', dotClass: 'bg-[#FF4C4C] shadow-[0_0_8px_#FF4C4C]' };
      case 'idle':
      default:
        return { label: 'Disconnected', dotClass: 'bg-[#FF4C4C] shadow-[0_0_8px_#FF4C4C]' };
    }
  };

  const status = getStatusDetails();
  const isConnecting = connectionStatus === 'connecting';
  const isConnected = connectionStatus === 'connected';

  return (
    <div className="flex flex-col space-y-6">
      <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg p-5 flex flex-col space-y-5">
        <div className="flex items-center justify-between border-b border-[#1E1E2E] pb-3">
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">
            Hardware Control
          </h2>
          <div className="flex items-center space-x-2">
            {/* Status Indicator Dot */}
            <span className={`relative flex h-2.5 w-2.5`}>
              {connectionStatus !== 'idle' && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status.dotClass}`}></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${status.dotClass}`}></span>
            </span>
            <span className="text-xs font-medium font-sans text-slate-300">
              {status.label}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Architecture Selector */}
          <div className="flex flex-col space-y-1.5">
            <label htmlFor="arch-select" className="text-xs font-medium text-slate-400">
              Microcontroller Architecture
            </label>
            <select
              id="arch-select"
              value={selectedArch}
              onChange={(e) => setSelectedArch(e.target.value)}
              disabled={isConnected || isConnecting}
              className="w-full h-10 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-md text-sm text-slate-200 focus:outline-none focus:border-[#00FFC8] focus:ring-1 focus:ring-[#00FFC8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <option value="esp32">ESP32 (WROOM / WROVER)</option>
              <option value="esp8266">ESP8266 (EX / NodeMCU)</option>
              <option value="avr">AVR / Arduino (ATmega328P)</option>
              <option value="cortex">ARM Cortex-M (STM32 / NXP)</option>
              <option value="riscv">RISC-V (CH32 / ESP32-C3)</option>
            </select>
          </div>

          {/* Baud Rate Selector */}
          <div className="flex flex-col space-y-1.5">
            <label htmlFor="baud-select" className="text-xs font-medium text-slate-400">
              Baud Rate (bps)
            </label>
            <select
              id="baud-select"
              value={selectedBaud}
              onChange={(e) => setSelectedBaud(Number(e.target.value))}
              disabled={isConnected || isConnecting}
              className="w-full h-10 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-md text-sm text-slate-200 focus:outline-none focus:border-[#00FFC8] focus:ring-1 focus:ring-[#00FFC8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <option value="9600">9600 bps</option>
              <option value="57600">57600 bps</option>
              <option value="115200">115200 bps (Default)</option>
              <option value="230400">230400 bps</option>
              <option value="460800">460800 bps</option>
            </select>
          </div>
        </div>

        {/* Control Actions */}
        <div className="flex flex-col space-y-2 pt-2">
          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="w-full h-10 flex items-center justify-center space-x-2 text-sm font-semibold rounded-md border border-[#FF4C4C] text-[#FF4C4C] hover:bg-[#FF4C4C]/10 transition-colors"
            >
              <Square className="h-4 w-4" />
              <span>Disconnect Link</span>
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="w-full h-10 flex items-center justify-center space-x-2 text-sm font-semibold rounded-md bg-[#00FFC8] text-[#0A0A0F] hover:bg-[#00E0B0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Establishing Bridge...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>Establish Bridge</span>
                </>
              )}
            </button>
          )}
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
      />
    </div>
  );
};

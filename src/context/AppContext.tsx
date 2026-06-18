import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSerialPort } from '../hooks/useSerialPort';
import { useFlashExtractor } from '../hooks/useFlashExtractor';
import { useBackendHandoff } from '../hooks/useBackendHandoff';
import type { AnalysisResult } from '../types/analysis';
import type { ConnectionStatus, TerminalLog, PortMetadata } from '../hooks/useSerialPort';
import type { ExtractionStatus } from '../hooks/useFlashExtractor';
import type { UploadStatus } from '../hooks/useBackendHandoff';

interface AppContextValue {
  // Serial
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (s: ConnectionStatus) => void;
  selectedArch: string;
  setSelectedArch: (a: string) => void;
  selectedBaud: number;
  setSelectedBaud: (b: number) => void;
  portInfo: PortMetadata | null;
  setPortInfo: (p: PortMetadata | null) => void;
  connectionTimestamp: string | null;
  setConnectionTimestamp: (t: string | null) => void;
  errorMsg: string | null;
  terminalLogs: TerminalLog[];
  setTerminalLogs: (logs: TerminalLog[]) => void;
  hexBuffer: Uint8Array;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearLogs: () => void;
  isBrowserSupported: boolean;
  portRef: React.MutableRefObject<SerialPort | null>;
  appendLog: (level: TerminalLog['level'], message: string) => void;
  pauseReadLoop: () => Promise<void>;
  resumeReadLoop: () => void;

  // Extraction
  extractionStatus: ExtractionStatus;
  bytesRead: number;
  totalBytes: number;
  progressPercent: number;
  flashBuffer: Uint8Array | null;
  extractionError: string | null;
  startExtraction: (arch: string, targetSize: number) => Promise<void>;
  cancelExtraction: () => void;
  downloadBin: () => void;

  // Handoff
  uploadStatus: UploadStatus;
  uploadProgress: number;
  analysisProgress: number;
  analysisStage: string;
  result: AnalysisResult | null;
  handoffError: string | null;
  sendToServer: () => Promise<void>;
  cancelHandoff: () => void;
  resetHandoff: () => void;

  // App-level
  isDemoMode: boolean;
  setIsDemoMode: (v: boolean) => void;
  isExplorerOpen: boolean;
  setIsExplorerOpen: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const serial = useSerialPort();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);

  const handleExtractionDone = useCallback((buffer: Uint8Array) => {
    serial.appendLog('INFO', `Flash image complete (${buffer.length} bytes). Handoff pipeline unlocked.`);
  }, [serial.appendLog]);

  const extraction = useFlashExtractor({
    portRef: serial.portRef,
    appendLog: serial.appendLog,
    pauseReadLoop: serial.pauseReadLoop,
    resumeReadLoop: serial.resumeReadLoop,
    connectionStatus: serial.connectionStatus,
    selectedArch: serial.selectedArch,
    isDemoMode,
    onExtractionDone: handleExtractionDone,
  });

  const handoff = useBackendHandoff({
    flashBuffer: extraction.flashBuffer,
    extractionStatus: extraction.extractionStatus,
    selectedArch: serial.selectedArch,
    appendLog: serial.appendLog,
    isDemoMode,
  });

  // Sync Demo Mode with serial bridge state
  useEffect(() => {
    if (isDemoMode) {
      serial.setConnectionStatus('connected');
      serial.setPortInfo({
        displayName: 'Virtual ESP32 Bridge (DEMO)',
        usbVendorId: 0x1A86,
        usbProductId: 0x7523,
      });
      const d = new Date();
      const now = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
      serial.setConnectionTimestamp(now);
      serial.setTerminalLogs([
        { id: 'demo-1', timestamp: now, level: 'INFO', message: 'Hardware emulation active: Demo Mode enabled.' },
        { id: 'demo-2', timestamp: now, level: 'INFO', message: 'Click "Extract Firmware" to trigger a simulated 1024-byte block ROM backup read sequence.' },
      ]);
    } else {
      serial.setConnectionStatus('idle');
      serial.setPortInfo(null);
      serial.setConnectionTimestamp(null);
      serial.setTerminalLogs([]);
      handoff.resetHandoff();
    }
  }, [isDemoMode]);

  const value: AppContextValue = {
    ...serial,
    extractionStatus: extraction.extractionStatus,
    bytesRead: extraction.bytesRead,
    totalBytes: extraction.totalBytes,
    progressPercent: extraction.progressPercent,
    flashBuffer: extraction.flashBuffer,
    extractionError: extraction.errorMessage,
    startExtraction: extraction.startExtraction,
    cancelExtraction: extraction.cancelExtraction,
    downloadBin: extraction.downloadBin,
    uploadStatus: handoff.uploadStatus,
    uploadProgress: handoff.uploadProgress,
    analysisProgress: handoff.analysisProgress,
    analysisStage: handoff.analysisStage,
    result: handoff.result,
    handoffError: handoff.errorMessage,
    sendToServer: handoff.sendToServer,
    cancelHandoff: handoff.cancelHandoff,
    resetHandoff: handoff.resetHandoff,
    isDemoMode,
    setIsDemoMode,
    isExplorerOpen,
    setIsExplorerOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getFormattedTime } from '../utils/time';
import { useSerialPort } from '../hooks/useSerialPort';
import { useFlashExtractor } from '../hooks/useFlashExtractor';
import { useBackendHandoff } from '../hooks/useBackendHandoff';
import { useSmartDetect, DetectStatus, Confidence, RecommendedAction, FilesystemCommands } from '../hooks/useSmartDetect';
import { useAIExplain, ExplainStatus } from '../hooks/useAIExplain';

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
  connect: (selectedPort?: SerialPort) => Promise<void>;
  disconnect: () => Promise<void>;
  clearLogs: () => void;
  isBrowserSupported: boolean;
  portRef: React.MutableRefObject<SerialPort | null>;
  appendLog: (level: TerminalLog['level'], message: string) => void;
  pauseReadLoop: () => Promise<void>;
  resumeReadLoop: () => void;
  authorizedPorts: SerialPort[];
  updateAuthorizedPorts: () => Promise<void>;

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

  // Detection
  detectStatus: DetectStatus;
  detectedRuntime: string | null;
  runtimeVersion: string | null;
  confidence: Confidence;
  recommendedAction: RecommendedAction;
  detectionMessage: string;
  filesystemCommands: FilesystemCommands | null;
  forceBinaryExtraction: boolean;
  setForceBinaryExtraction: (v: boolean) => void;
  runDetection: (
    port: SerialPort | null,
    arch: string,
    isDemoMode: boolean,
    appendLog: (level: 'INFO' | 'WARN' | 'ERROR' | 'DATA', msg: string) => void
  ) => Promise<any>;
  resetDetection: () => void;

  // App-level
  isDemoMode: boolean;
  setIsDemoMode: (v: boolean) => void;
  isExplorerOpen: boolean;
  setIsExplorerOpen: (v: boolean) => void;



  // AI Explain lifted states
  explainStatus: ExplainStatus;
  streamedText: string;
  tokensUsed: number | null;
  explainError: string | null;
  explain: (functionName: string, arch: string, result: AnalysisResult) => Promise<void>;
  clearExplainTimers: () => void;

  // Workflow Stage state
  workflowStage: string;
  setWorkflowStage: (stage: string) => void;

  // Global reset
  resetAllPipelineState: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [forceBinaryExtraction, setForceBinaryExtraction] = useState(false);



  // Workflow Stage state
  const [workflowStage, setWorkflowStage] = useState<string>('bridge');

  // AI Explain global hook
  const aiExplain = useAIExplain(isDemoMode);

  // Setup disconnect callback ref to break circular dependency with serial port hook
  const onDisconnectRef = useRef<(() => void) | null>(null);

  const handleDisconnect = useCallback(() => {
    if (onDisconnectRef.current) {
      onDisconnectRef.current();
    }
  }, []);

  const serial = useSerialPort({
    onDisconnect: handleDisconnect
  });

  const smartDetect = useSmartDetect();

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
    setHexBuffer: serial.setHexBuffer,
  });

  const handoff = useBackendHandoff({
    flashBuffer: extraction.flashBuffer,
    extractionStatus: extraction.extractionStatus,
    selectedArch: serial.selectedArch,
    appendLog: serial.appendLog,
    isDemoMode,
  });

  // Destructure stable callbacks to prevent infinite re-rendering loops in route guards
  const { setHexBuffer, appendLog } = serial;
  const { resetDetection } = smartDetect;
  const { resetExtraction } = extraction;
  const { resetHandoff } = handoff;
  const { clearExplanation } = aiExplain;

  // Central reset function
  const resetAllPipelineState = useCallback(() => {
    // 1. Clear raw bytes hexBuffer
    setHexBuffer(new Uint8Array(0));

    // 2. Clear smart detect
    resetDetection();

    // 3. Clear extraction states
    resetExtraction();

    // 4. Clear handoff decompiler and event streams
    resetHandoff();

    // 5. Clear AI Explain timers
    clearExplanation();



    // 7. Close Code Explorer
    setIsExplorerOpen(false);

    // 8. Reset workflow stage
    setWorkflowStage('bridge');

    // 9. Reset force binary extraction
    setForceBinaryExtraction(false);

    // 10. Append separator to terminal logs
    appendLog('INFO', '─── Session cleared ───');

    // 11. Clear session storage active flag
    sessionStorage.removeItem('binino_session_active');
  }, [setHexBuffer, appendLog, resetDetection, resetExtraction, resetHandoff, clearExplanation]);

  // Sync ref callback
  useEffect(() => {
    onDisconnectRef.current = resetAllPipelineState;
  }, [resetAllPipelineState]);

  // Wrap connect to reset state first
  const connect = useCallback(async (selectedPort?: SerialPort) => {
    resetAllPipelineState();
    await serial.connect(selectedPort);
  }, [serial, resetAllPipelineState]);

  // Automatically trigger smart detection on connection
  useEffect(() => {
    if (serial.connectionStatus === 'connected') {
      const triggerDetect = async () => {
        setForceBinaryExtraction(false);
        // Pause background reading to gain exclusive port access
        await serial.pauseReadLoop();

        const res = await smartDetect.runDetection(
          serial.portRef.current,
          serial.selectedArch,
          isDemoMode,
          serial.appendLog
        );

        // Resume read loop if the recommended action is not file-browser
        if (res && res.action !== 'file-browser') {
          serial.resumeReadLoop();
        }
      };

      triggerDetect();
    } else if (serial.connectionStatus === 'idle') {
      smartDetect.resetDetection();
      setForceBinaryExtraction(false);
    }
  }, [serial.connectionStatus, serial.selectedArch, isDemoMode]);

  // Sync Demo Mode with serial bridge state
  const prevDemoRef = useRef(isDemoMode);
  useEffect(() => {
    if (isDemoMode) {
      serial.setConnectionStatus('connected');
      serial.setPortInfo({
        displayName: 'Virtual ESP32 Bridge (DEMO)',
        usbVendorId: 0x1A86,
        usbProductId: 0x7523,
      });
      const now = getFormattedTime();
      serial.setConnectionTimestamp(now);
      serial.setTerminalLogs([
        { id: 'demo-1', timestamp: now, level: 'INFO', message: 'Hardware emulation active: Demo Mode enabled.' },
        { id: 'demo-2', timestamp: now, level: 'INFO', message: 'Smart Detector will auto-probe when connected.' },
      ]);
    } else {
      if (prevDemoRef.current === true) {
        serial.disconnect();
      }
    }
    prevDemoRef.current = isDemoMode;
  }, [isDemoMode]);

  // Track active session status in sessionStorage to prevent false triggers in the refresh guard
  useEffect(() => {
    if (isDemoMode || serial.connectionStatus === 'connected') {
      sessionStorage.setItem('binino_session_active', 'true');
    }
  }, [isDemoMode, serial.connectionStatus]);

  const value: AppContextValue = {
    ...serial,
    connect,
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
    
    // Detection
    detectStatus: smartDetect.detectStatus,
    detectedRuntime: smartDetect.detectedRuntime,
    runtimeVersion: smartDetect.runtimeVersion,
    confidence: smartDetect.confidence,
    recommendedAction: smartDetect.recommendedAction,
    detectionMessage: smartDetect.detectionMessage,
    filesystemCommands: smartDetect.filesystemCommands,
    forceBinaryExtraction,
    setForceBinaryExtraction,
    runDetection: smartDetect.runDetection,
    resetDetection: smartDetect.resetDetection,

    isDemoMode,
    setIsDemoMode,
    isExplorerOpen,
    setIsExplorerOpen,



    // AI Explain
    explainStatus: aiExplain.explainStatus,
    streamedText: aiExplain.streamedText,
    tokensUsed: aiExplain.tokensUsed,
    explainError: aiExplain.errorMessage,
    explain: aiExplain.explain,
    clearExplainTimers: aiExplain.clearExplanation,

    // Workflow Stage
    workflowStage,
    setWorkflowStage,

    // Central Reset
    resetAllPipelineState,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

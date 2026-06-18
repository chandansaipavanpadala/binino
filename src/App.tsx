import React, { useState, useEffect, useCallback } from 'react';
import { useSerialPort } from './hooks/useSerialPort';
import { useFlashExtractor } from './hooks/useFlashExtractor';
import { useBackendHandoff } from './hooks/useBackendHandoff';
import { Navbar } from './components/Navbar';
import { ConnectionPanel } from './components/ConnectionPanel';
import { DeviceInfoCard } from './components/DeviceInfoCard';
import { HandoffPanel } from './components/HandoffPanel';
import { TerminalPane } from './components/TerminalPane';
import { HexPreviewStrip } from './components/HexPreviewStrip';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { CodeExplorer } from './components/CodeExplorer';

const App: React.FC = () => {
  const {
    connectionStatus,
    setConnectionStatus,
    selectedArch,
    setSelectedArch,
    selectedBaud,
    setSelectedBaud,
    portInfo,
    setPortInfo,
    connectionTimestamp,
    setConnectionTimestamp,
    errorMsg,
    terminalLogs,
    setTerminalLogs,
    hexBuffer,
    connect,
    disconnect,
    clearLogs,
    isBrowserSupported,
    portRef,
    appendLog,
    pauseReadLoop,
    resumeReadLoop,
  } = useSerialPort();

  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState<boolean>(false);

  // Sync Demo Mode status with serial bridge state
  useEffect(() => {
    if (isDemoMode) {
      setConnectionStatus('connected');
      setPortInfo({
        displayName: 'Virtual ESP32 Bridge (DEMO)',
        usbVendorId: 0x1A86,
        usbProductId: 0x7523,
      });
      const now = new Date().toTimeString().split(' ')[0];
      setConnectionTimestamp(now);
      
      setTerminalLogs([
        {
          id: 'demo-1',
          timestamp: now,
          level: 'INFO',
          message: 'Hardware emulation active: Demo Mode enabled.',
        },
        {
          id: 'demo-2',
          timestamp: now,
          level: 'INFO',
          message: 'Click "Extract Firmware" to trigger a simulated 1024-byte block ROM backup read sequence.',
        },
      ]);
    } else {
      setConnectionStatus('idle');
      setPortInfo(null);
      setConnectionTimestamp(null);
      setTerminalLogs([]);
      resetHandoff(); // Clear handoff panel states
    }
  }, [isDemoMode, setConnectionStatus, setPortInfo, setConnectionTimestamp, setTerminalLogs]);

  // Callback triggered when flash extraction completes
  const handleExtractionDone = useCallback((buffer: Uint8Array) => {
    appendLog('INFO', `Flash image complete (${buffer.length} bytes). Handoff pipeline unlocked.`);
  }, [appendLog]);

  // Instantiate Flash Extractor Logic Hook
  const {
    extractionStatus,
    bytesRead,
    totalBytes,
    progressPercent,
    flashBuffer,
    errorMessage: extractionError,
    startExtraction,
    cancelExtraction,
    downloadBin,
  } = useFlashExtractor({
    portRef,
    appendLog,
    pauseReadLoop,
    resumeReadLoop,
    connectionStatus,
    selectedArch,
    isDemoMode,
    onExtractionDone: handleExtractionDone,
  });

  // Instantiate Backend Decompiler Handoff Hook
  const {
    uploadStatus,
    uploadProgress,
    analysisProgress,
    analysisStage,
    result,
    errorMessage: handoffError,
    sendToServer,
    cancelHandoff,
    resetHandoff,
  } = useBackendHandoff({
    flashBuffer,
    extractionStatus,
    selectedArch,
    appendLog,
    isDemoMode,
  });

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-100 flex flex-col font-sans select-none">
      <Navbar isDemoMode={isDemoMode} setIsDemoMode={setIsDemoMode} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col space-y-6">
        
        {/* Browser compatibility banner */}
        {!isBrowserSupported && (
          <div className="bg-[#FFB347]/10 border border-[#FFB347] rounded-lg p-4 flex items-start space-x-3 text-slate-200">
            <AlertTriangle className="h-5 w-5 text-[#FFB347] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-[#FFB347]">Browser Compatibility Warning</h3>
              <p className="text-xs text-slate-300 mt-1">
                The Web Serial API is not supported in this browser. To bridge compiled firmware from microcontrollers directly via USB, please open Binino in Google Chrome, Microsoft Edge, or Opera.
              </p>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {(errorMsg || extractionError || handoffError) && (
          <div className="bg-[#FF4C4C]/10 border border-[#FF4C4C] rounded-lg p-4 flex items-start space-x-3 text-slate-200">
            <AlertCircle className="h-5 w-5 text-[#FF4C4C] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-[#FF4C4C]">Hardware Bridge Error</h3>
              <p className="text-xs text-slate-300 mt-1">{errorMsg || extractionError || handoffError}</p>
            </div>
          </div>
        )}

        {/* Dynamic Desktop / Mobile layout grid */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
          
          {/* Left Column: Connection & Device Info (30% on desktop) */}
          <section className="lg:col-span-3 flex flex-col space-y-6">
            <ConnectionPanel
              connectionStatus={connectionStatus}
              selectedArch={selectedArch}
              setSelectedArch={setSelectedArch}
              selectedBaud={selectedBaud}
              setSelectedBaud={setSelectedBaud}
              connect={connect}
              disconnect={disconnect}
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
            
            <DeviceInfoCard
              connectionStatus={connectionStatus}
              portInfo={portInfo}
              selectedArch={selectedArch}
              selectedBaud={selectedBaud}
              connectionTimestamp={connectionTimestamp}
            />

            {/* Handoff Panel: Enabled only when firmware extraction completes */}
            {extractionStatus === 'done' && (
              <HandoffPanel
                uploadStatus={uploadStatus}
                uploadProgress={uploadProgress}
                analysisProgress={analysisProgress}
                analysisStage={analysisStage}
                result={result}
                errorMessage={handoffError}
                sendToServer={sendToServer}
                cancelHandoff={cancelHandoff}
                flashSize={flashBuffer ? flashBuffer.length : 0}
                onOpenExplorer={() => setIsExplorerOpen(true)}
              />
            )}
          </section>

          {/* Right Column: Terminal Stream & Hex Dump (70% on desktop) */}
          <section className="lg:col-span-7 flex flex-col">
            <TerminalPane
              logs={terminalLogs}
              clearLogs={clearLogs}
            />
            
            <HexPreviewStrip
              liveBuffer={hexBuffer}
              flashBuffer={flashBuffer}
              extractionStatus={extractionStatus}
            />
          </section>
          
        </div>
      </main>

      {/* Footer information */}
      <footer className="py-4 border-t border-[#1E1E2E] text-center text-[10px] text-slate-500 font-sans mt-auto">
        Binino Toolkit — Browser-to-Hardware Flash Extractor (Phase 2)
      </footer>
      {isExplorerOpen && result && (
        <CodeExplorer
          result={result}
          flashBuffer={flashBuffer}
          onClose={() => setIsExplorerOpen(false)}
        />
      )}
    </div>
  );
};

export default App;


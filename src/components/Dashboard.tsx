import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Navbar } from './Navbar';
import { WorkflowStepper } from './WorkflowStepper';
import { ConnectionPanel } from './ConnectionPanel';
import { DeviceInfoCard } from './DeviceInfoCard';
import { HandoffPanel } from './HandoffPanel';
import { TerminalPane } from './TerminalPane';
import { HexPreviewStrip } from './HexPreviewStrip';
import { StatusBar } from './StatusBar';
import { CodeExplorer } from './CodeExplorer';
import { ErrorBoundary } from './CodeExplorer/ErrorBoundary';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    isBrowserSupported,
    errorMsg,
    extractionError,
    handoffError,
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
    portInfo,
    connectionTimestamp,
    uploadStatus,
    uploadProgress,
    analysisProgress,
    analysisStage,
    result,
    sendToServer,
    cancelHandoff,
    isExplorerOpen,
    setIsExplorerOpen,
    terminalLogs,
    clearLogs,
    hexBuffer,
    appendLog,
  } = useAppContext();

  return (
    <div className="min-h-screen bg-[#080808] text-[#F0F0F0] flex flex-col font-sans select-none overflow-hidden">
      {/* 48px height Navbar */}
      <Navbar />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
        {/* Workflow Stepper */}
        <WorkflowStepper />

        {/* Browser compatibility banner */}
        {!isBrowserSupported && (
          <div className="bg-[#F59E0B]/10 border border-[var(--status-warn)] rounded-md p-3 flex items-start space-x-3 text-[#F0F0F0]">
            <AlertTriangle className="h-4 w-4 text-[var(--status-warn)] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-[var(--status-warn)]">Browser Compatibility Warning</h3>
              <p className="text-[11px] text-[#888888] mt-0.5">
                The Web Serial API is not supported in this browser. To bridge compiled firmware from microcontrollers directly via USB, please open Binino in Google Chrome, Microsoft Edge, or Opera.
              </p>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {(errorMsg || extractionError || handoffError) && (
          <div className="bg-[#F87171]/10 border border-[var(--status-error)] rounded-md p-3 flex items-start space-x-3 text-[#F0F0F0]">
            <AlertCircle className="h-4 w-4 text-[var(--status-error)] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-[var(--status-error)]">Hardware Bridge Error</h3>
              <p className="text-[11px] text-[#888888] mt-0.5">{errorMsg || extractionError || handoffError}</p>
            </div>
          </div>
        )}

        {/* Workspace Layout Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-4 min-h-0">
          {/* Left Column: Connection, Device Info, and Handoff (30% width) */}
          <section className="lg:col-span-3 flex flex-col space-y-4 min-h-0 overflow-y-auto pr-1">
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
              isBrowserSupported={isBrowserSupported}
            />

            <DeviceInfoCard
              connectionStatus={connectionStatus}
              portInfo={portInfo}
              selectedArch={selectedArch}
              selectedBaud={selectedBaud}
              connectionTimestamp={connectionTimestamp}
            />

            {/* Handoff Panel: Active when firmware extraction completes or in done state */}
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

          {/* Right Column: Terminal Stream (65%) & Hex Dump (35%) */}
          <section className="lg:col-span-7 flex flex-col space-y-4 min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0">
              <TerminalPane logs={terminalLogs} clearLogs={clearLogs} />
            </div>
            <div className="h-[180px] shrink-0">
              <HexPreviewStrip
                liveBuffer={hexBuffer}
                flashBuffer={flashBuffer}
                extractionStatus={extractionStatus}
              />
            </div>
          </section>
        </div>
      </main>

      {/* 28px bottom status bar */}
      <StatusBar />

      {/* Code Explorer Fullscreen Overlay */}
      {isExplorerOpen && result && (
        <ErrorBoundary
          onClose={() => setIsExplorerOpen(false)}
          onCrash={(error) => appendLog('ERROR', `Code Explorer crashed: ${error.message}`)}
        >
          <CodeExplorer
            result={result}
            flashBuffer={flashBuffer}
            onClose={() => setIsExplorerOpen(false)}
            isDemoMode={isDemoMode}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default Dashboard;

import React from 'react';
import { UploadStatus } from '../hooks/useBackendHandoff';
import { AnalysisResult } from '../types/analysis';
import { Send, FileCode, CheckCircle, AlertCircle, Play, Ban } from 'lucide-react';

interface HandoffPanelProps {
  uploadStatus: UploadStatus;
  uploadProgress: number;
  analysisProgress: number;
  analysisStage: string;
  result: AnalysisResult | null;
  errorMessage: string | null;
  sendToServer: () => Promise<void>;
  cancelHandoff: () => void;
  flashSize: number;
  onOpenExplorer?: () => void;
}

export const HandoffPanel: React.FC<HandoffPanelProps> = ({
  uploadStatus,
  uploadProgress,
  analysisProgress,
  analysisStage,
  result,
  errorMessage,
  sendToServer,
  cancelHandoff,
  flashSize,
  onOpenExplorer,
}) => {
  
  const isIdle = uploadStatus === 'idle';
  const isUploading = uploadStatus === 'uploading';
  const isQueued = uploadStatus === 'queued';
  const isAnalyzing = uploadStatus === 'analyzing';
  const isDone = uploadStatus === 'done';
  const isError = uploadStatus === 'error';
  const isProcessing = isUploading || isQueued || isAnalyzing;

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  // Determine button label based on status
  const getButtonLabel = () => {
    if (isUploading) return 'Uploading Binary...';
    if (isQueued) return 'Job Queued...';
    if (isAnalyzing) return 'Decompiling Firmware...';
    if (isDone) return 'Analysis Complete';
    return 'Send to Decompiler';
  };

  // Stepper state calculator
  const getStepState = (step: 'import' | 'analyse' | 'decompile' | 'export') => {
    // idle / error / uploading
    if (isIdle || isError || isUploading) return 'inactive';

    if (isDone) return 'completed';

    // Map progress values to steps
    const progress = analysisProgress;
    if (step === 'import') {
      if (progress >= 15) return 'completed';
      return 'active';
    }
    if (step === 'analyse') {
      if (progress >= 40) return 'completed';
      if (progress >= 15) return 'active';
      return 'inactive';
    }
    if (step === 'decompile') {
      if (progress >= 70) return 'completed';
      if (progress >= 40) return 'active';
      return 'inactive';
    }
    if (step === 'export') {
      if (progress >= 90) return 'completed';
      if (progress >= 70) return 'active';
      return 'inactive';
    }
    return 'inactive';
  };

  const getStepClass = (state: 'inactive' | 'active' | 'completed') => {
    if (state === 'completed') return 'bg-[#00FFC8]/10 border-[#00FFC8] text-[#00FFC8]';
    if (state === 'active') return 'bg-[#FFB347]/10 border-[#FFB347] text-[#FFB347] animate-pulse';
    return 'bg-[#1E1E2E] border-[#1E1E2E] text-slate-500';
  };

  const steps = [
    { key: 'import', label: 'Import' },
    { key: 'analyse', label: 'Analyse' },
    { key: 'decompile', label: 'Decompile' },
    { key: 'export', label: 'Export' },
  ] as const;

  return (
    <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg p-5 flex flex-col space-y-5">
      <div className="flex items-center justify-between border-b border-[#1E1E2E] pb-3">
        <div className="flex items-center space-x-2">
          <FileCode className="h-4 w-4 text-[#FFB347]" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">
            Decompiler Handoff
          </h2>
        </div>
        {isProcessing && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFB347] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFB347]"></span>
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Main Handoff Action Trigger */}
        {!isProcessing ? (
          <button
            onClick={sendToServer}
            disabled={isDone}
            className={`w-full h-10 flex items-center justify-center space-x-2 text-sm font-semibold rounded-md transition-colors ${
              isDone
                ? 'bg-[#00FFC8]/10 border border-[#00FFC8] text-[#00FFC8] cursor-default'
                : 'bg-[#FFB347] text-[#0A0A0F] hover:bg-[#FFA330]'
            }`}
          >
            {isDone ? (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>{getButtonLabel()}</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>{getButtonLabel()}</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={cancelHandoff}
            className="w-full h-10 flex items-center justify-center space-x-2 text-sm font-semibold rounded-md border border-[#FF4C4C] text-[#FF4C4C] hover:bg-[#FF4C4C]/10 transition-colors"
          >
            <Ban className="h-4 w-4" />
            <span>Cancel Handoff</span>
          </button>
        )}

        {/* Upload progress state */}
        {isUploading && (
          <div className="space-y-1 pt-2">
            <div className="flex justify-between text-[11px] font-sans text-slate-400">
              <span>Uploading {formatSize(flashSize)}</span>
              <span className="font-mono text-[#FFB347]">{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FFB347] transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Queued notification */}
        {isQueued && (
          <div className="text-center p-3 border border-[#1E1E2E] bg-[#1E1E2E]/10 rounded-md text-xs text-slate-400 font-sans">
            Job accepted. Waiting for Ghidra worker thread allocation...
          </div>
        )}

        {/* Analysis progress state */}
        {(isAnalyzing || isQueued) && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-sans text-slate-400">
                <span className="truncate max-w-[200px]" title={analysisStage}>
                  {analysisStage || 'Starting analysis...'}
                </span>
                <span className="font-mono text-[#00FFC8]">{analysisProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00FFC8] transition-all duration-200"
                  style={{ width: `${analysisProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Stepper visualization */}
            <div className="grid grid-cols-4 gap-1 pt-2">
              {steps.map((step) => {
                const state = getStepState(step.key);
                return (
                  <div key={step.key} className="flex flex-col items-center space-y-1">
                    <div
                      className={`w-7 h-7 flex items-center justify-center rounded-full border text-[10px] font-mono font-semibold transition-all ${getStepClass(
                        state
                      )}`}
                    >
                      {state === 'completed' ? '✓' : step.label[0]}
                    </div>
                    <span className="text-[9px] text-slate-500 font-sans">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error notifications */}
        {isError && errorMessage && (
          <div className="bg-[#FF4C4C]/10 border border-[#FF4C4C] rounded-lg p-4 flex items-start space-x-3 text-slate-200">
            <AlertCircle className="h-4 w-4 text-[#FF4C4C] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-[#FF4C4C]">Decompiler Error</h3>
              <p className="text-[10px] text-slate-300 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Result Summary Cards */}
        {isDone && result && (
          <div className="space-y-4 pt-2 border-t border-[#1E1E2E]">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#1E1E2E]/20 border border-[#1E1E2E] p-2.5 rounded text-center">
                <span className="block text-[9px] text-slate-500 uppercase tracking-wide">Functions</span>
                <span className="font-mono text-sm font-semibold text-[#00FFC8]">
                  {result.functions?.length || 0}
                </span>
              </div>
              <div className="bg-[#1E1E2E]/20 border border-[#1E1E2E] p-2.5 rounded text-center">
                <span className="block text-[9px] text-slate-500 uppercase tracking-wide">Strings</span>
                <span className="font-mono text-sm font-semibold text-[#FFB347]">
                  {result.strings?.length || 0}
                </span>
              </div>
              <div className="bg-[#1E1E2E]/20 border border-[#1E1E2E] p-2.5 rounded text-center">
                <span className="block text-[9px] text-slate-500 uppercase tracking-wide">Entry Point</span>
                <span className="font-mono text-[10px] font-semibold text-slate-200 truncate block">
                  {result.entry_point || '—'}
                </span>
              </div>
            </div>

            {/* View in Code Explorer Trigger */}
            <button
              onClick={() => {
                if (onOpenExplorer) {
                  onOpenExplorer();
                } else {
                  console.log('PHASE 4: Launching Code Explorer with result:', result);
                  alert('Phase 3 complete! Reconstructed pseudo-C is now cached in memory for Phase 4 Code Explorer.');
                }
              }}
              className="w-full h-10 flex items-center justify-center space-x-2 text-sm font-semibold rounded-md bg-[#00FFC8] text-[#0A0A0F] hover:bg-[#00E0B0] transition-colors"
            >
              <Play className="h-4 w-4" />
              <span>View in Code Explorer</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

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
    if (isIdle || isError || isUploading) return 'inactive';
    if (isDone) return 'completed';

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

  const getStepStyle = (state: 'inactive' | 'active' | 'completed') => {
    if (state === 'completed') {
      return {
        style: { backgroundColor: 'rgba(74, 222, 128, 0.05)', borderColor: 'var(--status-live)', color: 'var(--status-live)' },
        class: ''
      };
    }
    if (state === 'active') {
      return {
        style: { backgroundColor: 'rgba(232, 232, 232, 0.05)', borderColor: 'var(--accent)', color: 'var(--text-primary)' },
        class: 'animate-pulse'
      };
    }
    return {
      style: { backgroundColor: 'var(--bg-inset)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' },
      class: ''
    };
  };

  const steps = [
    { key: 'import', label: 'Import' },
    { key: 'analyse', label: 'Analyse' },
    { key: 'decompile', label: 'Decompile' },
    { key: 'export', label: 'Export' },
  ] as const;

  return (
    <div 
      className="rounded-lg p-5 flex flex-col space-y-4 bg-[#111111]"
      style={{ border: '1px solid var(--border-subtle)' }}
    >
      <div 
        className="flex items-center justify-between pb-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center space-x-2">
          <FileCode className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          <h2 className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
            Decompiler Handoff
          </h2>
        </div>
        {isProcessing && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--accent)' }}></span>
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--accent)' }}></span>
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Main Handoff Action Trigger */}
        {!isProcessing ? (
          <button
            onClick={sendToServer}
            disabled={isDone}
            className="w-full h-9 flex items-center justify-center space-x-2 text-xs font-semibold rounded transition-all duration-150"
            style={{
              backgroundColor: isDone ? 'rgba(74, 222, 128, 0.05)' : 'var(--accent)',
              border: isDone ? '1px solid var(--status-live)' : 'none',
              color: isDone ? 'var(--status-live)' : 'var(--bg-base)',
              cursor: isDone ? 'default' : 'pointer'
            }}
          >
            {isDone ? (
              <>
                <CheckCircle className="h-3.5 w-3.5" />
                <span>{getButtonLabel()}</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>{getButtonLabel()}</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={cancelHandoff}
            className="w-full h-9 flex items-center justify-center space-x-2 text-xs font-semibold rounded transition-all duration-150"
            style={{
              border: '1px solid var(--status-error)',
              color: 'var(--status-error)',
              backgroundColor: 'rgba(248, 113, 113, 0.05)',
            }}
          >
            <Ban className="h-3.5 w-3.5" />
            <span>Cancel Handoff</span>
          </button>
        )}

        {/* Upload progress state */}
        {isUploading && (
          <div className="space-y-1 pt-2">
            <div className="flex justify-between text-[10px] font-sans">
              <span style={{ color: 'var(--text-secondary)' }}>Uploading {formatSize(flashSize)}</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded overflow-hidden" style={{ backgroundColor: 'var(--bg-inset)' }}>
              <div
                className="h-full transition-all duration-150"
                style={{ 
                  width: `${uploadProgress}%`,
                  backgroundColor: 'var(--accent)' 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Queued notification */}
        {isQueued && (
          <div 
            className="text-center p-3 rounded text-[11px] font-sans"
            style={{ 
              backgroundColor: 'var(--bg-inset)', 
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            Job accepted. Waiting for Ghidra worker thread allocation...
          </div>
        )}

        {/* Analysis progress state */}
        {(isAnalyzing || isQueued) && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-sans">
                <span className="truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }} title={analysisStage}>
                  {analysisStage || 'Starting analysis...'}
                </span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{analysisProgress}%</span>
              </div>
              <div className="w-full h-1.5 rounded overflow-hidden" style={{ backgroundColor: 'var(--bg-inset)' }}>
                <div
                  className="h-full transition-all duration-200"
                  style={{ 
                    width: `${analysisProgress}%`,
                    backgroundColor: 'var(--accent)'
                  }}
                ></div>
              </div>
            </div>

            {/* Stepper visualization */}
            <div className="grid grid-cols-4 gap-1 pt-2">
              {steps.map((step) => {
                const state = getStepState(step.key);
                const stepDetails = getStepStyle(state);
                return (
                  <div key={step.key} className="flex flex-col items-center space-y-1">
                    <div
                      className={`w-6 h-6 flex items-center justify-center rounded-full border text-[9px] font-mono font-semibold transition-all duration-150 ${stepDetails.class}`}
                      style={stepDetails.style}
                    >
                      {state === 'completed' ? '✓' : step.label[0]}
                    </div>
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error notifications */}
        {isError && errorMessage && (
          <div 
            className="rounded p-3 flex items-start space-x-3 text-xs"
            style={{ 
              backgroundColor: 'rgba(248, 113, 113, 0.05)', 
              border: '1px solid var(--status-error)' 
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--status-error)' }} />
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--status-error)' }}>Decompiler Error</h3>
              <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Result Summary Cards */}
        {isDone && result && (
          <div className="space-y-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="grid grid-cols-3 gap-2">
              <div 
                className="p-2 rounded text-center"
                style={{ 
                  backgroundColor: 'var(--bg-inset)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <span className="block text-[8px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Functions</span>
                <span className="font-mono text-xs font-semibold" style={{ color: 'var(--status-live)' }}>
                  {result.functions?.length || 0}
                </span>
              </div>
              <div 
                className="p-2 rounded text-center"
                style={{ 
                  backgroundColor: 'var(--bg-inset)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <span className="block text-[8px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Strings</span>
                <span className="font-mono text-xs font-semibold animate-pulse" style={{ color: 'var(--accent)' }}>
                  {result.strings?.length || 0}
                </span>
              </div>
              <div 
                className="p-2 rounded text-center"
                style={{ 
                  backgroundColor: 'var(--bg-inset)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <span className="block text-[8px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Entry Point</span>
                <span className="font-mono text-[9px] font-semibold truncate block" style={{ color: 'var(--text-primary)' }}>
                  {result.entry_point || '—'}
                </span>
              </div>
            </div>

            {/* View in Code Explorer Trigger */}
            <button
              onClick={() => {
                if (onOpenExplorer) {
                  onOpenExplorer();
                }
              }}
              className="w-full h-9 flex items-center justify-center space-x-2 text-xs font-semibold rounded hover:opacity-90 transition-all duration-150"
              style={{
                backgroundColor: 'var(--status-live)',
                color: 'var(--bg-base)',
              }}
            >
              <Play className="h-3.5 w-3.5" />
              <span>View in Code Explorer</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HandoffPanel;

import React, { useMemo, useState, useEffect } from 'react';
import { AnalysisResult, FunctionRecord } from '../../types/analysis';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import { useAIExplain } from '../../hooks/useAIExplain';

interface CodeViewerPaneProps {
  result: AnalysisResult;
  activeFunction: FunctionRecord | null;
  activeTab: 'c' | 'asm';
  setActiveTab: (tab: 'c' | 'asm') => void;
  wordWrap: boolean;
  setWordWrap: (wrap: boolean) => void;
  filename: string;
  isDemoMode: boolean;
}

export const CodeViewerPane: React.FC<CodeViewerPaneProps> = ({
  result,
  activeFunction,
  activeTab,
  setActiveTab,
  wordWrap,
  setWordWrap,
  filename,
  isDemoMode,
}) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const {
    explainStatus,
    streamedText,
    tokensUsed,
    errorMessage,
    explain,
    clearExplanation,
  } = useAIExplain(isDemoMode);

  // Automatically reset the explanation and close the panel when switching functions
  useEffect(() => {
    clearExplanation();
    setIsPanelOpen(false);
  }, [activeFunction, clearExplanation]);
  // Get active code block based on selected tab
  const code = useMemo(() => {
    if (!activeFunction) return '';
    if (activeTab === 'c') {
      return activeFunction.pseudo_c;
    } else {
      return activeFunction.assembly || result.raw_assembly_snippet || '; No assembly code available';
    }
  }, [activeFunction, activeTab, result]);

  const handleCopyAll = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
  };

  const handleDownload = () => {
    if (!activeFunction) return;
    const extension = activeTab === 'c' ? 'c' : 'asm';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeFunction.name}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLineClick = (lineNum: number) => {
    const formatted = `${filename}:${lineNum}`;
    navigator.clipboard.writeText(formatted);
    // Silent confirmation, or we can flash something.
  };

  const codeLines = useMemo(() => {
    if (!code) return [];
    return code.split('\n');
  }, [code]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0F0F14] overflow-hidden">
      {/* Simulated environment warning banner */}
      {result.simulated && (
        <div className="bg-[#FEF3C7] text-[#92400E] border-b border-[#FDE68A] px-4 py-2 text-xs font-semibold flex items-center gap-2 select-none">
          <span>⚠ Simulated output — Ghidra not installed. Install Ghidra and re-run analysis for real results.</span>
        </div>
      )}

      {/* Toolbar & View Selectors */}
      <div className="h-10 border-b border-[#1E1E2E] bg-[#0A0A0F] flex items-center justify-between px-3 select-none flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('c')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'c'
                ? 'bg-[#1E1E2E] text-[#00FFC8]'
                : 'text-[#718096] hover:text-white'
            }`}
          >
            Pseudo-C
          </button>
          <button
            onClick={() => setActiveTab('asm')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'asm'
                ? 'bg-[#1E1E2E] text-[#00FFC8]'
                : 'text-[#718096] hover:text-white'
            }`}
          >
            Assembly
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* PHASE 5: AI Explain button — send pseudo_c to Claude API here */}
          {activeFunction && activeTab === 'c' && (
            <button
              onClick={() => {
                setIsPanelOpen(true);
                explain(activeFunction.name, result.arch, result);
              }}
              disabled={explainStatus === 'loading' || explainStatus === 'streaming'}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#00FFC8]/10 border border-[#00FFC8] text-[#00FFC8] text-[10px] font-bold rounded hover:bg-[#00FFC8]/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed duration-150 focus-visible:ring-1 focus-visible:ring-[#00FFC8] focus-visible:outline-none"
              title="Decompile and explain logic using Claude AI"
              aria-label="Explain decompiled code with Claude AI"
            >
              <svg className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z" />
              </svg>
              <span>Explain</span>
            </button>
          )}

          {activeFunction && (
            <div className="flex items-center gap-1 border-l border-[#1E1E2D] pl-3">
              {/* Copy Code */}
              <button
                onClick={handleCopyAll}
                className="p-1.5 text-[#718096] hover:text-[#00FFC8] rounded hover:bg-[#1E1E2E] transition-colors ti ti-copy"
                title="Copy all code to clipboard"
                aria-label="Copy code to clipboard"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                </svg>
              </button>

              {/* Download Code */}
              <button
                onClick={handleDownload}
                className="p-1.5 text-[#718096] hover:text-[#00FFC8] rounded hover:bg-[#1E1E2E] transition-colors ti ti-download"
                title={`Download as .${activeTab === 'c' ? 'c' : 'asm'}`}
                aria-label="Download code to disk"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                </svg>
              </button>

              {/* Word Wrap Toggle */}
              <button
                onClick={() => setWordWrap(!wordWrap)}
                className={`p-1.5 rounded transition-colors ti ti-text-wrap ${
                  wordWrap
                    ? 'text-[#00FFC8] bg-[#00FFC8]/10'
                    : 'text-[#718096] hover:text-white hover:bg-[#1E1E2E]'
                }`}
                title="Toggle word wrap"
                aria-label="Toggle code word wrap"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M4 19h16v-2H4v2zm16-6H4v2h16v-2zM4 9h16V7H4v2zm16-4H4v2h16V5z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Code Area with line numbers gutter */}
      <div className="flex-1 overflow-auto bg-[#0F0F14] relative">
        {activeFunction ? (
          <div className="flex min-h-full min-w-full font-mono text-[11px] leading-5 select-text">
            {/* Gutter Line Numbers */}
            <div className="select-none text-right pr-3 pl-2 text-[#4A5568] border-r border-[#1E1E2E] bg-[#0A0A0F] sticky left-0 z-10 w-12 flex-shrink-0 py-4">
              {codeLines.map((_, i) => (
                <div
                  key={i + 1}
                  onClick={() => handleLineClick(i + 1)}
                  className="cursor-pointer hover:text-[#00FFC8] h-5 leading-5 select-none transition-colors"
                  title="Click to copy filename:line"
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Content Highlight Block */}
            <div className="flex-1 min-w-0">
              <SyntaxHighlighter code={code} language={activeTab} wordWrap={wordWrap} />
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#718096] text-xs select-none">
            <span>← Select a function from the navigator to view its decompiled code.</span>
          </div>
        )}
      </div>

      {/* AI Explain Sliding Drawer Panel */}
      <div
        className="border-t border-[#1E1E2E] bg-[#0A0A0F] transition-all duration-200 ease-out overflow-hidden flex flex-col flex-shrink-0"
        style={{
          maxHeight: isPanelOpen ? '260px' : '0px',
        }}
      >
        {/* Panel Header */}
        <div className="h-9 px-3 border-b border-[#1E1E2E] flex items-center justify-between select-none bg-[#0B0B11]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              AI Analysis — {activeFunction?.name}
            </span>
            {(explainStatus === 'loading' || explainStatus === 'streaming') && (
              <span className="w-3 h-3 border border-[#00FFC8] border-t-transparent rounded-full animate-spin"></span>
            )}
          </div>
          <button
            onClick={() => {
              setIsPanelOpen(false);
              clearExplanation();
            }}
            className="text-slate-500 hover:text-white text-xs p-1"
            aria-label="Close AI Explanation Panel"
          >
            ✕
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 p-3 overflow-y-auto font-sans text-[13px] leading-[1.7] text-slate-300">
          {explainStatus === 'loading' && (
            <div className="text-slate-500 text-xs italic flex items-center gap-2">
              <span>Retrieving AST context and querying decompiler AI model...</span>
            </div>
          )}
          
          {(explainStatus === 'streaming' || explainStatus === 'done') && (
            <p className="whitespace-pre-wrap select-text m-0">{streamedText}</p>
          )}

          {explainStatus === 'error' && (
            <div className="bg-[#FF4C4C]/10 border border-[#FF4C4C]/30 rounded p-3 text-xs text-red-400 flex flex-col gap-2">
              <div className="font-semibold">Explain Error: {errorMessage}</div>
              <button
                onClick={() => explain(activeFunction!.name, result.arch, result)}
                className="w-fit px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white font-bold rounded transition-colors text-[10px]"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Panel Footer */}
        {explainStatus === 'done' && (
          <div className="h-6 px-3 border-t border-[#1E1E2E] flex items-center justify-between text-[9px] text-slate-500 bg-[#0B0B11]">
            <span>Generated by Claude</span>
            <span>{tokensUsed !== null ? `${tokensUsed} tokens` : ''} · Not a substitute for manual analysis</span>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useMemo, useState, useEffect } from 'react';
import { AnalysisResult, FunctionRecord } from '../../types/analysis';
import { highlightC, highlightAsm } from './SyntaxHighlighter';
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
  };

  const highlightedLines = useMemo(() => {
    if (!code) return [];
    const html = activeTab === 'c' ? highlightC(code) : highlightAsm(code);
    return html.split('\n');
  }, [code, activeTab]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-inset)' }}>
      {/* Simulated environment warning banner */}
      {result.simulated && (
        <div 
          className="px-4 py-1.5 text-[11px] font-semibold flex items-center gap-2 select-none"
          style={{ 
            backgroundColor: 'rgba(245, 158, 11, 0.05)', 
            borderColor: 'var(--status-warn)', 
            borderBottom: '1px solid var(--border-subtle)', 
            color: 'var(--status-warn)' 
          }}
        >
          <span>⚠ Simulated output — Ghidra not installed. Install Ghidra and re-run analysis for real results.</span>
        </div>
      )}

      {/* Toolbar & View Selectors */}
      <div 
        className="h-10 flex items-center justify-between px-3 select-none flex-shrink-0 bg-[#111111]"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-1 h-full">
          <button
            onClick={() => setActiveTab('c')}
            className="px-3 text-xs font-semibold transition-all duration-150 h-full border-b-2"
            style={{
              borderColor: activeTab === 'c' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'c' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
          >
            Pseudo-C
          </button>
          <button
            onClick={() => setActiveTab('asm')}
            className="px-3 text-xs font-semibold transition-all duration-150 h-full border-b-2"
            style={{
              borderColor: activeTab === 'asm' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'asm' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
          >
            Assembly
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Explain button */}
          {activeFunction && activeTab === 'c' && (
            <button
              onClick={() => {
                setIsPanelOpen(true);
                explain(activeFunction.name, result.arch, result);
              }}
              disabled={explainStatus === 'loading' || explainStatus === 'streaming'}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed duration-150"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)'
              }}
              title="Decompile and explain logic using Claude AI"
              aria-label="Explain decompiled code with Claude AI"
            >
              <svg className="w-3 h-3 fill-none stroke-current" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z" />
              </svg>
              <span>Explain</span>
            </button>
          )}

          {activeFunction && (
            <div className="flex items-center gap-1 pl-3" style={{ borderLeft: '1px solid var(--border-subtle)' }}>
              {/* Copy Code */}
              <button
                onClick={handleCopyAll}
                className="p-1.5 rounded transition-all hover:text-white duration-150"
                style={{ color: 'var(--text-secondary)' }}
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
                className="p-1.5 rounded transition-all hover:text-white duration-150"
                style={{ color: 'var(--text-secondary)' }}
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
                className="p-1.5 rounded transition-all duration-150"
                style={{ 
                  color: wordWrap ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: wordWrap ? 'var(--bg-elevated)' : 'transparent',
                  border: wordWrap ? '1px solid var(--border-default)' : '1px solid transparent'
                }}
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
      <div className="flex-1 overflow-auto relative bg-[#0F0F14] py-4 select-text">
        {activeFunction ? (
          <div className={`flex flex-col min-h-full font-mono text-[11px] leading-5 select-text ${wordWrap ? 'w-full' : 'min-w-fit'}`}>
            {highlightedLines.map((line, i) => (
              <div 
                key={i + 1} 
                className={`group flex leading-5 font-mono text-[11px] hover:bg-[#1C1C24] transition-colors duration-75 ${
                  wordWrap ? 'w-full' : 'min-w-fit'
                }`}
              >
                {/* Gutter Line Number */}
                <span 
                  onClick={() => handleLineClick(i + 1)}
                  className="select-none text-right pr-3 pl-4 sticky left-0 z-10 w-12 shrink-0 bg-[#0F0F14] group-hover:bg-[#1C1C24] border-r select-none transition-colors duration-75 cursor-pointer hover:text-white"
                  style={{
                    color: 'var(--text-muted)',
                    borderColor: 'rgba(255, 255, 255, 0.04)',
                  }}
                  title="Click to copy filename:line"
                >
                  {i + 1}
                </span>
                {/* Line Code */}
                <code 
                  className={`pl-4 select-text selection:bg-[rgba(255,255,255,0.08)] selection:text-white ${
                    wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                  }`}
                  dangerouslySetInnerHTML={{ __html: line || ' ' }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs select-none" style={{ color: 'var(--text-muted)' }}>
            <span>← Select a function from the navigator to view its decompiled code.</span>
          </div>
        )}
      </div>

      {/* AI Explain Sliding Drawer Panel */}
      <div
        className="transition-all duration-200 ease-out overflow-hidden flex flex-col flex-shrink-0"
        style={{
          maxHeight: isPanelOpen ? '260px' : '0px',
          borderTop: isPanelOpen ? '1px solid var(--border-subtle)' : 'none',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        {/* Panel Header */}
        <div 
          className="h-9 px-3 flex items-center justify-between select-none bg-[#111111]"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              AI Analysis — {activeFunction?.name}
            </span>
            {(explainStatus === 'loading' || explainStatus === 'streaming') && (
              <span className="w-2.5 h-2.5 border rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></span>
            )}
          </div>
          <button
            onClick={() => {
              setIsPanelOpen(false);
              clearExplanation();
            }}
            className="text-xs p-1"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close AI Explanation Panel"
          >
            ✕
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 p-3 overflow-y-auto font-sans text-xs leading-[1.6]" style={{ color: 'var(--text-primary)' }}>
          {explainStatus === 'loading' && (
            <div className="text-xs italic flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <span>Retrieving AST context and querying decompiler AI model...</span>
            </div>
          )}
          
          {(explainStatus === 'streaming' || explainStatus === 'done') && (
            <p className="whitespace-pre-wrap select-text m-0">{streamedText}</p>
          )}

          {explainStatus === 'error' && (
            <div 
              className="rounded p-3 text-xs flex flex-col gap-2"
              style={{ 
                backgroundColor: 'rgba(248, 113, 113, 0.05)', 
                border: '1px solid var(--status-error)', 
                color: 'var(--status-error)' 
              }}
            >
              <div className="font-semibold">Explain Error: {errorMessage}</div>
              <button
                onClick={() => explain(activeFunction!.name, result.arch, result)}
                className="w-fit px-2.5 py-1 text-[10px] font-bold rounded transition-colors"
                style={{
                  backgroundColor: 'var(--status-error)',
                  color: 'var(--bg-base)'
                }}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Panel Footer */}
        {explainStatus === 'done' && (
          <div 
            className="h-6 px-3 flex items-center justify-between text-[9px] bg-[#111111]"
            style={{ 
              borderTop: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)'
            }}
          >
            <span>Generated by Claude</span>
            <span>{tokensUsed !== null ? `${tokensUsed} tokens` : ''} · Not a substitute for manual analysis</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeViewerPane;

import React, { useState, useEffect, useRef } from 'react';
import { AnalysisResult, FunctionRecord } from '../../types/analysis';
import { useCodeExplorer } from '../../hooks/useCodeExplorer';
import { NavigatorPane } from './NavigatorPane';
import { CodeViewerPane } from './CodeViewerPane';
import { HexDumpPane } from './HexDumpPane';
import { GlobalSearch } from './GlobalSearch';
import { generateReportHtml } from '../../utils/reportGenerator';
import { HexDumpErrorBoundary } from './ErrorBoundary';

interface CodeExplorerProps {
  result: AnalysisResult;
  flashBuffer: Uint8Array | null;
  onClose: () => void;
  isDemoMode: boolean;
}

export const CodeExplorer: React.FC<CodeExplorerProps> = ({
  result,
  flashBuffer,
  onClose,
  isDemoMode,
}) => {
  const {
    activeFunction,
    setActiveFunction,
    activeTab,
    setActiveTab,
    navigatorTab,
    setNavigatorTab,
    navigatorFilter,
    setNavigatorFilter,
    wordWrapEnabled,
    setWordWrapEnabled,
    splitterWidthPercent,
    setSplitterWidthPercent,
  } = useCodeExplorer(result);

  const [isDragging, setIsDragging] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeMobilePane, setActiveMobilePane] = useState<'navigator' | 'code' | 'hex'>('code');

  const containerRef = useRef<HTMLDivElement>(null);
  const filename = `firmware_${result.arch || 'unknown'}.bin`;

  // Monitor screen width to trigger responsive viewports
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 900);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Trigger entering transition on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setAnimate(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Handle closed animation delay
  const handleClose = () => {
    setAnimate(false);
    setTimeout(() => {
      onClose();
    }, 150); // wait for 150ms opacity transition to finish
  };

  // Focus trap implementation for enhanced accessibility
  useEffect(() => {
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusable = containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, []);

  // Drag splitter between Pane B and Pane C
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const percent = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      const clamped = Math.max(20, Math.min(50, percent));
      setSplitterWidthPercent(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, setSplitterWidthPercent]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (isInput) {
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur();
        }
        return;
      }

      const key = e.key.toLowerCase();

      // 'G' to focus Jump-to-address in HexDump
      if (key === 'g') {
        e.preventDefault();
        const jumpInput = document.querySelector('input[placeholder*="Jump to address"]') as HTMLInputElement;
        jumpInput?.focus();
        jumpInput?.select();
      }
      // Escape to close explorer
      else if (e.key === 'Escape') {
        handleClose();
      }
      // Ctrl+C to copy active code pane content
      else if ((e.ctrlKey || e.metaKey) && key === 'c') {
        if (activeFunction) {
          e.preventDefault();
          const code = activeTab === 'c'
            ? activeFunction.pseudo_c
            : activeFunction.assembly || result.raw_assembly_snippet || '';
          navigator.clipboard.writeText(code);
          alert('Copied function code to clipboard.');
        }
      }
      // Arrow Up/Down to navigate functions list
      else if (navigatorTab === 'functions' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (result.functions && result.functions.length > 0) {
          e.preventDefault();
          const currentIndex = result.functions.findIndex(f => f.name === activeFunction?.name);
          let nextIndex = currentIndex;
          if (e.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % result.functions.length;
          } else {
            nextIndex = (currentIndex - 1 + result.functions.length) % result.functions.length;
          }
          if (nextIndex >= 0 && nextIndex < result.functions.length) {
            setActiveFunction(result.functions[nextIndex]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, activeFunction, activeTab, navigatorTab, result, setActiveFunction]);

  const handleExportReport = () => {
    const html = generateReportHtml(result, filename);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `binino_report_${result.job_id}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAllCCode = () => {
    if (!result.functions || result.functions.length === 0) return;
    const allCode = result.functions
      .map(f => `// --- Function: ${f.name} (${f.address}) ---\n${f.pseudo_c}`)
      .join('\n\n');
    navigator.clipboard.writeText(allCode);
    alert('All function decompiled C code copied to clipboard!');
  };

  const handleSelectFunction = (func: FunctionRecord) => {
    setNavigatorTab('functions');
    setActiveFunction(func);
    if (isMobile) {
      setActiveMobilePane('code');
    }
  };

  const handleSelectString = (address: string) => {
    setNavigatorTab('strings');
    if (isMobile) {
      setActiveMobilePane('hex');
    }
    setTimeout(() => {
      const jumpInput = document.querySelector('input[placeholder*="Jump to address"]') as HTMLInputElement;
      if (jumpInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(jumpInput, address);
        const ev = new Event('input', { bubbles: true });
        jumpInput.dispatchEvent(ev);
        const form = jumpInput.closest('form');
        form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 50);
  };

  const handleSelectSymbol = (name: string, type?: string, address?: string) => {
    setNavigatorTab('symbols');
    if (type === 'Function' || result.functions.some(f => f.name === name)) {
      const func = result.functions.find(f => f.name === name);
      if (func) {
        handleSelectFunction(func);
        setActiveTab('c');
      }
    } else if (address) {
      handleSelectString(address);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-sm flex items-center justify-center transition-all duration-150 ease-out select-none ${
        animate ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`w-full h-full bg-[#0A0A0F] text-[#E2E8F0] flex flex-col font-sans transition-all duration-150 ease-out ${
          animate ? 'scale-100' : 'scale-[0.98]'
        }`}
      >
        {/* EXPLORER TOP BAR (40px) */}
        <div className="h-10 bg-[#0B0B11] border-b border-[#1E1E2E] flex items-center justify-between px-4 flex-shrink-0">
          
          {/* Left branding */}
          <div className="flex items-center gap-2">
            <span className="text-[#00FFC8] font-bold text-xs uppercase tracking-widest">Binino</span>
            <span className="text-[#4A5568] text-xs">/</span>
            <span className="text-xs text-white/90 truncate font-mono max-w-[120px]" title={filename}>
              {filename}
            </span>
            <span className="px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-widest text-[#00FFC8] bg-[#00FFC8]/10 rounded border border-[#00FFC8]/30">
              {result.arch}
            </span>
          </div>

          {/* Center Global Search */}
          <GlobalSearch
            result={result}
            onSelectFunction={handleSelectFunction}
            onSelectString={handleSelectString}
            onSelectSymbol={handleSelectSymbol}
          />

          {/* Right utility actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAllCCode}
              className="h-7 px-2.5 bg-[#12121A] hover:bg-[#1C1C2C] border border-[#232334] text-[10px] text-white/80 font-semibold rounded transition-all active:scale-[0.98] duration-150"
            >
              Copy All C Code
            </button>
            <button
              onClick={handleExportReport}
              className="h-7 px-2.5 bg-[#12121A] hover:bg-[#1C1C2C] border border-[#232334] text-[10px] text-white/80 font-semibold rounded transition-all active:scale-[0.98] duration-150"
            >
              Export Report
            </button>
            <button
              onClick={handleClose}
              className="h-7 px-2.5 bg-[#2E161B] hover:bg-[#3E1A23] border border-[#4E222D] text-[10px] text-red-400 font-bold rounded transition-all active:scale-[0.98] duration-150"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Mobile Sub-Header Selector Tabs (<900px wide screen) */}
        {isMobile && (
          <div className="flex bg-[#0B0B11] border-b border-[#1E1E2E] p-1 flex-shrink-0">
            {(['navigator', 'code', 'hex'] as const).map((pane) => {
              const isActive = activeMobilePane === pane;
              return (
                <button
                  key={pane}
                  onClick={() => setActiveMobilePane(pane)}
                  className={`flex-1 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded transition-all ${
                    isActive
                      ? 'bg-[#1E1E2E] text-[#00FFC8]'
                      : 'text-[#718096] hover:text-white'
                  }`}
                >
                  {pane === 'navigator' ? 'Navigator' : pane === 'code' ? 'Code Viewer' : 'Hex Dump'}
                </button>
              );
            })}
          </div>
        )}

        {/* Main Grid View Area */}
        <div className="flex-1 flex overflow-hidden">
          {isMobile ? (
            /* MOBILE SINGLE-PANE VIEW */
            <div className="flex-1 h-full w-full overflow-hidden">
              {activeMobilePane === 'navigator' && (
                <NavigatorPane
                  result={result}
                  activeFunction={activeFunction}
                  onSelectFunction={handleSelectFunction}
                  onSelectString={handleSelectString}
                  onSelectSymbol={handleSelectSymbol}
                  activeTab={navigatorTab}
                  setActiveTab={setNavigatorTab}
                  filterText={navigatorFilter}
                  setFilterText={setNavigatorFilter}
                />
              )}
              {activeMobilePane === 'code' && (
                <CodeViewerPane
                  result={result}
                  activeFunction={activeFunction}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  wordWrap={wordWrapEnabled}
                  setWordWrap={setWordWrapEnabled}
                  filename={filename}
                  isDemoMode={isDemoMode}
                />
              )}
              {activeMobilePane === 'hex' && (
                <HexDumpErrorBoundary>
                  <HexDumpPane
                    result={result}
                    flashBuffer={flashBuffer}
                    activeFunction={activeFunction}
                    onJumpToAddress={handleSelectString}
                  />
                </HexDumpErrorBoundary>
              )}
            </div>
          ) : (
            /* DESKTOP 3-PANE GRID LAYOUT */
            <>
              {/* Pane A: Navigator */}
              <NavigatorPane
                result={result}
                activeFunction={activeFunction}
                onSelectFunction={handleSelectFunction}
                onSelectString={handleSelectString}
                onSelectSymbol={handleSelectSymbol}
                activeTab={navigatorTab}
                setActiveTab={setNavigatorTab}
                filterText={navigatorFilter}
                setFilterText={setNavigatorFilter}
              />

              {/* Dynamic Split Area: Pane B (middle) & Pane C (right) */}
              <div className="flex-1 flex overflow-hidden relative">
                {/* Pane B: Code Viewer */}
                <div className="flex-1 h-full min-w-[200px] overflow-hidden">
                  <CodeViewerPane
                    result={result}
                    activeFunction={activeFunction}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    wordWrap={wordWrapEnabled}
                    setWordWrap={setWordWrapEnabled}
                    filename={filename}
                    isDemoMode={isDemoMode}
                  />
                </div>

                {/* Resizable Vertical Splitter Bar */}
                <div
                  onMouseDown={handleMouseDown}
                  className={`w-1 cursor-col-resize hover:bg-[#00FFC8] select-none h-full z-20 flex-shrink-0 transition-colors ${
                    isDragging ? 'bg-[#00FFC8]' : 'bg-[#1E1E2E]'
                  }`}
                />

                {/* Pane C: Hex Dump with Inner Error Boundary wrapping */}
                <div
                  className="h-full min-w-[200px] shrink-0"
                  style={{ width: `${splitterWidthPercent}%` }}
                >
                  <HexDumpErrorBoundary>
                    <HexDumpPane
                      result={result}
                      flashBuffer={flashBuffer}
                      activeFunction={activeFunction}
                      onJumpToAddress={handleSelectString}
                    />
                  </HexDumpErrorBoundary>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default CodeExplorer;

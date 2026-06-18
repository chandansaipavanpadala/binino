import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AnalysisResult, FunctionRecord } from '../../types/analysis';

interface NavigatorPaneProps {
  result: AnalysisResult;
  activeFunction: FunctionRecord | null;
  onSelectFunction: (func: FunctionRecord) => void;
  onSelectString: (address: string) => void;
  onSelectSymbol: (name: string, type?: string, address?: string) => void;
  activeTab: 'functions' | 'strings' | 'symbols';
  setActiveTab: (tab: 'functions' | 'strings' | 'symbols') => void;
  filterText: string;
  setFilterText: (text: string) => void;
}

export const NavigatorPane: React.FC<NavigatorPaneProps> = ({
  result,
  activeFunction,
  onSelectFunction,
  onSelectString,
  onSelectSymbol,
  activeTab,
  setActiveTab,
  filterText,
  setFilterText,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Keep track of scroll position for custom virtualization of functions
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Find the entry point function
  const entryFunction = useMemo(() => {
    return result.functions.find(
      f => f.address.toLowerCase() === result.entry_point.toLowerCase()
    );
  }, [result]);

  // Filter Functions
  const filteredFunctions = useMemo(() => {
    const q = filterText.toLowerCase();
    if (!q) return result.functions;
    return result.functions.filter(
      f => f.name.toLowerCase().includes(q) || f.address.toLowerCase().includes(q)
    );
  }, [result.functions, filterText]);

  // Filter Strings
  const filteredStrings = useMemo(() => {
    const q = filterText.toLowerCase();
    if (!q) return result.strings;
    return result.strings.filter(
      s => s.value.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
    );
  }, [result.strings, filterText]);

  // Filter Symbols
  const filteredSymbols = useMemo(() => {
    const q = filterText.toLowerCase();
    if (!q) return result.symbols;
    return result.symbols.filter(
      sym => sym.name.toLowerCase().includes(q) || sym.address.toLowerCase().includes(q)
    );
  }, [result.symbols, filterText]);

  // Reset scroll top when tab changes
  useEffect(() => {
    setScrollTop(0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // --- VIRTUALIZATION CONSTANTS FOR FUNCTIONS ---
  const ROW_HEIGHT = 38;
  const OVERSCAN = 5;

  const virtualFunctions = useMemo(() => {
    const total = filteredFunctions.length;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(total, Math.ceil((scrollTop + 500) / ROW_HEIGHT) + OVERSCAN);
    
    const items = [];
    for (let i = startIndex; i < endIndex; i++) {
      items.push({
        index: i,
        func: filteredFunctions[i],
        top: i * ROW_HEIGHT,
      });
    }
    return {
      items,
      totalHeight: total * ROW_HEIGHT,
    };
  }, [filteredFunctions, scrollTop]);

  const truncateString = (str: string, maxLen = 30) => {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  };

  return (
    <div 
      className="flex flex-col h-full select-none min-w-[200px] w-[22%]"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Navigator Top Search & Filter Bar */}
      <div className="p-3 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="relative">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={`Filter ${activeTab}...`}
            className="w-full h-8 pl-8 pr-6 text-xs text-[#F0F0F0] rounded focus:outline-none transition-colors"
            style={{
              backgroundColor: 'var(--bg-inset)',
              border: '1px solid var(--border-default)',
            }}
          />
          <span className="absolute left-2.5 top-2.5" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
            </svg>
          </span>
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="absolute right-2.5 top-2 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Tab Row Navigation */}
        <div 
          className="flex p-0.5 rounded" 
          style={{
            backgroundColor: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
          }}
          role="tablist" 
          aria-label="Navigator view tabs"
        >
          {(['functions', 'strings', 'symbols'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveTab(tab);
                  setFilterText('');
                }}
                className="flex-1 py-1 text-[9px] uppercase font-bold tracking-wider rounded transition-all duration-150 focus:outline-none"
                style={{
                  backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)'
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pane Content Area */}
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef} onScroll={handleScroll}>
        {activeTab === 'functions' && (
          <div className="flex flex-col h-full">
            {/* Pinned Entry Point Function */}
            {entryFunction && !filterText && (
              <div 
                className="p-2 flex flex-col gap-1"
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid var(--border-subtle)'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold tracking-widest uppercase flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                    ⚑ Entry Point
                  </span>
                  <span 
                    className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'var(--bg-inset)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {entryFunction.address}
                  </span>
                </div>
                <button
                  onClick={() => onSelectFunction(entryFunction)}
                  className="w-full text-left px-2 py-1 rounded font-mono text-xs truncate transition-all duration-150"
                  style={{
                    backgroundColor: activeFunction?.address === entryFunction.address ? 'var(--bg-elevated)' : 'transparent',
                    border: activeFunction?.address === entryFunction.address ? '1px solid var(--border-default)' : '1px solid transparent',
                    color: activeFunction?.address === entryFunction.address ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}
                >
                  {entryFunction.name}
                </button>
              </div>
            )}

            {/* List Header/Label */}
            <div 
              className="px-3 py-1.5 text-[8px] font-bold tracking-wider uppercase"
              style={{
                backgroundColor: 'var(--bg-inset)',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)'
              }}
            >
              All Functions ({filteredFunctions.length})
            </div>

            {/* Virtual Scroll Container */}
            <div className="relative w-full flex-1 overflow-hidden" style={{ minHeight: '150px' }}>
              {result.functions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-4 h-full space-y-2" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-6 h-6 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
                  </svg>
                  <p className="text-[10px] max-w-[170px] leading-relaxed">
                    No functions identified. The binary may be encrypted, packed, or the wrong architecture was selected.
                  </p>
                </div>
              ) : (
                <div
                  className="overflow-y-auto h-full w-full"
                  onScroll={handleScroll}
                >
                  <div
                    className="w-full relative"
                    style={{ height: `${virtualFunctions.totalHeight}px` }}
                  >
                    {virtualFunctions.items.map(({ index, func, top }) => {
                      const isSelected = activeFunction?.name === func.name;
                      const isEntry = func.address.toLowerCase() === result.entry_point.toLowerCase();
                      return (
                        <div
                          key={func.name + '-' + index}
                          className="absolute left-0 right-0 px-2 flex items-center"
                          style={{ top: `${top}px`, height: `${ROW_HEIGHT}px` }}
                        >
                          <button
                            onClick={() => onSelectFunction(func)}
                            className="w-full flex items-center justify-between px-2 py-1 rounded text-left transition-all duration-150"
                            style={{
                              backgroundColor: isSelected ? 'var(--bg-elevated)' : 'transparent',
                              borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
                            }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span 
                                className="font-mono text-[9px] px-1 rounded flex-shrink-0"
                                style={{
                                  backgroundColor: 'var(--bg-inset)',
                                  color: isSelected ? 'var(--accent)' : 'var(--text-muted)'
                                }}
                              >
                                {func.address}
                              </span>
                              <span className="font-mono text-xs truncate">
                                {func.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isEntry && (
                                <span 
                                  className="text-[8px] font-bold px-1 rounded border"
                                  style={{
                                    backgroundColor: 'rgba(74, 222, 128, 0.05)',
                                    borderColor: 'rgba(74, 222, 128, 0.15)',
                                    color: 'var(--status-live)'
                                  }}
                                >
                                  ⚑
                                </span>
                              )}
                              {func.size && (
                                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                  {func.size}B
                                </span>
                              )}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'strings' && (
          <div className="p-3">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr 
                  className="text-[9px] uppercase tracking-wider font-bold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <th className="pb-2 font-bold" style={{ borderBottom: '1px solid var(--border-subtle)' }}>Address</th>
                  <th className="pb-2 font-bold" style={{ borderBottom: '1px solid var(--border-subtle)' }}>Value</th>
                  <th className="pb-2 font-bold text-right" style={{ borderBottom: '1px solid var(--border-subtle)' }}>Encoding</th>
                </tr>
              </thead>
              <tbody>
                {filteredStrings.map((s, idx) => (
                  <tr
                    key={s.address + '-' + idx}
                    onClick={() => onSelectString(s.address)}
                    className="cursor-pointer group"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <td className="py-2 font-mono text-[9px] pr-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {s.address}
                    </td>
                    <td
                      className="py-2 max-w-[120px] truncate group-hover:text-white transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      title={s.value}
                    >
                      {truncateString(s.value)}
                    </td>
                    <td className="py-2 text-[9px] text-right uppercase" style={{ color: 'var(--text-muted)' }}>
                      {s.encoding || 'ASCII'}
                    </td>
                  </tr>
                ))}
                {filteredStrings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                      No strings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'symbols' && (
          <div className="p-3">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr 
                  className="text-[9px] uppercase tracking-wider font-bold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <th className="pb-2 font-bold" style={{ borderBottom: '1px solid var(--border-subtle)' }}>Address</th>
                  <th className="pb-2 font-bold" style={{ borderBottom: '1px solid var(--border-subtle)' }}>Name</th>
                  <th className="pb-2 font-bold text-right" style={{ borderBottom: '1px solid var(--border-subtle)' }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredSymbols.map((sym, idx) => (
                  <tr
                    key={sym.address + '-' + idx}
                    onClick={() => onSelectSymbol(sym.name, sym.type, sym.address)}
                    className="cursor-pointer group"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <td className="py-2 font-mono text-[9px] pr-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {sym.address}
                    </td>
                    <td 
                      className="py-2 max-w-[120px] truncate group-hover:text-white transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {sym.name}
                    </td>
                    <td className="py-2 text-right">
                      <span 
                        className="text-[8px] px-1 py-0.5 rounded uppercase font-bold"
                        style={{
                          backgroundColor: sym.type === 'Function' ? 'rgba(74, 222, 128, 0.05)' : 'var(--bg-inset)',
                          border: '1px solid var(--border-subtle)',
                          color: sym.type === 'Function' ? 'var(--status-live)' : 'var(--text-secondary)'
                        }}
                      >
                        {sym.type || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredSymbols.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                      No symbols found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavigatorPane;

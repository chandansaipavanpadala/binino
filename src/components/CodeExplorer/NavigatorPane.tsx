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
  const ROW_HEIGHT = 42;
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

  const truncateString = (str: string, maxLen = 60) => {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] border-r border-[#1E1E2E] w-[22%] select-none min-w-[200px]">
      {/* Navigator Top Search & Filter Bar */}
      <div className="p-3 border-b border-[#1E1E2E] flex flex-col gap-2">
        <div className="relative">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={`Filter ${activeTab}...`}
            className="w-full h-8 pl-8 pr-3 bg-[#12121A] text-xs text-white rounded border border-[#232334] focus:outline-none focus:border-[#00FFC8] transition-colors"
          />
          <span className="absolute left-2.5 top-2.5 text-[#4A5568]">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
            </svg>
          </span>
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="absolute right-2.5 top-2 text-[#718096] hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tab Row Navigation */}
        <div className="flex bg-[#12121A] p-0.5 rounded border border-[#1E1E2D]" role="tablist" aria-label="Navigator view tabs">
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
                className={`flex-1 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-all focus-visible:ring-1 focus-visible:ring-[#00FFC8] focus-visible:outline-none ${
                  isActive
                    ? 'bg-[#1E1E2E] text-[#00FFC8]'
                    : 'text-[#718096] hover:text-white'
                }`}
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
              <div className="p-2 bg-[#172521] border-b border-[#1E3B33] flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-[#00FFC8] tracking-widest uppercase flex items-center gap-1">
                    <span className="text-xs">⚑</span> Entry Point
                  </span>
                  <span className="font-mono text-[9px] text-[#4FD1C5]/80 bg-[#142D28] px-1.5 py-0.5 rounded">
                    {entryFunction.address}
                  </span>
                </div>
                <button
                  onClick={() => onSelectFunction(entryFunction)}
                  className={`w-full text-left px-2 py-1.5 rounded font-mono text-xs truncate transition-all ${
                    activeFunction?.address === entryFunction.address
                      ? 'bg-[#00FFC8]/10 text-[#00FFC8] border border-[#00FFC8]/30'
                      : 'text-white/80 hover:bg-[#1E1E2E] border border-transparent'
                  }`}
                >
                  {entryFunction.name}
                </button>
              </div>
            )}

            {/* List Header/Label */}
            <div className="px-3 py-1.5 bg-[#0D0D15] text-[9px] font-bold text-[#4A5568] tracking-wider uppercase border-b border-[#1E1E2E]">
              All Functions ({filteredFunctions.length})
            </div>

            {/* Virtual Scroll Container */}
            <div className="relative w-full flex-1 overflow-hidden" style={{ minHeight: '150px' }}>
              {result.functions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-4 h-full space-y-2.5">
                  <svg className="w-8 h-8 text-slate-600/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
                  </svg>
                  <p className="text-[11px] text-slate-500 max-w-[170px] leading-relaxed">
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
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-all ${
                              isSelected
                                ? 'bg-[#1A1A2E] text-[#00FFC8] border border-[#00FFC8]/20'
                                : 'text-[#A0AEC0] hover:bg-[#12121A] hover:text-white border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[9px] text-[#00FFC8]/70 bg-[#162725] px-1 rounded flex-shrink-0">
                                {func.address}
                              </span>
                              <span className="font-mono text-xs truncate">
                                {func.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isEntry && (
                                <span className="text-[8px] bg-[#1B2D29] text-[#00FFC8] font-bold px-1 rounded border border-[#1E4339]">
                                  ⚑
                                </span>
                              )}
                              {func.size && (
                                <span className="text-[9px] text-[#4A5568]">
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
          <div className="p-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E1E2E] text-[#4A5568] text-[9px] uppercase tracking-wider font-bold">
                  <th className="pb-1.5 font-bold">Address</th>
                  <th className="pb-1.5 font-bold">Value</th>
                  <th className="pb-1.5 font-bold">Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredStrings.map((s, idx) => (
                  <tr
                    key={s.address + '-' + idx}
                    onClick={() => onSelectString(s.address)}
                    className="border-b border-[#12121A] hover:bg-[#12121A]/60 cursor-pointer group"
                  >
                    <td className="py-2 font-mono text-[10px] text-[#4FD1C5]/70 pr-2 whitespace-nowrap">
                      {s.address}
                    </td>
                    <td
                      className="py-2 text-[#A0AEC0] group-hover:text-white max-w-[120px] truncate"
                      title={s.value}
                    >
                      {truncateString(s.value)}
                    </td>
                    <td className="py-2 text-[9px] text-[#718096] text-right uppercase">
                      {s.encoding || 'ASCII'}
                    </td>
                  </tr>
                ))}
                {filteredStrings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-[#4A5568]">
                      No strings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'symbols' && (
          <div className="p-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E1E2E] text-[#4A5568] text-[9px] uppercase tracking-wider font-bold">
                  <th className="pb-1.5 font-bold">Address</th>
                  <th className="pb-1.5 font-bold">Name</th>
                  <th className="pb-1.5 font-bold">Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredSymbols.map((sym, idx) => (
                  <tr
                    key={sym.address + '-' + idx}
                    onClick={() => onSelectSymbol(sym.name, sym.type, sym.address)}
                    className="border-b border-[#12121A] hover:bg-[#12121A]/60 cursor-pointer group"
                  >
                    <td className="py-2 font-mono text-[10px] text-[#4FD1C5]/70 pr-2 whitespace-nowrap">
                      {sym.address}
                    </td>
                    <td className="py-2 text-[#A0AEC0] group-hover:text-white max-w-[120px] truncate">
                      {sym.name}
                    </td>
                    <td className="py-2">
                      <span className={`text-[9px] px-1 rounded uppercase font-bold ${
                        sym.type === 'Function'
                          ? 'bg-[#152F2C] text-[#4EC9B0]'
                          : 'bg-[#1F2C3D] text-[#569CD6]'
                      }`}>
                        {sym.type || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredSymbols.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-[#4A5568]">
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

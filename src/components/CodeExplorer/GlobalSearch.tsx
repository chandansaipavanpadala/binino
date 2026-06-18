import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnalysisResult, FunctionRecord } from '../../types/analysis';

interface GlobalSearchProps {
  result: AnalysisResult;
  onSelectFunction: (func: FunctionRecord) => void;
  onSelectString: (address: string) => void;
  onSelectSymbol: (name: string, type?: string, address?: string) => void;
}

interface SearchResultItem {
  category: 'function' | 'string' | 'symbol';
  name: string;
  address: string;
  detail: string;
  raw: any;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  result,
  onSelectFunction,
  onSelectString,
  onSelectSymbol,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ctrl+K to focus
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Perform search across functions, strings, symbols
  const flatResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const matchedFunctions: SearchResultItem[] = (result.functions || [])
      .filter(f => f.name.toLowerCase().includes(q) || f.address.toLowerCase().includes(q))
      .map(f => ({
        category: 'function',
        name: f.name,
        address: f.address,
        detail: `Size: ${f.size || 0} bytes`,
        raw: f,
      }));

    const matchedStrings: SearchResultItem[] = (result.strings || [])
      .filter(s => s.value.toLowerCase().includes(q) || s.address.toLowerCase().includes(q))
      .map(s => ({
        category: 'string',
        name: s.value,
        address: s.address,
        detail: `Encoding: ${s.encoding || 'ASCII'}`,
        raw: s,
      }));

    const matchedSymbols: SearchResultItem[] = (result.symbols || [])
      .filter(sym => sym.name.toLowerCase().includes(q) || sym.address.toLowerCase().includes(q))
      .map(sym => ({
        category: 'symbol',
        name: sym.name,
        address: sym.address,
        detail: `Type: ${sym.type || 'Unknown'}`,
        raw: sym,
      }));

    // Cap results for performance
    return [...matchedFunctions, ...matchedStrings, ...matchedSymbols].slice(0, 20);
  }, [query, result]);

  // Reset activeIndex when query or results change
  useEffect(() => {
    setActiveIndex(0);
  }, [flatResults]);

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false);
    setQuery('');
    
    if (item.category === 'function') {
      onSelectFunction(item.raw as FunctionRecord);
    } else if (item.category === 'string') {
      onSelectString(item.address);
    } else if (item.category === 'symbol') {
      onSelectSymbol(item.name, item.raw.type, item.address);
    }
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (isOpen) {
        e.stopPropagation();
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatResults.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatResults.length > 0) {
        setActiveIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[activeIndex]) {
        handleSelect(flatResults[activeIndex]);
      }
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search functions, strings, symbols..."
          className="w-full h-7 pl-8 pr-16 text-xs text-[#F0F0F0] rounded focus:outline-none transition-colors"
          style={{
            backgroundColor: 'var(--bg-inset)',
            border: '1px solid var(--border-default)',
          }}
        />
        {/* Search Icon */}
        <span className="absolute left-2.5 top-2" style={{ color: 'var(--text-muted)' }}>
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </span>
        {/* Keyboard shortcut indicator */}
        <div 
          className="absolute right-2 top-1 hidden sm:flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded border"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)'
          }}
        >
          <span>Ctrl</span>
          <span>+</span>
          <span>K</span>
        </div>
      </div>

      {isOpen && flatResults.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[100] left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded shadow-2xl py-1"
          style={{ 
            backgroundColor: 'var(--bg-surface)', 
            border: '1px solid var(--border-default)' 
          }}
        >
          {flatResults.map((item, idx) => {
            const isHighlighted = idx === activeIndex;
            return (
              <div
                key={`${item.category}-${item.address}-${idx}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                className="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-xs border-l-2"
                style={{
                  backgroundColor: isHighlighted ? 'var(--bg-elevated)' : 'transparent',
                  borderLeftColor: isHighlighted ? 'var(--accent)' : 'transparent',
                  color: isHighlighted ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
              >
                <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                  <span className="font-semibold truncate max-w-[280px]">
                    {item.name}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {item.detail}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span 
                    className="font-mono text-[9px] px-1 py-0.5 rounded"
                    style={{
                      backgroundColor: 'var(--bg-inset)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {item.address}
                  </span>
                  <span 
                    className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border"
                    style={{
                      color: item.category === 'function' ? 'var(--status-live)' : item.category === 'string' ? 'var(--status-warn)' : 'var(--status-info)',
                      backgroundColor: item.category === 'function' ? 'rgba(74, 222, 128, 0.05)' : item.category === 'string' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(96, 165, 250, 0.05)',
                      borderColor: item.category === 'function' ? 'rgba(74, 222, 128, 0.15)' : item.category === 'string' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(96, 165, 250, 0.15)',
                    }}
                  >
                    {item.category}
                  </span>
                </div>
              </div>
            );
          })}
          
          {/* Footer with keybind hints */}
          <div 
            className="flex items-center justify-between px-3 py-1.5 border-t text-[9px]"
            style={{ 
              borderTop: '1px solid var(--border-subtle)', 
              backgroundColor: 'var(--bg-inset)', 
              color: 'var(--text-muted)' 
            }}
          >
            <span>{flatResults.length} matches found</span>
            <div className="flex items-center gap-1.5">
              <span>↑↓ to navigate</span>
              <span>•</span>
              <span>↵ to select</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;

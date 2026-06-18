import { useState, useEffect } from 'react';
import { AnalysisResult, FunctionRecord } from '../types/analysis';

/**
 * Hook for managing the state of the Code Explorer IDE.
 * Persists wordWrapEnabled and splitterWidthPercent in localStorage (and ONLY these two variables).
 */
export const useCodeExplorer = (result: AnalysisResult | null) => {
  const [activeFunction, setActiveFunction] = useState<FunctionRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'c' | 'asm'>('c');
  const [navigatorTab, setNavigatorTab] = useState<'functions' | 'strings' | 'symbols'>('functions');
  const [navigatorFilter, setNavigatorFilter] = useState('');
  
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [hexJumpAddress, setHexJumpAddress] = useState('');
  const [hexJumpError, setHexJumpError] = useState<string | null>(null);
  
  // LocalStorage Persisted States (Explicitly the only two localStorage fields in this workspace)
  const [wordWrapEnabled, setWordWrapEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('binino_word_wrap');
    return saved ? saved === 'true' : false;
  });
  
  const [splitterWidthPercent, setSplitterWidthPercent] = useState<number>(() => {
    const saved = localStorage.getItem('binino_splitter_width');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 20 && parsed <= 50) {
        return parsed;
      }
    }
    return 30; // default 30% for Pane C
  });

  // Automatically select the entry point function or the first function if available
  useEffect(() => {
    if (result && result.functions && result.functions.length > 0) {
      const entryFunc = result.functions.find(
        (f) => f.address.toLowerCase() === result.entry_point.toLowerCase()
      );
      setActiveFunction(entryFunc || result.functions[0]);
    } else {
      setActiveFunction(null);
    }
  }, [result]);

  // Persist word wrap to localStorage
  useEffect(() => {
    localStorage.setItem('binino_word_wrap', String(wordWrapEnabled));
  }, [wordWrapEnabled]);

  // Persist splitter position to localStorage
  useEffect(() => {
    localStorage.setItem('binino_splitter_width', String(splitterWidthPercent));
  }, [splitterWidthPercent]);

  return {
    activeFunction,
    setActiveFunction,
    activeTab,
    setActiveTab,
    navigatorTab,
    setNavigatorTab,
    navigatorFilter,
    setNavigatorFilter,
    globalSearchQuery,
    setGlobalSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
    hexJumpAddress,
    setHexJumpAddress,
    hexJumpError,
    setHexJumpError,
    wordWrapEnabled,
    setWordWrapEnabled,
    splitterWidthPercent,
    setSplitterWidthPercent,
  };
};

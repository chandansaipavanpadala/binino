import { useState, useCallback, useRef, useEffect } from 'react';
import { AnalysisResult } from '../types/analysis';

export type ExplainStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

/**
 * Hook to manage AI function explanation streaming.
 * Automatically delegates to client-side emulation when in Demo Mode.
 */
export const useAIExplain = (isDemoMode: boolean) => {
  const [explainStatus, setExplainStatus] = useState<ExplainStatus>('idle');
  const [streamedText, setStreamedText] = useState('');
  const [tokensUsed, setTokensUsed] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Interval reference for clearing active simulation timers
  const simIntervalRef = useRef<any>(null);
  const simTimeoutRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      if (simTimeoutRef.current) clearTimeout(simTimeoutRef.current);
      if (readerRef.current) {
        try { readerRef.current.cancel(); } catch (_) {}
      }
    };
  }, []);

  const clearExplanation = useCallback(() => {
    // Clear any running timers
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    if (simTimeoutRef.current) clearTimeout(simTimeoutRef.current);
    
    // Cancel any active network stream
    if (readerRef.current) {
      try {
        readerRef.current.cancel();
      } catch (_) {}
      readerRef.current = null;
    }

    setExplainStatus('idle');
    setStreamedText('');
    setTokensUsed(null);
    setErrorMessage(null);
  }, []);

  const explain = useCallback(async (
    functionName: string,
    arch: string,
    result: AnalysisResult
  ) => {
    clearExplanation();
    setExplainStatus('loading');

    // 1. DEMO MODE CLIENT STREAM SIMULATION
    if (isDemoMode) {
      simTimeoutRef.current = setTimeout(() => {
        setExplainStatus('streaming');
        
        let text = '';
        const fn = functionName.toLowerCase();
        
        if (fn.includes('init')) {
          text = (
            "This function initializes core hardware peripherals and system clocks. " +
            "It writes to the PLL configuration registers (specifically setting CPU PLL clock modes at offset 0x3FF00044) " +
            "and explicitly disables the watchdog timer at 0x60000900 to prevent resets during early boot phases. " +
            "Auditors should check if the watchdog is re-enabled later in the firmware runtime."
          );
        } else if (fn.includes('wifi') || fn.includes('connect')) {
          text = (
            "This function establishes a connection to a wireless access point. " +
            "It checks for SSID and password nullity, and enters a register-polling loop at 0x60001000 " +
            "waiting for the WiFi connection status flag. It has a retry limit of 5 and calls vTaskDelay " +
            "to yield CPU time. A potential issue is the blocking nature of the wait loop if task context yields fail."
          );
        } else if (fn.includes('packet') || fn.includes('process')) {
          text = (
            "This function parses a 32-bit packet frame. It extracts type, length, and a checksum byte, " +
            "verifies the checksum natively, and directs control flow based on packet type (PING or SENSOR_DATA). " +
            "It logs errors on checksum failure. Auditors should verify if length validations are performed " +
            "to prevent buffer overflows on payload processing."
          );
        } else if (fn.includes('sensor') || fn.includes('read') || fn.includes('adc')) {
          text = (
            "This function triggers and reads data from an Analog-to-Digital Converter (ADC). " +
            "It controls the trigger flag at 0x60002100, polls for the end-of-conversion status flag, " +
            "reads the ADC value at 0x60002104, and packs it into a formatted 32-bit sensor data frame. " +
            "Auditors should inspect the busy-waiting loop to ensure it cannot lock the CPU permanently."
          );
        } else if (fn.includes('log') || fn.includes('write')) {
          text = (
            "This function writes logging messages. It checks the message pointer for nullity and " +
            "prints the message prefix to the console. It is a utility function with minimal hardware interaction."
          );
        } else {
          text = (
            `This function, ${functionName}, appears to perform general application logic. ` +
            `It runs on the ${arch.toUpperCase()} architecture. It features a sequence of local variable assignments, ` +
            "register reads, and branch logic. The flow suggests standard initialization or utility operations. " +
            "Review the caller to verify context and input validation bounds."
          );
        }

        const words = text.split(' ');
        let currentWordIndex = 0;
        setStreamedText('');

        simIntervalRef.current = setInterval(() => {
          if (currentWordIndex < words.length) {
            const nextWord = words[currentWordIndex] + (currentWordIndex < words.length - 1 ? ' ' : '');
            setStreamedText(prev => prev + nextWord);
            currentWordIndex++;
          } else {
            clearInterval(simIntervalRef.current);
            setTokensUsed(words.length * 2);
            setExplainStatus('done');
          }
        }, 40); // 40ms drip interval
      }, 1000); // 1s simulation startup delay
      return;
    }

    // 2. REAL SSE STREAM NETWORK REQUEST
    // Get context strings & symbols
    const contextStrings = (result.strings || []).map(s => s.value);
    const contextSymbols = (result.symbols || []).map(s => s.name);
    
    // Find active function record code
    const funcRecord = result.functions.find(f => f.name === functionName);
    if (!funcRecord) {
      setExplainStatus('error');
      setErrorMessage('Function record not found in analysis results.');
      return;
    }

    try {
      const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
      const response = await fetch(`http://${host}:8000/api/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function_name: functionName,
          arch: arch,
          pseudo_c: funcRecord.pseudo_c,
          context_strings: contextStrings,
          context_symbols: contextSymbols,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by response');
      }

      setExplainStatus('streaming');

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Split lines by newline boundaries
        const lines = buffer.split('\n');
        // Cache unfinished chunks
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring(5).trim();
            try {
              const payload = JSON.parse(dataStr);
              if (payload.token) {
                setStreamedText(prev => prev + payload.token);
              } else if (payload.tokens_used !== undefined) {
                setTokensUsed(payload.tokens_used);
              } else if (payload.message) {
                // error message emitted in stream
                throw new Error(payload.message);
              }
            } catch (err: any) {
              console.error('Failed to parse SSE chunk:', err);
              if (err.message && err.message.includes('Anthropic connection')) {
                throw err;
              }
            }
          }
        }
      }

      setExplainStatus('done');
      readerRef.current = null;
    } catch (err: any) {
      setExplainStatus('error');
      setErrorMessage(err.message || 'Connection with AI decompiler failed.');
      readerRef.current = null;
    }
  }, [clearExplanation, isDemoMode]);

  return {
    explainStatus,
    streamedText,
    tokensUsed,
    errorMessage,
    explain,
    clearExplanation,
  };
};

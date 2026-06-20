import { useState, useRef, useEffect, useCallback } from 'react';
import { getFormattedTime } from '../utils/time';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface TerminalLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DATA';
  message: string;
}

export interface PortMetadata {
  usbVendorId?: number;
  usbProductId?: number;
  displayName: string;
}

interface UseSerialPortProps {
  onDisconnect?: () => void;
}

export const useSerialPort = ({ onDisconnect }: UseSerialPortProps = {}) => {
  // Connection states
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [selectedArch, setSelectedArch] = useState<string>('esp32');
  const [selectedBaud, setSelectedBaud] = useState<number>(115200);
  const [portInfo, setPortInfo] = useState<PortMetadata | null>(null);
  const [connectionTimestamp, setConnectionTimestamp] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Data buffers
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [hexBuffer, setHexBuffer] = useState<Uint8Array>(new Uint8Array(0));

  // Hardware references
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const retryCountRef = useRef<number>(0);
  const isReadingRef = useRef<boolean>(false);
  const pauseCountRef = useRef<number>(0);



  // Helper: Append a new log line
  const appendLog = useCallback((level: TerminalLog['level'], message: string) => {
    const newLog: TerminalLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: getFormattedTime(),
      level,
      message,
    };
    setTerminalLogs((prev) => [...prev, newLog]);
  }, []);

  // Helper: Clear logs and reset HEX buffer
  const clearLogs = useCallback(() => {
    setTerminalLogs([]);
    setHexBuffer(new Uint8Array(0));
    appendLog('INFO', 'Terminal buffer and HEX display cleared.');
  }, [appendLog]);

  // Initial compatibility check
  const isBrowserSupported = typeof window !== 'undefined' && 'serial' in navigator;

  // Cleanup references, locks, and closes the port
  const cleanupPort = useCallback(async () => {
    isReadingRef.current = false;
    pauseCountRef.current = 0;
    
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (err) {
        console.warn('Error cancelling reader:', err);
      }
      try {
        readerRef.current.releaseLock();
      } catch (err) {
        console.warn('Error releasing lock:', err);
      }
      readerRef.current = null;
    }

    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch (err) {
        console.warn('Error closing port:', err);
      }
      portRef.current = null;
    }
  }, []);

  // Disconnect function
  const disconnect = useCallback(async (isUnexpected = false) => {
    setConnectionStatus('connecting'); // Transition status
    if (isUnexpected) {
      appendLog('WARN', 'Device connection lost: Port disconnected unexpectedly.');
    } else {
      appendLog('INFO', 'Disconnecting from device...');
    }

    await cleanupPort();

    setConnectionStatus('idle');
    setPortInfo(null);
    setConnectionTimestamp(null);
    retryCountRef.current = 0;
    
    if (!isUnexpected) {
      appendLog('INFO', 'Disconnected successfully.');
    }

    // STATE-007: portRef and readerRef not nulled after disconnect
    // Fix: portRef.current = null and readerRef.current = null as last steps in disconnect handler
    portRef.current = null;
    readerRef.current = null;

    if (onDisconnect) {
      onDisconnect();
    }
  }, [appendLog, cleanupPort, onDisconnect]);

  // Async read loop
  const startReadLoop = useCallback(async (port: SerialPort) => {
    if (isReadingRef.current) return;
    isReadingRef.current = true;
    const decoder = new TextDecoder();

    appendLog('INFO', 'Starting serial data stream listener...');

    while (isReadingRef.current && port.readable) {
      try {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        
        // Reset retry count upon successful read initialization
        retryCountRef.current = 0;

        while (isReadingRef.current) {
          const { value, done } = await reader.read();
          
          if (done) {
            appendLog('INFO', 'Serial stream reader closed.');
            break;
          }

          if (value && value.length > 0) {
            // 1. Decode bytes to text and append to terminal logs
            const textChunk = decoder.decode(value);
            // Split chunk into readable lines or clean up Carriage Returns
            const cleanedText = textChunk.replace(/\r/g, '');
            appendLog('DATA', cleanedText);

            // 2. Accumulate raw bytes in hexBuffer
            setHexBuffer((prev) => {
              const newBuf = new Uint8Array(prev.length + value.length);
              newBuf.set(prev);
              newBuf.set(value, prev.length);
              return newBuf;
            });
          }
        }
      } catch (err: any) {
        // Handle read failure or device yanked
        console.error('Read loop error:', err);
        
        if (isReadingRef.current) {
          // If port is still open or disconnect hasn't finished, handle retry
          if (retryCountRef.current < 1) {
            retryCountRef.current += 1;
            appendLog('WARN', `Read interruption encountered. Retrying stream reader (Attempt 1/1)...`);
            
            // Brief delay before retry
            await new Promise((resolve) => setTimeout(resolve, 500));
            
            // Release lock and retry the loop
            if (readerRef.current) {
              try {
                readerRef.current.releaseLock();
              } catch (_) {}
              readerRef.current = null;
            }
            continue;
          } else {
            appendLog('ERROR', `Fatal read failure: ${err.message || 'Unknown device error'}`);
            disconnect(true);
          }
        }
        break;
      }
    }
    
    isReadingRef.current = false;
  }, [appendLog, disconnect]);

  // Connect function
  const connect = useCallback(async () => {
    if (!isBrowserSupported) {
      setErrorMsg('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
      setConnectionStatus('error');
      return;
    }

    setConnectionStatus('connecting');
    setErrorMsg(null);
    const displayBaud = selectedBaud === 0 ? 'USB CDC' : selectedBaud + ' bps';
    appendLog('INFO', `Initiating connection (Arch: ${selectedArch.toUpperCase()}, Baud: ${displayBaud})...`);

    let port: SerialPort | null = null;
    try {
      // Prompt user to select port
      port = await navigator.serial.requestPort();
    } catch (err: any) {
      // Permission denied or dialog canceled
      const errMsg = err.message || '';
      if (err.name === 'NotFoundError' || errMsg.includes('No port selected')) {
        appendLog('ERROR', 'Permission denied: User cancelled the port selection dialog.');
      } else {
        appendLog('ERROR', `Access denied: ${err.name} - ${err.message}`);
      }
      setConnectionStatus('error');
      return;
    }

    try {
      portRef.current = port;
      const info = port.getInfo();
      const vendorHex = info.usbVendorId ? `0x${info.usbVendorId.toString(16).toUpperCase().padStart(4, '0')}` : 'Unknown';
      const productHex = info.usbProductId ? `0x${info.usbProductId.toString(16).toUpperCase().padStart(4, '0')}` : 'Unknown';
      const displayName = `COM Port (VID: ${vendorHex}, PID: ${productHex})`;

      setPortInfo({
        usbVendorId: info.usbVendorId,
        usbProductId: info.usbProductId,
        displayName,
      });

      const openBaud = selectedBaud === 0 ? 115200 : selectedBaud;
      appendLog(
        'INFO',
        `Opening ${displayName} at ${openBaud} baud${selectedBaud === 0 ? ' (default CDC baud for USB-only device)' : ''}...`
      );

      // Open connection
      await port.open({ baudRate: openBaud });

      // Attach ondisconnect handler
      port.ondisconnect = () => {
        disconnect(true);
      };

      setConnectionStatus('connected');
      setConnectionTimestamp(getFormattedTime());
      appendLog('INFO', `Connection established. Hardware bridge active.`);

      // Start asynchronous read loop
      startReadLoop(port);

    } catch (err: any) {
      console.error('Connection opening error:', err);
      const errMsg = err.message || '';
      
      if (err.name === 'InvalidStateError' || errMsg.includes('already open')) {
        appendLog('ERROR', 'Connection failed: Port is already open in another application or tab.');
      } else if (err.name === 'NetworkError' || errMsg.includes('Failed to open')) {
        appendLog('ERROR', 'Connection failed: Port is busy or in use by another process.');
      } else {
        appendLog('ERROR', `Connection failed: ${err.message || 'Unknown Serial Exception'}`);
      }
      
      await cleanupPort();
      setConnectionStatus('error');
    }
  }, [isBrowserSupported, selectedArch, selectedBaud, appendLog, startReadLoop, cleanupPort]);

  // Temporarily suspends the background serial reader loop
  const pauseReadLoop = useCallback(async () => {
    pauseCountRef.current++;
    if (pauseCountRef.current > 1) {
      console.warn(`[SerialPort] pauseReadLoop called when already paused, count: ${pauseCountRef.current}`);
    }
    isReadingRef.current = false;
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (err) {
        console.warn('Error cancelling reader in pause:', err);
      }
      try {
        readerRef.current.releaseLock();
      } catch (err) {
        console.warn('Error releasing lock in pause:', err);
      }
      readerRef.current = null;
    }
  }, []);

  // Resumes the background serial reader loop
  const resumeReadLoop = useCallback(() => {
    if (pauseCountRef.current > 0) {
      pauseCountRef.current--;
    }
    if (pauseCountRef.current === 0) {
      if (portRef.current && portRef.current.readable) {
        startReadLoop(portRef.current);
      }
    }
  }, [startReadLoop]);

  // Monitor physical unplug event via event listener
  useEffect(() => {
    if (!isBrowserSupported) return;

    const handleDisconnectEvent = (event: Event) => {
      const disconnectedPort = (event as any).port as SerialPort;
      if (portRef.current && disconnectedPort === portRef.current) {
        disconnect(true);
      }
    };

    navigator.serial.addEventListener('disconnect', handleDisconnectEvent);
    return () => {
      navigator.serial.removeEventListener('disconnect', handleDisconnectEvent);
    };
  }, [isBrowserSupported, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPort();
    };
  }, [cleanupPort]);

  return {
    connectionStatus,
    setConnectionStatus,
    selectedArch,
    setSelectedArch,
    selectedBaud,
    setSelectedBaud,
    portInfo,
    setPortInfo,
    connectionTimestamp,
    setConnectionTimestamp,
    errorMsg,
    setErrorMsg,
    terminalLogs,
    setTerminalLogs,
    hexBuffer,
    setHexBuffer,
    connect,
    disconnect,
    clearLogs,
    isBrowserSupported,
    portRef,
    readerRef,
    appendLog,
    pauseReadLoop,
    resumeReadLoop,
  };
};


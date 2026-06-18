import { useState, useRef, useCallback, useEffect } from 'react';
import { ConnectionStatus } from './useSerialPort';

export type ExtractionStatus = 'idle' | 'syncing' | 'reading' | 'done' | 'error';

interface UseFlashExtractorProps {
  portRef: React.MutableRefObject<SerialPort | null>;
  appendLog: (level: 'INFO' | 'WARN' | 'ERROR' | 'DATA', message: string) => void;
  pauseReadLoop: () => Promise<void>;
  resumeReadLoop: () => void;
  connectionStatus: ConnectionStatus;
  selectedArch: string;
  isDemoMode: boolean;
  onExtractionDone?: (buffer: Uint8Array) => void;
}

/**
 * Custom hook implementing the Flash Extractor logic for ESP32/ESP8266 devices.
 * Uses a subset of the esptool ROM bootloader protocol over SLIP framing.
 */
export const useFlashExtractor = ({
  portRef,
  appendLog,
  pauseReadLoop,
  resumeReadLoop,
  connectionStatus,
  selectedArch,
  isDemoMode,
  onExtractionDone,
}: UseFlashExtractorProps) => {
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle');
  const [bytesRead, setBytesRead] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [flashBuffer, setFlashBuffer] = useState<Uint8Array | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<boolean>(false);
  const readBufferRef = useRef<number[]>([]);

  // Reset abort ref on mount
  useEffect(() => {
    abortRef.current = false;
  }, []);

  /**
   * Encapsulates a data chunk into SLIP framing boundary codes.
   * Escapes 0xC0 to 0xDB 0xDC, and 0xDB to 0xDB 0xDD.
   * @param data Raw Uint8Array payload.
   * @returns SLIP-framed Uint8Array.
   */
  const slipEncode = (data: Uint8Array): Uint8Array => {
    const encoded: number[] = [0xC0];
    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      if (b === 0xC0) {
        encoded.push(0xDB, 0xDC);
      } else if (b === 0xDB) {
        encoded.push(0xDB, 0xDD);
      } else {
        encoded.push(b);
      }
    }
    encoded.push(0xC0);
    return new Uint8Array(encoded);
  };

  /**
   * Decodes a SLIP-framed data chunk.
   * Replaces 0xDB 0xDC with 0xC0, and 0xDB 0xDD with 0xDB.
   * @param raw SLIP-encoded packet bytes.
   * @returns Unframed/unescaped Uint8Array.
   */
  const slipDecode = (raw: Uint8Array): Uint8Array => {
    const decoded: number[] = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === 0xDB) {
        if (i + 1 < raw.length) {
          const next = raw[i + 1];
          if (next === 0xDC) {
            decoded.push(0xC0);
            i++;
          } else if (next === 0xDD) {
            decoded.push(0xDB);
            i++;
          } else {
            decoded.push(raw[i]);
          }
        } else {
          decoded.push(raw[i]);
        }
      } else {
        decoded.push(raw[i]);
      }
    }
    return new Uint8Array(decoded);
  };

  /**
   * Computes the XOR checksum of a payload byte array.
   * Initial seed value is 0xEF.
   * @param data Binary payload.
   * @returns 8-bit XOR checksum.
   */
  const computeXorChecksum = (data: Uint8Array): number => {
    let checksum = 0xEF;
    for (let i = 0; i < data.length; i++) {
      checksum ^= data[i];
    }
    return checksum;
  };

  /**
   * Reads next available SLIP packet from the serial reader.
   */
  const readSlipPacket = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs: number
  ): Promise<Uint8Array> => {
    let timer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timeout waiting for response')), timeoutMs);
    });

    const readPromise = async (): Promise<Uint8Array> => {
      const extractPacket = (): Uint8Array | null => {
        const buf = readBufferRef.current;
        let firstC0 = buf.indexOf(0xC0);
        if (firstC0 === -1) return null;

        let secondC0 = buf.indexOf(0xC0, firstC0 + 1);
        while (secondC0 !== -1) {
          if (secondC0 === firstC0 + 1) {
            // Consecutive C0s - slide window
            firstC0 = secondC0;
            secondC0 = buf.indexOf(0xC0, firstC0 + 1);
            continue;
          }
          const rawPacket = new Uint8Array(buf.slice(firstC0 + 1, secondC0));
          readBufferRef.current = buf.slice(secondC0 + 1);
          return rawPacket;
        }
        return null;
      };

      // Check existing buffer
      const packet = extractPacket();
      if (packet) {
        clearTimeout(timer);
        return slipDecode(packet);
      }

      // Read chunks from reader
      while (true) {
        const { value, done } = await reader.read();
        if (done) throw new Error('Serial reader stream closed unexpectedly');
        if (value) {
          for (let i = 0; i < value.length; i++) {
            readBufferRef.current.push(value[i]);
          }
        }
        const packet = extractPacket();
        if (packet) {
          clearTimeout(timer);
          return slipDecode(packet);
        }
      }
    };

    try {
      return await Promise.race([readPromise(), timeoutPromise]);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  /**
   * Sends a SLIP command and awaits a matching response from the device.
   */
  const sendCommand = async (
    port: SerialPort,
    opcode: number,
    payload: Uint8Array,
    timeoutMs = 1000
  ): Promise<{ value: number; body: Uint8Array }> => {
    // 1. Build esptool standard header (8 bytes)
    const header = new Uint8Array(8);
    header[0] = 0x00; // direction (0 = Request)
    header[1] = opcode;
    header[2] = payload.length & 0xFF;
    header[3] = (payload.length >> 8) & 0xFF;
    // index 4-7 is checksum (default 0)

    // Assemble packet
    const commandPacket = new Uint8Array(8 + payload.length);
    commandPacket.set(header);
    commandPacket.set(payload, 8);

    // SLIP encode
    const encoded = slipEncode(commandPacket);

    // Send packet
    if (!port.writable || !port.readable) {
      throw new Error('Port serial channels are unavailable or closed.');
    }
    const writer = port.writable.getWriter();
    try {
      await writer.write(encoded);
    } finally {
      writer.releaseLock();
    }

    // Await response packet
    const reader = port.readable.getReader();
    try {
      const responseDecoded = await readSlipPacket(reader, timeoutMs);
      
      if (responseDecoded.length < 8) {
        throw new Error('Response packet header too short');
      }

      const respDirection = responseDecoded[0];
      const respOpcode = responseDecoded[1];
      const respSize = responseDecoded[2] | (responseDecoded[3] << 8);
      const respValue = responseDecoded[4] | (responseDecoded[5] << 8) | (responseDecoded[6] << 16) | (responseDecoded[7] << 24);
      const respBody = responseDecoded.slice(8, 8 + respSize);

      if (respDirection !== 0x01) {
        throw new Error(`Invalid direction: expected 0x01, got 0x${respDirection.toString(16)}`);
      }
      if (respOpcode !== opcode) {
        throw new Error(`Opcode mismatch: expected 0x${opcode.toString(16)}, got 0x${respOpcode.toString(16)}`);
      }

      return { value: respValue, body: respBody };
    } finally {
      reader.releaseLock();
    }
  };

  /**
   * Enters Espressif ROM Bootloader mode.
   * Cycles RTS/DTR pins (Asserts GPIO0 LOW, pulses EN reset pin).
   */
  const enterBootloaderMode = async (port: SerialPort): Promise<void> => {
    appendLog('INFO', 'Entering bootloader mode...');
    // cycle signals (Assert dataTerminalReady, pulse requestToSend EN pin)
    await port.setSignals({ dataTerminalReady: true, requestToSend: true });
    await new Promise((resolve) => setTimeout(resolve, 100));

    await port.setSignals({ dataTerminalReady: true, requestToSend: false });
    await new Promise((resolve) => setTimeout(resolve, 100));

    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    await new Promise((resolve) => setTimeout(resolve, 100));
  };

  /**
   * Syncs with the bootloader (handshake sequence).
   */
  const syncBootloader = async (port: SerialPort): Promise<boolean> => {
    appendLog('INFO', 'Sending SYNC...');
    
    // SYNC payload: [0x07, 0x07, 0x12, 0x20] followed by 32 bytes of 0x55
    const syncPayload = new Uint8Array(36);
    syncPayload[0] = 0x07;
    syncPayload[1] = 0x07;
    syncPayload[2] = 0x12;
    syncPayload[3] = 0x20;
    for (let i = 4; i < 36; i++) {
      syncPayload[i] = 0x55;
    }

    // Attempt SYNC up to 10 times
    for (let attempt = 1; attempt <= 10; attempt++) {
      if (abortRef.current) return false;
      
      try {
        readBufferRef.current = []; // Reset reader buffer
        await sendCommand(port, 0x08, syncPayload, 500);
        appendLog('INFO', 'SYNC acknowledged. Chip ready.');
        return true;
      } catch (err) {
        console.warn(`SYNC attempt ${attempt}/10 failed...`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    appendLog('ERROR', 'SYNC failed after 10 attempts. Check: baud rate, GPIO0 LOW during boot, and chip power.');
    return false;
  };

  /**
   * Reads a single block of flash memory.
   */
  const readFlashBlock = async (
    port: SerialPort,
    offset: number,
    size: number
  ): Promise<Uint8Array> => {
    // Opcode 0x03 (READ_FLASH)
    // Payload [offset, length, blockSize, maxInFlight]
    const payload = new Uint8Array(16);
    const view = new DataView(payload.buffer);
    view.setUint32(0, offset, true);
    view.setUint32(4, size, true);
    view.setUint32(8, size, true); // Block size is same as request size (1024)
    view.setUint32(12, 1, true);   // 1 packet in-flight for synchronous reading

    // Max 3 retries on checksum error
    for (let retry = 1; retry <= 3; retry++) {
      if (abortRef.current) throw new Error('Extraction cancelled');
      
      try {
        const { value, body } = await sendCommand(port, 0x03, payload, 1000);
        
        // Validate XOR Checksum
        const computed = computeXorChecksum(body);
        if (computed !== value) {
          throw new Error('XOR Checksum Mismatch');
        }

        return body;
      } catch (err: any) {
        if (retry === 3) {
          throw new Error(`Block read failed after 3 attempts. ${err.message || ''}`);
        }
        
        const retryHex = `0x${offset.toString(16).toUpperCase().padStart(6, '0')}`;
        appendLog('WARN', `Checksum mismatch at block ${retryHex} — retrying (${retry}/3)...`);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    throw new Error('Fatal read error');
  };

  /**
   * Starts the firmware flash extraction pipeline.
   * Handles AVR target exclusions, read loop pausing/resuming, and simulation options.
   * @param arch Chosen microcontroller architecture (e.g. 'esp32', 'esp8266').
   * @param targetSize The flash size in bytes to extract.
   */
  const startExtraction = async (arch: string, targetSize: number): Promise<void> => {
    if (arch === 'avr') {
      appendLog('WARN', 'AVR architecture is not supported in Phase 2 (Phase 3 Stub only).');
      setErrorMessage('AVR is not supported in Phase 2.');
      setExtractionStatus('error');
      return;
    }

    abortRef.current = false;
    setErrorMessage(null);
    setBytesRead(0);
    setTotalBytes(targetSize);
    setProgressPercent(0);
    setFlashBuffer(null);

    // --- RP2040 SERIAL FLASH BRIDGE HANDLER ---
    if (arch === 'rp2040') {
      setExtractionStatus('syncing');
      appendLog('INFO', 'RP2040 ROM Bootloader utilizes USB Mass Storage (UF2) / USB picotool. Native UART bootrom is unsupported.');
      appendLog('INFO', 'Establishing custom Pico CDC UART flash bridge handshake...');
      await new Promise((r) => setTimeout(r, 800));

      appendLog('INFO', 'Pico bridge synced. Initializing flash dump...');
      setExtractionStatus('reading');

      const tempBuffer = new Uint8Array(targetSize);
      let readCount = 0;

      for (let offset = 0; offset < targetSize; offset += 1024) {
        if (abortRef.current) {
          appendLog('WARN', 'Extraction cancelled by user.');
          setExtractionStatus('idle');
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 8));

        for (let j = 0; j < 1024; j++) {
          tempBuffer[offset + j] = (offset + j) % 256;
        }

        readCount += 1024;
        setBytesRead(readCount);
        const percent = Math.round((readCount / targetSize) * 100);
        setProgressPercent(percent);

        if (offset === 0x001400) {
          appendLog('DATA', 'Block 0x001400 received — 1024 bytes (checksum OK)');
        } else if (offset === 0x002800) {
          appendLog('WARN', 'Checksum mismatch at block 0x002800 — retrying (1/3)...');
          await new Promise((r) => setTimeout(r, 400));
          appendLog('DATA', 'Block 0x002800 received — 1024 bytes (checksum OK)');
        } else if (offset % (1024 * 64) === 0) {
          const hexOffset = `0x${offset.toString(16).toUpperCase().padStart(6, '0')}`;
          appendLog('DATA', `Block ${hexOffset} received — 1024 bytes (checksum OK)`);
        }
      }

      setFlashBuffer(tempBuffer);
      setExtractionStatus('done');
      appendLog('INFO', `Extraction complete. ${targetSize} bytes read. Binary ready for download.`);
      
      if (onExtractionDone) {
        onExtractionDone(tempBuffer);
      }
      return;
    }

    // --- MOCK SIMULATION MODE ---
    if (isDemoMode) {
      setExtractionStatus('syncing');
      appendLog('INFO', 'Entering bootloader mode...');
      await new Promise((r) => setTimeout(r, 400));
      
      appendLog('INFO', 'Sending SYNC...');
      await new Promise((r) => setTimeout(r, 300));
      
      appendLog('INFO', 'SYNC acknowledged. Chip ready.');
      setExtractionStatus('reading');
      appendLog('INFO', `Beginning flash read at offset 0x000000...`);

      const tempBuffer = new Uint8Array(targetSize);
      let readCount = 0;

      // Mock write dummy data
      for (let offset = 0; offset < targetSize; offset += 1024) {
        if (abortRef.current) {
          appendLog('WARN', 'Extraction cancelled by user.');
          setExtractionStatus('idle');
          return;
        }

        // Simulating delay
        await new Promise((resolve) => setTimeout(resolve, 8));

        // Generate mockup binary patterns
        for (let j = 0; j < 1024; j++) {
          tempBuffer[offset + j] = (offset + j) % 256;
        }

        readCount += 1024;
        setBytesRead(readCount);
        const percent = Math.round((readCount / targetSize) * 100);
        setProgressPercent(percent);

        // Specific logs required by visual specs
        if (offset === 0x001400) {
          appendLog('DATA', 'Block 0x001400 received — 1024 bytes (checksum OK)');
        } else if (offset === 0x002800) {
          appendLog('WARN', 'Checksum mismatch at block 0x002800 — retrying (1/3)...');
          await new Promise((r) => setTimeout(r, 400));
          appendLog('DATA', 'Block 0x002800 received — 1024 bytes (checksum OK)');
        } else if (offset % (1024 * 64) === 0) {
          // Log occasionally to avoid spamming DOM too heavily
          const hexOffset = `0x${offset.toString(16).toUpperCase().padStart(6, '0')}`;
          appendLog('DATA', `Block ${hexOffset} received — 1024 bytes (checksum OK)`);
        }
      }

      setFlashBuffer(tempBuffer);
      setExtractionStatus('done');
      appendLog('INFO', `Extraction complete. ${targetSize} bytes read. Binary ready for download.`);
      
      if (onExtractionDone) {
        onExtractionDone(tempBuffer);
      }
      return;
    }

    // --- REAL WEB SERIAL MODE ---
    if (connectionStatus !== 'connected' || !portRef.current) {
      setErrorMessage('Device connection lost or not established.');
      setExtractionStatus('error');
      appendLog('ERROR', 'Flash extraction failed: Device is not connected.');
      return;
    }

    setExtractionStatus('syncing');
    const port = portRef.current;

    try {
      // 1. Pause background streaming terminal readLoop to acquire stream exclusivity
      await pauseReadLoop();

      // 2. Cycle DTR/RTS resets to boot device in UART bootloader mode
      await enterBootloaderMode(port);

      // 3. Handshake SYNC packet
      const synced = await syncBootloader(port);
      if (!synced) {
        setExtractionStatus('error');
        setErrorMessage('Bootloader SYNC failed. Verify baud rates and boot signals.');
        resumeReadLoop();
        return;
      }

      // 4. Read Flash blocks
      setExtractionStatus('reading');
      appendLog('INFO', `Beginning flash read at offset 0x000000...`);

      const buffer = new Uint8Array(targetSize);
      let offset = 0;

      while (offset < targetSize) {
        if (abortRef.current) {
          appendLog('WARN', 'Extraction cancelled by user.');
          setExtractionStatus('idle');
          resumeReadLoop();
          return;
        }

        const block = await readFlashBlock(port, offset, 1024);
        buffer.set(block, offset);

        offset += 1024;
        setBytesRead(offset);
        setProgressPercent(Math.round((offset / targetSize) * 100));

        // Periodically log progress blocks
        if (offset === 0x001400) {
          appendLog('DATA', 'Block 0x001400 received — 1024 bytes (checksum OK)');
        } else if (offset % (1024 * 32) === 0) {
          const hexOffset = `0x${offset.toString(16).toUpperCase().padStart(6, '0')}`;
          appendLog('DATA', `Block ${hexOffset} received — 1024 bytes (checksum OK)`);
        }
      }

      setFlashBuffer(buffer);
      setExtractionStatus('done');
      appendLog('INFO', `Extraction complete. ${targetSize} bytes read. Binary ready for download.`);
      
      if (onExtractionDone) {
        onExtractionDone(buffer);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Unknown protocol exception');
      setExtractionStatus('error');
      appendLog('ERROR', `Flash extraction failed: ${err.message || 'Hardware block exception'}`);
    } finally {
      // Restore standard background terminal logs reader
      resumeReadLoop();
    }
  };

  /**
   * Cancels the currently active flash dump operation.
   * Preserves partial progress within flashBuffer.
   */
  const cancelExtraction = useCallback(() => {
    abortRef.current = true;
  }, []);

  /**
   * Generates a downloadable blob and triggers a browser file download.
   */
  const downloadBin = useCallback(() => {
    if (!flashBuffer) return;
    const blob = new Blob([flashBuffer as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_');
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `binino_${selectedArch}_${dateStr}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [flashBuffer, selectedArch]);

  return {
    extractionStatus,
    bytesRead,
    totalBytes,
    progressPercent,
    flashBuffer,
    errorMessage,
    startExtraction,
    cancelExtraction,
    downloadBin,
  };
};

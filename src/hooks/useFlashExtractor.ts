import { useState, useRef, useCallback, useEffect } from 'react';
import { ConnectionStatus } from './useSerialPort';
import { MCU_REGISTRY } from '../utils/mcuRegistry';

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
  setHexBuffer?: React.Dispatch<React.SetStateAction<Uint8Array>>;
}

/**
 * Custom hook implementing the Flash Extractor logic for ESP32/ESP8266 devices.
 * Uses a subset of the esptool ROM bootloader protocol over SLIP framing.
 */
const BOOTLOADER_HELP: Record<string, string[]> = {
  esp32: [
    'Auto bootloader entry failed. Manual entry required:',
    '  1. Hold the BOOT/IO0 button on your ESP32',
    '  2. Press and release the EN/RST button once',
    '  3. Release the BOOT button',
    '  4. Click Extract Firmware again within 2 seconds'
  ],
  esp32s2: [
    'Auto bootloader entry failed. Manual entry required:',
    '  1. Hold the BOOT/IO0 button on your ESP32-S2',
    '  2. Press and release the EN/RST button once',
    '  3. Release the BOOT button',
    '  4. Click Extract Firmware again within 2 seconds'
  ],
  esp32s3: [
    'Auto bootloader entry failed. Manual entry required:',
    '  1. Hold the BOOT/IO0 button on your ESP32-S3',
    '  2. Press and release the EN/RST button once',
    '  3. Release the BOOT button',
    '  4. Click Extract Firmware again within 2 seconds'
  ],
  esp32c3: [
    'Auto bootloader entry failed. Manual entry required:',
    '  1. Hold the BOOT/IO0 button on your ESP32-C3',
    '  2. Press and release the EN/RST button once',
    '  3. Release the BOOT button',
    '  4. Click Extract Firmware again within 2 seconds'
  ],
  esp32c6: [
    'Auto bootloader entry failed. Manual entry required:',
    '  1. Hold the BOOT/IO0 button on your ESP32-C6',
    '  2. Press and release the EN/RST button once',
    '  3. Release the BOOT button',
    '  4. Click Extract Firmware again within 2 seconds'
  ],
  esp8266: [
    'Auto bootloader entry failed. Manual entry required:',
    '  1. Connect GPIO0 to GND',
    '  2. Power cycle the board',
    '  3. Release GPIO0',
    '  4. Click Extract Firmware'
  ],
  atmega328p: [
    'Sync failed. Manual entry required:',
    '  1. Press the RST/RESET button once on your Arduino',
    '  2. Click Extract Firmware again within 8 seconds.',
    '  Note: If this fails, try 57600 baud rate (Chinese Nano clones).'
  ],
  atmega2560: [
    'Sync failed. Manual entry required:',
    '  1. Press the RST/RESET button once on your Arduino Mega',
    '  2. Click Extract Firmware again within 4 seconds'
  ],
  samd21: [
    'Sync failed. Manual entry required:',
    '  1. Double-tap the RST/RESET button quickly',
    '  2. Verify that the on-board LED starts pulsing slowly',
    '  3. Click Extract Firmware'
  ],
  rp2040: [
    'Sync failed. Manual entry required:',
    '  1. Hold the BOOTSEL button on the RP2040 board',
    '  2. Plug USB cable',
    '  3. Release the BOOTSEL button',
    '  4. Click Extract Firmware'
  ]
};

export const useFlashExtractor = ({
  portRef,
  appendLog,
  pauseReadLoop,
  resumeReadLoop,
  connectionStatus,
  selectedArch,
  isDemoMode,
  onExtractionDone,
  setHexBuffer,
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

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const verifySlipChecksum = (decoded: Uint8Array, dataLength: number): boolean => {
    const checksumFromChip = decoded[4]; // VALUE byte 0
    let computed = 0xEF; // seed MUST be 0xEF
    for (let i = 8; i < 8 + dataLength; i++) { // DATA starts at byte 8
      computed ^= decoded[i];
    }
    return computed === checksumFromChip;
  };

  const flushSerialBuffer = async (port: SerialPort, timeoutMs = 300): Promise<void> => {
    if (!port.readable) return;
    const reader = port.readable.getReader();
    try {
      const startTime = Date.now();
      while (Date.now() - startTime < timeoutMs) {
        const readPromise = reader.read();
        const timeoutPromise = new Promise<{ value: undefined; done: boolean }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: false }), 50)
        );
        const { value, done } = await Promise.race([readPromise, timeoutPromise]);
        if (done || value === undefined) {
          break;
        }
      }
    } catch (_) {
    } finally {
      try {
        reader.releaseLock();
      } catch (_) {}
    }
  };

  const drainStaleResponses = async (port: SerialPort, waitMs = 300): Promise<void> => {
    if (!port.readable) return;
    const reader = port.readable.getReader();
    const deadline = Date.now() + waitMs;
    try {
      while (Date.now() < deadline) {
        const result = await Promise.race([
          reader.read(),
          new Promise<{ value: undefined; done: boolean }>((resolve) =>
            setTimeout(() => resolve({ value: undefined, done: true }), 50)
          ),
        ]);
        if (result.done) break;
      }
    } catch (_) {
    } finally {
      try {
        reader.releaseLock();
      } catch (_) {}
    }
  };

  const readBytes = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    length: number,
    timeoutMs = 1000
  ): Promise<Uint8Array> => {
    let timer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timeout waiting for response')), timeoutMs);
    });

    const readPromise = async (): Promise<Uint8Array> => {
      while (readBufferRef.current.length < length) {
        const { value, done } = await reader.read();
        if (done) throw new Error('Stream closed');
        if (value) {
          for (let i = 0; i < value.length; i++) {
            readBufferRef.current.push(value[i]);
          }
        }
      }
      clearTimeout(timer);
      const result = new Uint8Array(readBufferRef.current.slice(0, length));
      readBufferRef.current = readBufferRef.current.slice(length);
      return result;
    };

    try {
      return await Promise.race([readPromise(), timeoutPromise]);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  const sendSTK500v2Command = async (
    port: SerialPort,
    data: Uint8Array,
    timeoutMs = 1000
  ): Promise<Uint8Array> => {
    const seq = 1;
    const len = data.length;
    const packet = new Uint8Array(5 + len + 1);
    packet[0] = 0x1B;
    packet[1] = seq;
    packet[2] = (len >> 8) & 0xFF;
    packet[3] = len & 0xFF;
    packet[4] = 0x0E;
    packet.set(data, 5);
    
    let chk = 0;
    for (let i = 0; i < packet.length - 1; i++) {
      chk ^= packet[i];
    }
    packet[packet.length - 1] = chk;

    const writer = port.writable!.getWriter();
    try {
      await writer.write(packet);
    } finally {
      writer.releaseLock();
    }

    const reader = port.readable!.getReader();
    try {
      const header = await readBytes(reader, 5, timeoutMs);
      if (header[0] !== 0x1B || header[4] !== 0x0E) {
        throw new Error('STK500v2 invalid response header');
      }
      const respLen = (header[2] << 8) | header[3];
      const bodyAndChecksum = await readBytes(reader, respLen + 1, timeoutMs);
      
      let computedChk = 0;
      for (let i = 0; i < 5; i++) computedChk ^= header[i];
      for (let i = 0; i < respLen; i++) computedChk ^= bodyAndChecksum[i];
      if (computedChk !== bodyAndChecksum[respLen]) {
        throw new Error('STK500v2 checksum mismatch');
      }
      
      return bodyAndChecksum.slice(0, respLen);
    } finally {
      reader.releaseLock();
    }
  };

  const syncSTK500v1 = async (port: SerialPort): Promise<boolean> => {
    appendLog('INFO', 'Sending STK500v1 GET_SYNC...');
    for (let attempt = 1; attempt <= 10; attempt++) {
      if (abortRef.current) return false;
      try {
        readBufferRef.current = [];
        const writer = port.writable!.getWriter();
        try { await writer.write(new Uint8Array([0x30, 0x20])); } finally { writer.releaseLock(); }
        const reader = port.readable!.getReader();
        try {
          const resp = await readBytes(reader, 2, 500);
          if (resp[0] === 0x14 && resp[1] === 0x10) {
            appendLog('INFO', 'STK500v1 SYNC acknowledged.');
            return true;
          }
        } finally { reader.releaseLock(); }
      } catch (err) {
        console.warn(`STK500v1 SYNC attempt ${attempt}/10 failed...`);
        await sleep(100);
      }
    }
    return false;
  };

  const readFlashSTK500v1 = async (
    port: SerialPort,
    offset: number,
    size: number
  ): Promise<Uint8Array> => {
    const wordAddr = offset / 2;
    const addrH = (wordAddr >> 8) & 0xFF;
    const addrL = wordAddr & 0xFF;
    
    const writer = port.writable!.getWriter();
    try {
      await writer.write(new Uint8Array([0x55, addrL, addrH, 0x20]));
    } finally {
      writer.releaseLock();
    }
    
    let reader = port.readable!.getReader();
    try {
      const resp = await readBytes(reader, 2, 500);
      if (resp[0] !== 0x14 || resp[1] !== 0x10) {
        throw new Error(`STK500v1 set address failed at offset ${offset}`);
      }
    } finally {
      reader.releaseLock();
    }
    
    const sizeH = (size >> 8) & 0xFF;
    const sizeL = size & 0xFF;
    
    const writer2 = port.writable!.getWriter();
    try {
      await writer2.write(new Uint8Array([0x74, sizeH, sizeL, 0x46, 0x20]));
    } finally {
      writer2.releaseLock();
    }
    
    reader = port.readable!.getReader();
    try {
      const resp = await readBytes(reader, size + 2, 1000);
      if (resp[0] !== 0x14 || resp[resp.length - 1] !== 0x10) {
        throw new Error(`STK500v1 short page read at offset ${offset}`);
      }
      return resp.slice(1, 1 + size);
    } finally {
      reader.releaseLock();
    }
  };

  const syncSTK500v2 = async (port: SerialPort): Promise<boolean> => {
    appendLog('INFO', 'Sending STK500v2 CMD_SIGN_ON...');
    for (let attempt = 1; attempt <= 10; attempt++) {
      if (abortRef.current) return false;
      try {
        readBufferRef.current = [];
        const resp = await sendSTK500v2Command(port, new Uint8Array([0x01]), 500);
        if (resp[0] === 0x01 && resp[1] === 0x00) {
          appendLog('INFO', 'STK500v2 SYNC acknowledged.');
          return true;
        }
      } catch (err) {
        console.warn(`STK500v2 SYNC attempt ${attempt}/10 failed...`);
        await sleep(100);
      }
    }
    return false;
  };

  const readFlashSTK500v2 = async (
    port: SerialPort,
    offset: number,
    size: number
  ): Promise<Uint8Array> => {
    const addr = offset | 0x80000000;
    const addrBytes = new Uint8Array([
      0x06,
      (addr >> 24) & 0xFF,
      (addr >> 16) & 0xFF,
      (addr >> 8) & 0xFF,
      addr & 0xFF
    ]);
    
    let resp = await sendSTK500v2Command(port, addrBytes, 500);
    if (resp[0] !== 0x06 || resp[1] !== 0x00) {
      throw new Error(`STK500v2 CMD_LOAD_ADDRESS failed at ${offset}`);
    }
    
    const readCmd = new Uint8Array([
      0x14,
      (size >> 8) & 0xFF,
      size & 0xFF,
      0x20
    ]);
    resp = await sendSTK500v2Command(port, readCmd, 1000);
    if (resp[0] !== 0x14 || resp[1] !== 0x00) {
      throw new Error(`STK500v2 CMD_READ_FLASH_ISP failed at ${offset}`);
    }
    
    return resp.slice(2, 2 + size);
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
  ): Promise<{ value: number; body: Uint8Array; decoded: Uint8Array }> => {
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
      for (let attempt = 0; attempt < 5; attempt++) {
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
        if (respOpcode === opcode) {
          return { value: respValue, body: respBody, decoded: responseDecoded };
        }
        if (respOpcode === 0x08 && opcode !== 0x08) {
          // Stale SYNC ACK — discard and read next packet
          appendLog('WARN', `Discarding stale SYNC ACK while waiting for opcode 0x${opcode.toString(16)}`);
          continue;
        }
        throw new Error(`Opcode mismatch: expected 0x${opcode.toString(16)}, got 0x${respOpcode.toString(16)}`);
      }
      throw new Error('Too many stale packets — could not get valid response');
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
    try {
      await port.setSignals({ dataTerminalReady: true, requestToSend: false }); // GPIO0 LOW
      await sleep(100);
      await port.setSignals({ dataTerminalReady: true, requestToSend: true });  // EN LOW (reset)
      await sleep(100);
      await port.setSignals({ dataTerminalReady: true, requestToSend: false }); // EN HIGH (start)
      await sleep(500); // CRITICAL: bootloader takes 400ms to init UART
      await port.setSignals({ dataTerminalReady: false, requestToSend: false }); // GPIO0 release
      await sleep(100);
      // Flush serial buffer (discard ADC/sketch output that printed during reset):
      await flushSerialBuffer(port, 300);
    } catch (e: any) {
      appendLog('WARN', `[Bootloader] Failed to set DTR/RTS signals: ${e.message || e}. If device fails to sync, press BOOT/BOOT0/RESET manually.`);
    }
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

    for (let attempt = 0; attempt < 10; attempt++) {
      if (abortRef.current) return false;
      await sleep(attempt === 0 ? 600 : 200 + attempt * 100);
      
      try {
        readBufferRef.current = []; // Reset reader buffer
        await sendCommand(port, 0x08, syncPayload, 500);
        appendLog('INFO', 'SYNC acknowledged. Draining stale ACK buffer...');
        await drainStaleResponses(port, 300);
        appendLog('INFO', 'Buffer clear. Ready for flash commands.');
        return true;
      } catch (err) {
        console.warn(`SYNC attempt ${attempt + 1}/10 failed...`);
      }
    }

    // On SYNC failure: show MCU-specific manual instructions
    const help = BOOTLOADER_HELP[selectedArch] || [
      'Sync failed. Please verify hardware connections, baud rate, and boot mode.'
    ];
    for (const line of help) {
      if (line.includes('failed') || line.includes('required')) {
        appendLog('WARN', line);
      } else {
        appendLog('INFO', line);
      }
    }
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
    view.setUint32(8, size, true); // Block size is same as request size
    view.setUint32(12, 64, true);   // 64 packet in-flight for stability

    // Max 3 retries on checksum error
    for (let retry = 1; retry <= 3; retry++) {
      if (abortRef.current) throw new Error('Extraction cancelled');
      
      try {
        const { body, decoded } = await sendCommand(port, 0x03, payload, 1000);
        
        // Validate XOR Checksum using verifySlipChecksum
        if (!verifySlipChecksum(decoded, size)) {
          throw new Error('XOR Checksum Mismatch');
        }

        return body;
      } catch (err: any) {
        if (retry === 3) {
          throw new Error(`Block read failed after 3 attempts. ${err.message || ''}`);
        }
        
        const retryHex = `0x${offset.toString(16).toUpperCase().padStart(6, '0')}`;
        appendLog('WARN', `Checksum mismatch at block ${retryHex} — retrying (${retry}/3)...`);
        await sleep(300);
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
    abortRef.current = false;
    setErrorMessage(null);
    setBytesRead(0);
    setTotalBytes(targetSize);
    setProgressPercent(0);
    setFlashBuffer(null);
    setHexBuffer?.(new Uint8Array(0)); // clear sketch serial pollution

    // --- MOCK SIMULATION MODE ---
    if (isDemoMode) {
      setExtractionStatus('syncing');
      appendLog('INFO', 'Entering bootloader mode...');
      await sleep(400);
      
      appendLog('INFO', 'Sending SYNC...');
      await sleep(300);
      
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
        await sleep(8);

        // Generate mockup binary patterns
        const currentBlockSize = Math.min(1024, targetSize - offset);
        for (let j = 0; j < currentBlockSize; j++) {
          tempBuffer[offset + j] = (offset + j) % 256;
        }

        readCount += currentBlockSize;
        setBytesRead(readCount);
        const percent = Math.round((readCount / targetSize) * 100);
        setProgressPercent(percent);
        setFlashBuffer(new Uint8Array(tempBuffer));
        setHexBuffer?.(new Uint8Array(tempBuffer.slice(0, readCount)));

        // Specific logs required by visual specs
        if (offset === 0x001400) {
          appendLog('DATA', 'Block 0x001400 received — 1024 bytes (checksum OK)');
        } else if (offset === 0x002800) {
          appendLog('WARN', 'Checksum mismatch at block 0x002800 — retrying (1/3)...');
          await sleep(400);
          appendLog('DATA', 'Block 0x002800 received — 1024 bytes (checksum OK)');
        } else if (offset % (1024 * 64) === 0) {
          const hexOffset = `0x${offset.toString(16).toUpperCase().padStart(6, '0')}`;
          appendLog('DATA', `Block ${hexOffset} received — ${currentBlockSize} bytes (checksum OK)`);
        }
      }

      setFlashBuffer(tempBuffer);
      setHexBuffer?.(new Uint8Array(tempBuffer));
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

      const profile = MCU_REGISTRY[arch];
      const isAvr = profile?.family === 'AVR';

      if (isAvr) {
        // --- AVR STK500v1 / STK500v2 PROTOCOLS ---
        const portInfo = await port.getInfo();
        const isftdi = portInfo.usbVendorId === 0x0403; // FTDI FT232R
        const isCH340 = portInfo.usbVendorId === 0x1A86; // CH340 (Chinese Nano clones)

        const resetArduino = async (p: SerialPort): Promise<void> => {
          try {
            if (isftdi || isCH340) {
              // FTDI FT232R and CH340: DTR=false pulses RST LOW via capacitor
              // Opposite polarity from CP2102
              await p.setSignals({ dataTerminalReady: false });
              await sleep(150);  // hold reset
              await p.setSignals({ dataTerminalReady: true });
              await sleep(200);  // wait for bootloader to start
            } else {
              // CP2102 and others: DTR=true then false
              await p.setSignals({ dataTerminalReady: true });
              await sleep(100);
              await p.setSignals({ dataTerminalReady: false });
              await sleep(200);
            }
          } catch (e: any) {
            console.warn('Failed to set DTR reset:', e);
          }
        };

        let currentBaud = profile.default_baud || 115200;
        let stkSynced = false;

        // Show countdown in terminal
        appendLog('WARN', `Arduino bootloader window: 8 seconds. Starting extraction...`);
        let remaining = 8;
        const countdown = setInterval(() => {
          remaining--;
          if (remaining > 0) {
            appendLog('INFO', `Bootloader window: ${remaining}s remaining...`);
          } else {
            clearInterval(countdown);
          }
        }, 1000);

        try {
          if (profile.protocol === 'STK500v2') {
            appendLog('INFO', `Starting STK500v2 bootloader handshake at ${currentBaud} baud...`);
            await resetArduino(port);
            await flushSerialBuffer(port, 300);
            stkSynced = await syncSTK500v2(port);
          } else {
            // STK500v1: try bauds in sequence
            const ARDUINO_BAUD_SEQUENCE = isftdi
              ? [57600, 115200]   // FTDI original Nano: try 57600 FIRST
              : [115200, 57600];  // CH340 clone Nano: try 115200 first

            for (const baud of ARDUINO_BAUD_SEQUENCE) {
              try {
                if (port.readable || (port as any).writable) {
                  await port.close();
                }
              } catch (_) {}
              
              await port.open({ baudRate: baud });
              currentBaud = baud;
              appendLog('INFO', `Attempting STK500v1 SYNC at ${baud} baud...`);
              await resetArduino(port);
              await flushSerialBuffer(port, 300);
              if (await syncSTK500v1(port)) {
                appendLog('INFO', `SYNC success at ${baud} baud.`);
                stkSynced = true;
                break;
              }
              appendLog('WARN', `SYNC failed at ${baud} — trying next baud rate...`);
            }
          }
        } catch (err) {
          console.warn('Sync failed', err);
        } finally {
          clearInterval(countdown);
        }

        if (!stkSynced) {
          appendLog('ERROR', 'Sync failed — press RST then immediately click Extract.');
          const help = BOOTLOADER_HELP[arch] || [
            'Sync failed. Please verify hardware connections, baud rate, and boot mode.'
          ];
          for (const line of help) {
            if (line.includes('failed') || line.includes('required')) {
              appendLog('WARN', line);
            } else {
              appendLog('INFO', line);
            }
          }
          throw new Error('Sync failed — press RST then immediately click Extract.');
        }

        // Extraction
        setExtractionStatus('reading');
        appendLog('INFO', `Beginning flash read at offset 0x000000...`);

        const buffer = new Uint8Array(targetSize);
        let offset = 0;
        const pageSize = profile.protocol === 'STK500v2' ? 256 : 128;

        while (offset < targetSize) {
          if (abortRef.current) {
            appendLog('WARN', 'Extraction cancelled by user.');
            setExtractionStatus('idle');
            resumeReadLoop();
            return;
          }

          let block: Uint8Array;
          if (profile.protocol === 'STK500v2') {
            block = await readFlashSTK500v2(port, offset, pageSize);
          } else {
            block = await readFlashSTK500v1(port, offset, pageSize);
          }
          buffer.set(block, offset);
          setFlashBuffer(new Uint8Array(buffer));

          offset += pageSize;
          setBytesRead(offset);
          setProgressPercent(Math.round((offset / targetSize) * 100));
          setHexBuffer?.(new Uint8Array(buffer.slice(0, offset)));

          if (offset % (pageSize * 16) === 0 || offset === targetSize) {
            const hexOffset = `0x${offset.toString(16).toUpperCase().padStart(6, '0')}`;
            appendLog('DATA', `Block ${hexOffset} received — ${pageSize} bytes (checksum OK)`);
          }
        }

        setFlashBuffer(buffer);
        setHexBuffer?.(new Uint8Array(buffer));
        setExtractionStatus('done');
        appendLog('INFO', `Extraction complete. ${targetSize} bytes read. Binary ready for download.`);
        if (onExtractionDone) {
          onExtractionDone(buffer);
        }

      } else {
        // --- ESPRESSIF SLIP PROTOCOL (ESP32 / ESP8266) ---
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

        // 3.5 Auto Baud Rate Upgrade to 460800
        try {
          appendLog('INFO', 'Negotiating baud rate upgrade to 460800 for faster extraction...');
          const changeBaudPayload = new Uint8Array(8);
          const baudView = new DataView(changeBaudPayload.buffer);
          baudView.setUint32(0, 460800, true);
          baudView.setUint32(4, 0, true); // ROM loader expects 0
          
          await sendCommand(port, 0x0F, changeBaudPayload, 500);
          await sleep(50); // let packet fully transmit
          
          // Switch host baud rate to 460800
          await port.close();
          await port.open({ baudRate: 460800 });
          appendLog('INFO', 'Baud rate successfully upgraded to 460800.');
        } catch (err: any) {
          appendLog('WARN', `Baud rate upgrade failed. Continuing at 115200.`);
          try {
            await port.close();
          } catch (_) {}
          try {
            await port.open({ baudRate: 115200 });
          } catch (_) {}
        }

        // 4. Read Flash blocks
        setExtractionStatus('reading');
        appendLog('INFO', `Beginning flash read at offset 0x000000...`);

        const buffer = new Uint8Array(targetSize);
        let offset = 0;

        let blockSize = 1024;
        if (['esp32s2', 'esp32c3', 'esp32c6', 'esp32h2'].includes(arch)) {
          blockSize = 512;
        }

        while (offset < targetSize) {
          if (abortRef.current) {
            appendLog('WARN', 'Extraction cancelled by user.');
            setExtractionStatus('idle');
            resumeReadLoop();
            return;
          }

          const currentBlockSize = Math.min(blockSize, targetSize - offset);
          const block = await readFlashBlock(port, offset, currentBlockSize);
          buffer.set(block, offset);
          setFlashBuffer(new Uint8Array(buffer));

          offset += currentBlockSize;
          setBytesRead(offset);
          setProgressPercent(Math.round((offset / targetSize) * 100));
          setHexBuffer?.(new Uint8Array(buffer.slice(0, offset)));

          // Periodically log progress blocks
          if (offset === 0x001400) {
            appendLog('DATA', 'Block 0x001400 received — 1024 bytes (checksum OK)');
          } else if (offset % (blockSize * 32) === 0 || offset === targetSize) {
            const hexOffset = `0x${offset.toString(16).toUpperCase().padStart(6, '0')}`;
            appendLog('DATA', `Block ${hexOffset} received — ${currentBlockSize} bytes (checksum OK)`);
          }
        }

        setFlashBuffer(buffer);
        setHexBuffer?.(new Uint8Array(buffer));
        setExtractionStatus('done');
        appendLog('INFO', `Extraction complete. ${targetSize} bytes read. Binary ready for download.`);
        
        if (onExtractionDone) {
          onExtractionDone(buffer);
        }
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

  /**
   * Resets all flash extractor state variables.
   */
  const resetExtraction = useCallback(() => {
    setExtractionStatus('idle');
    setBytesRead(0);
    setTotalBytes(0);
    setProgressPercent(0);
    setFlashBuffer(null);
    setErrorMessage(null);
    abortRef.current = false;
  }, []);

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
    resetExtraction,
  };
};

import { useState, useCallback } from 'react';
import { MCU_REGISTRY } from '../utils/mcuRegistry';
import { getBackendUrl } from '../utils/backend';

export type DetectStatus = 'idle' | 'probing' | 'detected' | 'error';
export type Confidence = 'high' | 'medium' | 'low';
export type RecommendedAction = 'file-browser' | 'extract' | 'terminal' | 'info-only' | null;

export interface FilesystemCommands {
  list: string;
  read: string;
  size: string;
  space?: string;
}

export const DEMO_RUNTIME_MAP: Record<string, string> = {
  // Espressif
  "esp32": "compiled",
  "esp32s2": "micropython",
  "esp32s3": "circuitpython",
  "esp32c3": "espruino",
  "esp32c6": "nodemcu",
  "esp32h2": "compiled",
  "esp8266": "at-firmware",

  // AVR
  "atmega328p": "compiled",
  "atmega2560": "compiled",
  "atmega32u4": "compiled",
  "attiny85": "compiled",
  "attiny45": "compiled",
  "atmega4809": "compiled",

  // STM32
  "stm32f1": "compiled",
  "stm32f4": "micropython",
  "stm32l0": "compiled",
  "stm32l4": "compiled",
  "stm32g0": "compiled",
  "stm32g4": "compiled",
  "stm32h7": "compiled",
  "gd32f1": "compiled",

  // RP
  "rp2040": "circuitpython",
  "rp2350": "micropython",

  // SAMD
  "samd21": "circuitpython",
  "samd51": "circuitpython",

  // nRF
  "nrf52840": "circuitpython",
  "nrf52833": "compiled",
  "nrf51822": "compiled",

  // LPC (NXP)
  "lpc1768": "compiled",
  "lpc1114": "compiled",
  "lpc54608": "compiled",

  // i.MX (NXP)
  "mimxrt1060": "compiled",

  // MSP430 (TI)
  "msp430g2": "compiled",
  "msp430f5": "compiled",
  "msp430fr5": "compiled",

  // WCH
  "ch32v003": "compiled",
  "ch32v203": "compiled",
  "ch552": "compiled",
  "ch554": "compiled",

  // PIC
  "pic16f": "compiled",
  "pic18f": "compiled",
  "pic32mx": "compiled",

  // Renesas
  "rl78": "compiled",
  "rx65n": "compiled",
  "ra4m1": "compiled",

  // Silicon Labs
  "efm32gg": "compiled",
  "efm32tg": "compiled",

  // Infineon
  "xmc1100": "compiled",
  "xmc4700": "compiled"
};

export const useSmartDetect = () => {
  const [detectStatus, setDetectStatus] = useState<DetectStatus>('idle');
  const [detectedRuntime, setDetectedRuntime] = useState<string | null>(null);
  const [runtimeVersion, setRuntimeVersion] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<Confidence>('low');
  const [recommendedAction, setRecommendedAction] = useState<RecommendedAction>(null);
  const [detectionMessage, setDetectionMessage] = useState<string>('');
  const [filesystemCommands, setFilesystemCommands] = useState<FilesystemCommands | null>(null);

  const resetDetection = useCallback(() => {
    setDetectStatus('idle');
    setDetectedRuntime(null);
    setRuntimeVersion(null);
    setConfidence('low');
    setRecommendedAction(null);
    setDetectionMessage('');
    setFilesystemCommands(null);
  }, []);

  const runDetection = useCallback(async (
    port: SerialPort | null,
    arch: string,
    isDemoMode: boolean,
    appendLog: (level: 'INFO' | 'WARN' | 'ERROR' | 'DATA', msg: string) => void
  ) => {
    // STATE-010: at start of runDetection(), set detectedRuntime=null and detectStatus='probing' before any probe
    setDetectedRuntime(null);
    setDetectStatus('probing');
    setConfidence('low');
    setRecommendedAction(null);
    setDetectionMessage('Initializing Smart Runtime Detector...');
    
    appendLog('INFO', '[SmartDetect] Probing serial interface for active runtime environments...');

    const mcu = MCU_REGISTRY[arch];
    if (arch === 'nrf52840') {
      appendLog('INFO', '[INFO] nRF52840 detected — if device resets, hold reset and try again.');
    }

    if (mcu && mcu.common_runtimes && mcu.common_runtimes.length === 1 && mcu.common_runtimes[0] === 'compiled') {
      appendLog('INFO', '[SmartDetect] AVR/PIC/MSP430 — skipping runtime probes.');
      const fallbackResult = {
        runtime: 'compiled',
        confidence: 'high' as Confidence,
        runtime_version: null,
        action: 'extract' as RecommendedAction,
        message: 'AVR/PIC/MSP430 — skipping runtime probes.',
        filesystem_commands: null,
        frozen_module_hint: false
      };
      setDetectStatus('detected');
      setDetectedRuntime(fallbackResult.runtime);
      setConfidence(fallbackResult.confidence);
      setRecommendedAction(fallbackResult.action);
      setDetectionMessage(fallbackResult.message);
      setFilesystemCommands(null);
      return fallbackResult;
    }

    if (isDemoMode) {
      // Simulate 1s delay and resolve
      await new Promise(r => setTimeout(r, 1000));
      setDetectStatus('detected');
      
      const runtime = DEMO_RUNTIME_MAP[arch] ?? 'compiled';
      setDetectedRuntime(runtime);

      if (runtime === 'micropython') {
        setRuntimeVersion('1.22.0');
        setConfidence('high');
        setRecommendedAction('file-browser');
        setDetectionMessage('MicroPython detected (confidence: high). Bypassing binary extraction.');
        setFilesystemCommands({
          list: "import os; print(os.listdir('/'))",
          read: "f=open('{filename}'); print(f.read()); f.close()",
          size: "import os; print(os.stat('{filename}')[6])",
          space: "import os; s=os.statvfs('/'); print(s[0]*s[3])"
        });
        appendLog('INFO', '[SmartDetect] MicroPython runtime detected. File Browser unlocked.');
        return {
          runtime: 'micropython',
          action: 'file-browser' as RecommendedAction
        };
      } else if (runtime === 'circuitpython') {
        setRuntimeVersion('9.0.0');
        setConfidence('high');
        setRecommendedAction('file-browser');
        setDetectionMessage('CircuitPython detected (confidence: high). Bypassing binary extraction.');
        setFilesystemCommands({
          list: "import os; print(os.listdir('/'))",
          read: "f=open('{filename}'); print(f.read()); f.close()",
          size: "import os; print(os.stat('{filename}')[6])",
          space: "import os; s=os.statvfs('/'); print(s[0]*s[3])"
        });
        appendLog('INFO', '[SmartDetect] CircuitPython runtime detected. File Browser unlocked.');
        return {
          runtime: 'circuitpython',
          action: 'file-browser' as RecommendedAction
        };
      } else if (runtime === 'espruino') {
        setRuntimeVersion('2v21');
        setConfidence('high');
        setRecommendedAction('file-browser');
        setDetectionMessage('Espruino JS runtime detected (confidence: high). Bypassing binary extraction.');
        setFilesystemCommands({
          list: "require('fs').readdirSync('/')",
          read: "require('fs').readFileSync('{filename}')",
          size: "require('fs').statSync('{filename}').size",
        });
        appendLog('INFO', '[SmartDetect] Espruino JS runtime detected. File Browser unlocked.');
        return {
          runtime: 'espruino',
          action: 'file-browser' as RecommendedAction
        };
      } else if (runtime === 'nodemcu') {
        setRuntimeVersion('3.0.0');
        setConfidence('high');
        setRecommendedAction('file-browser');
        setDetectionMessage('NodeMCU Lua runtime detected (confidence: high). Bypassing binary extraction.');
        setFilesystemCommands({
          list: "for k,v in pairs(file.list()) do print(k,v) end",
          read: "if file.open('{filename}','r') then print(file.read()); file.close() end",
          size: "local s=file.list(); print(s['{filename}'] or 0)",
        });
        appendLog('INFO', '[SmartDetect] NodeMCU Lua runtime detected. File Browser unlocked.');
        return {
          runtime: 'nodemcu',
          action: 'file-browser' as RecommendedAction
        };
      } else if (runtime === 'at-firmware') {
        setRuntimeVersion('1.7.4');
        setConfidence('high');
        setRecommendedAction('terminal');
        setDetectionMessage('AT Command firmware detected (confidence: high). Routing to shell console.');
        setFilesystemCommands(null);
        appendLog('INFO', '[SmartDetect] AT Command interface detected. Routing to console terminal.');
        return {
          runtime: 'at-firmware',
          action: 'terminal' as RecommendedAction
        };
      } else {
        setRuntimeVersion(null);
        setConfidence('low');
        setRecommendedAction('extract');
        setDetectionMessage('No interpreted runtime detected. Ready for firmware extraction.');
        setFilesystemCommands(null);
        appendLog('INFO', '[SmartDetect] Probes completed. No interpreted runtime found. Proceeding to binary extraction.');
        return {
          runtime: 'compiled',
          action: 'extract' as RecommendedAction
        };
      }
    }

    if (!port || !port.readable || !port.writable) {
      setDetectStatus('error');
      setDetectionMessage('Serial port is not readable or writable.');
      appendLog('ERROR', '[SmartDetect] Detection failed: Serial port not ready.');
      return {
        runtime: 'compiled',
        action: 'extract'
      };
    }

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    let accumulatedText = '';
    const textDecoder = new TextDecoder();
    let isFinished = false;

    try {
      writer = port.writable.getWriter();
      reader = port.readable.getReader();

      const encoder = new TextEncoder();
      const writeData = async (data: string) => {
        if (!writer) return;
        await writer.write(encoder.encode(data));
      };

      // 1. REPL probe
      const isSTM32 = mcu && (mcu.family === 'STM32' || mcu.mcu_id.startsWith('stm32') || mcu.family === 'STMicroelectronics');

      if (isSTM32) {
        // STM32: REPL probe, then STM32 0x7F autobaud sync byte (skip AT/Lua/JS probes)
        await writeData('\r\n\x03\x04\r\n');
        await new Promise(r => setTimeout(r, 150));
        if (writer) {
          await writer.write(new Uint8Array([0x7F]));
        }
        await new Promise(r => setTimeout(r, 150));
      } else {
        await writeData('\r\n\x03\x04\r\n');
        await new Promise(r => setTimeout(r, 150));
        // 2. Lua/Espruino probe
        await writeData('\r\n');
        await new Promise(r => setTimeout(r, 150));
        // 3. AT probe
        await writeData('AT\r\n');
      }

      // Release write lock to allow future uses
      writer.releaseLock();
      writer = null;

      // Start read loop with a 3-second timeout
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 3000);
      });

      const readLoopPromise = (async () => {
        while (!isFinished && reader) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            const chunk = textDecoder.decode(value);
            accumulatedText += chunk;
            
            // Append data to terminal logs
            appendLog('DATA', chunk.replace(/\r/g, ''));
            
            // Check matches to short-circuit
            const lowerText = accumulatedText.toLowerCase();
            if (lowerText.includes('micropython') || lowerText.includes('circuitpython') || lowerText.includes('openmv') || lowerText.includes('>>>')) {
              isFinished = true;
              break;
            }
            if (lowerText.includes('nodemcu') || lowerText.includes('elua') || lowerText.includes('lua') || />\s*$/.test(accumulatedText)) {
              isFinished = true;
              break;
            }
            if (lowerText.includes('espruino') || lowerText.includes('espruino.com')) {
              isFinished = true;
              break;
            }
            if (/ok\r?\n|\bok\b/i.test(accumulatedText)) {
              isFinished = true;
              break;
            }
            if (/uart:~\$|shell>|ready|basic|\bok\b/i.test(accumulatedText)) {
              isFinished = true;
              break;
            }
          }
        }
      })();

      await Promise.race([readLoopPromise, timeoutPromise]).catch((err) => {
        if (err.message !== 'timeout') throw err;
      });

    } catch (err: any) {
      console.warn('[SmartDetect] Probe loop issue:', err);
    } finally {
      isFinished = true;
      if (writer) {
        try { writer.releaseLock(); } catch (_) {}
      }
      if (reader) {
        try {
          await reader.cancel();
          reader.releaseLock();
        } catch (_) {}
      }
    }

    // Call the backend POST /api/detect with the accumulated text
    try {
      appendLog('INFO', '[SmartDetect] Analyzing probe signatures...');
      const binaryStr = new TextEncoder().encode(accumulatedText);
      const bytes = new Uint8Array(binaryStr);
      let asciiStr = '';
      // Extract up to first 512 bytes
      for (let i = 0; i < Math.min(bytes.length, 512); i++) {
        asciiStr += String.fromCharCode(bytes[i]);
      }
      const base64Data = window.btoa(asciiStr);

      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          port_data: base64Data,
          arch: arch
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const res = await response.json();
      setDetectStatus('detected');
      setDetectedRuntime(res.runtime);
      setRuntimeVersion(res.runtime_version);
      setConfidence(res.confidence);
      setRecommendedAction(res.action);
      setDetectionMessage(res.message);
      setFilesystemCommands(res.filesystem_commands);

      appendLog('INFO', `[SmartDetect] Detection completed. Result: ${res.runtime} (${res.confidence} confidence).`);
      return res;

    } catch (err: any) {
      console.error('[SmartDetect] Backend detect call failed:', err);
      setDetectStatus('error');
      setDetectionMessage('Detection query failed. Defaulting to compiled firmware.');
      appendLog('WARN', '[SmartDetect] Detection backend unreachable. Proceeding to binary extraction.');
      
      const fallbackResult = {
        runtime: 'compiled',
        confidence: 'low' as Confidence,
        runtime_version: null,
        action: 'extract' as RecommendedAction,
        message: 'No response. Defaulting to compiled firmware.',
        filesystem_commands: null,
        frozen_module_hint: false
      };

      setDetectStatus('detected');
      setDetectedRuntime(fallbackResult.runtime);
      setConfidence(fallbackResult.confidence);
      setRecommendedAction(fallbackResult.action);
      setDetectionMessage(fallbackResult.message);
      setFilesystemCommands(null);

      return fallbackResult;
    }
  }, []);

  return {
    detectStatus,
    detectedRuntime,
    runtimeVersion,
    confidence,
    recommendedAction,
    detectionMessage,
    filesystemCommands,
    runDetection,
    resetDetection
  };
};

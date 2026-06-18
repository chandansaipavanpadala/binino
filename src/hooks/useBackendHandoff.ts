import { useState, useRef, useCallback, useEffect } from 'react';
import { AnalysisResult } from '../types/analysis';

export type UploadStatus = 'idle' | 'uploading' | 'queued' | 'analyzing' | 'done' | 'error';

interface UseBackendHandoffProps {
  flashBuffer: Uint8Array | null;
  extractionStatus: string;
  selectedArch: string;
  appendLog: (level: 'INFO' | 'WARN' | 'ERROR' | 'DATA', message: string) => void;
  isDemoMode: boolean;
}

/**
 * Custom hook managing the decompiler backend handoff pipeline.
 * Uploads flash binary packages and streams analysis logs via SSE.
 */
export const useBackendHandoff = ({
  flashBuffer,
  extractionStatus,
  selectedArch,
  appendLog,
  isDemoMode,
}: UseBackendHandoffProps) => {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisStage, setAnalysisStage] = useState<string>('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const demoTimeoutRefs = useRef<any[]>([]);

  // Cleanup connections on unmount
  useEffect(() => {
    return () => {
      if (xhrRef.current) xhrRef.current.abort();
      if (eventSourceRef.current) eventSourceRef.current.close();
      demoTimeoutRefs.current.forEach(clearTimeout);
    };
  }, []);

  /**
   * Resets hook progress states back to default idle.
   */
  const resetHandoff = useCallback(() => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setAnalysisProgress(0);
    setAnalysisStage('');
    setJobId(null);
    setResult(null);
    setErrorMessage(null);
    demoTimeoutRefs.current.forEach(clearTimeout);
    demoTimeoutRefs.current = [];
  }, []);

  /**
   * Disconnects active HTTP/SSE connections.
   */
  const cancelHandoff = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    demoTimeoutRefs.current.forEach(clearTimeout);
    demoTimeoutRefs.current = [];
    
    setUploadStatus('idle');
    appendLog('WARN', 'Handoff decompiler upload transaction cancelled by user.');
  }, [appendLog]);

  /**
   * Establishes a non-blocking Server-Sent Events stream to track Ghidra progress.
   * @param targetJobId The registered unique job ID.
   */
  const connectSSE = useCallback((targetJobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    appendLog('INFO', `Connecting to progress event stream for job: ${targetJobId}...`);
    const sseUrl = `http://localhost:8000/api/analyze/${targetJobId}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    // Await status updates
    es.addEventListener('status', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const { stage, message, percent } = payload;
        setUploadStatus('analyzing');
        setAnalysisProgress(percent);
        setAnalysisStage(`${stage}: ${message}`);
        appendLog('INFO', `Ghidra: [${stage.toUpperCase()}] ${message} (${percent}%)`);
      } catch (err) {
        console.error('Failed to parse SSE status event payload:', err);
      }
    });

    // Await decompiled results payload
    es.addEventListener('result', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        setResult(payload);
        appendLog('INFO', `Decompilation results compiled. Reconstructed ${payload.functions?.length || 0} functions.`);
      } catch (err) {
        console.error('Failed to parse SSE result event payload:', err);
      }
    });

    // Await compilation success boundary
    es.addEventListener('done', () => {
      setUploadStatus('done');
      setAnalysisProgress(100);
      setAnalysisStage('Decompilation completed successfully.');
      appendLog('INFO', 'Handoff processing complete. Code workspace compiled.');
      es.close();
    });

    // Await errors from backend
    es.addEventListener('error', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        setUploadStatus('error');
        setErrorMessage(payload.message || 'Ghidra analysis failed');
        appendLog('ERROR', `Decompilation failed: ${payload.message || 'Internal hardware process exception'}`);
      } catch (_) {
        setUploadStatus('error');
        setErrorMessage('Ghidra runner exited with errors.');
        appendLog('ERROR', 'Decompilation pipeline aborted by backend script.');
      }
      es.close();
    });

    // Handle network drops
    es.onerror = () => {
      // Avoid overwrite error state if closed successfully
      setUploadStatus((prev) => {
        if (prev === 'done' || prev === 'error') return prev;
        appendLog('ERROR', 'Cannot connect to Binino server on localhost:8000. Run: python -m uvicorn server.main:app --port 8000');
        setErrorMessage('Cannot connect to Binino server on localhost:8000.');
        return 'error';
      });
      es.close();
    };
  }, [appendLog]);

  /**
   * Packages flash contents and dispatches them to the FastAPI backend.
   * Leverages XMLHttpRequest for granular upload percentage tracking.
   */
  const sendToServer = useCallback(async () => {
    resetHandoff();

    // Verify extraction is complete
    if (extractionStatus !== 'done') {
      const err = 'Extraction must be complete before decompilation handoff.';
      setErrorMessage(err);
      setUploadStatus('error');
      appendLog('ERROR', `Handoff rejected: ${err}`);
      return;
    }

    // --- EMULATED GRAPHICS (DEMO MODE) ---
    if (isDemoMode) {
      setUploadStatus('uploading');
      setUploadProgress(0);
      appendLog('INFO', 'Simulating firmware binary upload to decompiler server (Demo Mode)...');

      // Upload progress ticks
      const t1 = setTimeout(() => { setUploadProgress(35); }, 500);
      const t2 = setTimeout(() => { setUploadProgress(70); }, 1000);
      const t3 = setTimeout(() => {
        setUploadProgress(100);
        setUploadStatus('queued');
        const mockJobId = `demo_job_${Math.random().toString(36).substr(2, 9)}`;
        setJobId(mockJobId);
        appendLog('INFO', `Upload complete. Job queued on virtual decompiler. Job ID: ${mockJobId}`);
      }, 1500);

      // Analysis stages ticks
      const t4 = setTimeout(() => {
        setUploadStatus('analyzing');
        setAnalysisProgress(15);
        setAnalysisStage('Import: Reading firmware binary image...');
        appendLog('INFO', 'Ghidra: [IMPORT] Reconstructing partition alignments (15%)');
      }, 2500);

      const t5 = setTimeout(() => {
        setAnalysisProgress(40);
        setAnalysisStage('Auto Analysis: Scanning function tables and symbols...');
        appendLog('INFO', 'Ghidra: [AUTO ANALYSIS] Reconstructing basic blocks and call graphs (40%)');
      }, 4000);

      const t6 = setTimeout(() => {
        setAnalysisProgress(70);
        setAnalysisStage('Decompiling: Reconstructing control flow trees...');
        appendLog('INFO', 'Ghidra: [DECOMPILING] Running Xtensa decompiler AST constructs (70%)');
      }, 5500);

      const t7 = setTimeout(() => {
        setAnalysisProgress(90);
        setAnalysisStage('Exporting: Writing symbols & pseudo-C files...');
        appendLog('INFO', 'Ghidra: [EXPORTING] Generating symbol metadata and formatting sources (90%)');
      }, 7000);

      const t8 = setTimeout(() => {
        setUploadStatus('done');
        setAnalysisProgress(100);
        setAnalysisStage('Decompilation complete.');
        
        // Mock payload results matching schemas
        const baseAddr = selectedArch === 'esp32' ? 0x40080000 : selectedArch === 'rp2040' ? 0x10000000 : 0x08000000;
        const hexAddr = (offset: number) => `0x${(baseAddr + offset).toString(16).padStart(8, '0')}`;

        setResult({
          job_id: 'demo_job_mock',
          arch: selectedArch,
          simulated: true,
          entry_point: hexAddr(0x1200),
          raw_assembly_snippet: '; Entry point raw assembly dump\nmain:\n  push {r7, lr}\n  add r7, sp, #0\n  bl system_init\n  bl app_main\n  movs r0, #0\n  pop {r7, pc}',
          functions: [
            {
              name: 'system_init',
              address: hexAddr(0x0100),
              size: 64,
              pseudo_c: `void system_init() {
    // Initialise hardware peripherals and system clocks
    uint32_t *pcr = (uint32_t *)0x3FF00044;
    *pcr |= 0x00000003; // Enable CPU PLL
    
    // Configure default watchdog boundaries
    volatile uint32_t *wdt = (uint32_t *)0x60000900;
    *wdt = 0; // Disable watchdog timer for boot
    
    printf("Device initialized in bootloader mode\\n");
}`,
              assembly: `; system_init implementation
system_init:
  entry a1, 32
  movi a8, 0x3FF00044
  l32i a9, a8, 0
  or a9, a9, 3
  s32i a9, a8, 0
  movi a8, 0x60000900
  movi a9, 0
  s32i a9, a8, 0
  l32r a8, .LC_INIT_STR  ; "Device initialized in bootloader mode\\n"
  mov a2, a8
  call8 printf
  retw`
            },
            {
              name: 'wifi_connect_ap',
              address: hexAddr(0x0500),
              size: 112,
              pseudo_c: `int wifi_connect_ap(const char *ssid, const char *password) {
    if (ssid == NULL || password == NULL) {
        return -1;
    }
    
    printf("Attempting WiFi connect to: %s\\n", ssid);
    // Simulated WiFi register handshake
    volatile uint32_t *wifi_status = (uint32_t *)0x60001000;
    
    int retries = 0;
    while ((*wifi_status & 1) == 0) {
        if (retries++ > 5) {
            return -2; // Connection timeout
        }
        vTaskDelay(20);
    }
    return 0; // Success
}`,
              assembly: `; wifi_connect_ap implementation
wifi_connect_ap:
  entry a1, 32
  beqz a2, .L_WIFI_ERR
  beqz a3, .L_WIFI_ERR
  mov a6, a2
  l32r a2, .LC_CONNECT_STR  ; "Attempting WiFi connect to: %s\\n"
  mov a3, a6
  call8 printf
  movi a8, 0x60001000
  movi a7, 0 ; retries
.L_WIFI_LOOP:
  l32i a9, a8, 0
  extui a9, a9, 0, 1
  bnez a9, .L_WIFI_OK
  addi a7, a7, 1
  movi a9, 5
  blt a9, a7, .L_WIFI_TIMEOUT
  movi a2, 20
  call8 vTaskDelay
  j .L_WIFI_LOOP
.L_WIFI_ERR:
  movi a2, -1
  retw
.L_WIFI_TIMEOUT:
  movi a2, -2
  retw
.L_WIFI_OK:
  movi a2, 0
  retw`
            },
            {
              name: 'process_packet',
              address: hexAddr(0x0900),
              size: 144,
              pseudo_c: `void process_packet(uint32_t data) {
    uint8_t type = (data >> 24) & 0xFF;
    uint16_t length = (data >> 8) & 0xFFFF;
    uint8_t checksum = data & 0xFF;
    
    // Checksum verification rule: sum of parts
    uint8_t computed = (type + (length & 0xFF) + ((length >> 8) & 0xFF)) & 0xFF;
    if (computed != checksum) {
        log_write("Fatal interrupt caught in task queue");
        return;
    }
    
    switch (type) {
        case 0xA1: // PING
            break;
        case 0xB2: // SENSOR_DATA
            // Process payload
            break;
        default:
            break;
    }
}`,
              assembly: `; process_packet implementation
process_packet:
  entry a1, 32
  extui a8, a2, 24, 8 ; type
  extui a9, a2, 8, 16 ; length
  extui a10, a2, 0, 8 ; checksum
  add a11, a8, a9
  extui a12, a9, 8, 8
  add a11, a11, a12
  extui a11, a11, 0, 8
  beq a11, a10, .L_PKT_OK
  l32r a2, .LC_ERR_STR ; "Fatal interrupt caught in task queue"
  call8 log_write
  retw
.L_PKT_OK:
  movi a7, 161 ; 0xA1
  beq a8, a7, .L_PKT_PING
  movi a7, 178 ; 0xB2
  beq a8, a7, .L_PKT_DATA
  retw
.L_PKT_PING:
  retw
.L_PKT_DATA:
  retw`
            },
            {
              name: 'sensor_read_loop',
              address: hexAddr(0x0d00),
              size: 96,
              pseudo_c: `uint32_t sensor_read_loop() {
    // Read from digital sensor ADC registers
    volatile uint32_t *adc_data = (uint32_t *)0x60002104;
    volatile uint32_t *adc_ctrl = (uint32_t *)0x60002100;
    
    *adc_ctrl |= 1; // Trigger read conv
    while ((*adc_ctrl & 2) == 0) {
        // Wait for ADC EOC flag
    }
    
    uint32_t val = *adc_data & 0x00000FFF;
    *adc_ctrl &= ~1; // Reset trigger
    
    // Pack sensor frame: type=0xB2, length=4, value=val
    uint32_t packet = (0xB2 << 24) | (4 << 8) | (val & 0xFF);
    return packet;
}`,
              assembly: `; sensor_read_loop implementation
sensor_read_loop:
  entry a1, 32
  movi a8, 0x60002100
  l32i a9, a8, 0
  or a9, a9, 1
  s32i a9, a8, 0
.L_ADC_WAIT:
  l32i a9, a8, 0
  extui a9, a9, 1, 1
  beqz a9, .L_ADC_WAIT
  l32i a9, a8, 4 ; read adc_data
  extui a9, a9, 0, 12 ; val & 0xFFF
  l32i a7, a8, 0
  movi a10, -2
  and a7, a7, a10
  s32i a7, a8, 0 ; clear trigger
  movi a2, 0xB2
  slli a2, a2, 24
  movi a7, 4
  slli a7, a7, 8
  or a2, a2, a7
  extui a7, a9, 0, 8
  or a2, a2, a7
  retw`
            },
            {
              name: 'log_write',
              address: hexAddr(0x0f00),
              size: 48,
              pseudo_c: `void log_write(const char *msg) {
    if (msg == NULL) return;
    printf("[LOG] %s\\n", msg);
}`,
              assembly: `; log_write implementation
log_write:
  entry a1, 32
  beqz a2, .L_LOG_RET
  mov a3, a2
  l32r a2, .LC_LOG_STR ; "[LOG] %s\\n"
  call8 printf
.L_LOG_RET:
  retw`
            },
            {
              name: 'app_main',
              address: hexAddr(0x1200),
              size: 180,
              pseudo_c: `void app_main() {
    system_init();
    printf("Binino Handoff active\\n");
    
    if (wifi_connect_ap("Binino_AP", "12345678") == 0) {
        printf("WiFi Connection established successfully\\n");
        while (1) {
            uint32_t data = sensor_read_loop();
            process_packet(data);
            vTaskDelay(100);
        }
    } else {
        log_write("Fatal interrupt caught in task queue");
    }
}`,
              assembly: `; app_main implementation
app_main:
  entry a1, 32
  call8 system_init
  l32r a2, .LC_MAIN_STR ; "Binino Handoff active\\n"
  call8 printf
  l32r a2, .LC_SSID ; "Binino_AP"
  l32r a3, .LC_PASS ; "12345678"
  call8 wifi_connect_ap
  bnez a2, .L_MAIN_FAIL
  l32r a2, .LC_OK_STR ; "WiFi Connection established successfully\\n"
  call8 printf
.L_MAIN_LOOP:
  call8 sensor_read_loop
  call8 process_packet
  movi a2, 100
  call8 vTaskDelay
  j .L_MAIN_LOOP
.L_MAIN_FAIL:
  l32r a2, .LC_ERR_STR2 ; "Fatal interrupt caught in task queue"
  call8 log_write
  retw`
            }
          ],
          strings: [
            { address: hexAddr(0x1000), value: 'Device initialized in bootloader mode', encoding: 'ASCII' },
            { address: hexAddr(0x1040), value: 'Attempting WiFi connect to: %s', encoding: 'ASCII' },
            { address: hexAddr(0x1080), value: 'Binino_AP', encoding: 'ASCII' },
            { address: hexAddr(0x10c0), value: '12345678', encoding: 'ASCII' },
            { address: hexAddr(0x1100), value: 'Fatal interrupt caught in task queue', encoding: 'ASCII' },
            { address: hexAddr(0x1140), value: '[LOG] %s', encoding: 'ASCII' },
            { address: hexAddr(0x1180), value: 'Binino Handoff active', encoding: 'ASCII' },
            { address: hexAddr(0x11c0), value: 'WiFi Connection established successfully', encoding: 'ASCII' }
          ],
          symbols: [
            { address: hexAddr(0x0000), name: '_start', type: 'Code' },
            { address: hexAddr(0x0010), name: 'ROM_Vector_Table', type: 'Data' },
            { address: hexAddr(0x0100), name: 'system_init', type: 'Function' },
            { address: hexAddr(0x0500), name: 'wifi_connect_ap', type: 'Function' },
            { address: hexAddr(0x0900), name: 'process_packet', type: 'Function' },
            { address: hexAddr(0x0d00), name: 'sensor_read_loop', type: 'Function' },
            { address: hexAddr(0x0f00), name: 'log_write', type: 'Function' },
            { address: hexAddr(0x1200), name: 'app_main', type: 'Function' },
            { address: hexAddr(0x1500), name: 'esp_heap_alloc', type: 'Function' },
            { address: hexAddr(0x1600), name: 'vTaskDelay', type: 'Function' },
            { address: hexAddr(0x1700), name: 'sensor_isr', type: 'Function' }
          ]
        });
        
        appendLog('INFO', 'Handoff processing complete. Mock pseudo-C files compiled.');
      }, 8500);

      demoTimeoutRefs.current = [t1, t2, t3, t4, t5, t6, t7, t8];
      return;
    }

    // --- REAL WEB UPLOAD ---
    if (!flashBuffer || flashBuffer.length === 0) {
      const err = 'No binary data available to upload. Please connect to a device and extract first.';
      setErrorMessage(err);
      setUploadStatus('error');
      appendLog('ERROR', `Handoff failed: ${err}`);
      return;
    }

    setUploadStatus('uploading');
    setUploadProgress(0);
    appendLog('INFO', `Uploading firmware binary (${flashBuffer.length} bytes) to server...`);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    // Track transmission progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    // Handle completed upload response
    xhr.onload = () => {
      if (xhr.status === 201) {
        try {
          const resp = JSON.parse(xhr.responseText);
          setJobId(resp.job_id);
          setUploadStatus('queued');
          appendLog('INFO', `Upload complete. Job queued successfully. Job ID: ${resp.job_id}`);
          
          // Connect Server-Sent Events stream immediately
          connectSSE(resp.job_id);
        } catch (err) {
          logger_error(err);
          setUploadStatus('error');
          setErrorMessage('Malformed JSON response from server.');
          appendLog('ERROR', 'Upload parsed with errors: Invalid server response.');
        }
      } else {
        setUploadStatus('error');
        setErrorMessage(xhr.responseText || `HTTP Upload Error: ${xhr.status}`);
        appendLog('ERROR', `Upload failed with status ${xhr.status}: ${xhr.statusText}`);
      }
      xhrRef.current = null;
    };

    // Handle network disruptions
    xhr.onerror = () => {
      setUploadStatus('error');
      setErrorMessage('Network error occurred. Ensure Python FastAPI server is active on port 8000.');
      appendLog('ERROR', 'Failed to reach decompiler server at http://localhost:8000. Server offline?');
      xhrRef.current = null;
    };

    // Package payload data
    const formData = new FormData();
    const blob = new Blob([flashBuffer as BlobPart], { type: 'application/octet-stream' });
    formData.append('file', blob, `firmware_${selectedArch}.bin`);
    formData.append('arch', selectedArch);
    formData.append('flash_size', flashBuffer.length.toString());

    xhr.open('POST', 'http://localhost:8000/api/upload');
    xhr.send(formData);

  }, [flashBuffer, extractionStatus, selectedArch, appendLog, isDemoMode, connectSSE, resetHandoff]);

  // Private logger helper
  const logger_error = (err: any) => {
    console.error('JSON parsing exception:', err);
  };

  return {
    uploadStatus,
    uploadProgress,
    analysisProgress,
    analysisStage,
    jobId,
    result,
    errorMessage,
    sendToServer,
    cancelHandoff,
    resetHandoff,
  };
};

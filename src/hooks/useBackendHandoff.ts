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
        appendLog('ERROR', 'SSE connection lost. Decompiler progress listener disconnected.');
        setErrorMessage('Connection with progress stream was lost.');
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
        setResult({
          job_id: 'demo_job_mock',
          arch: selectedArch,
          functions: ['app_main', 'system_init', 'wifi_connect_ap', 'process_packet', 'sensor_read_loop', 'log_write'],
          strings: [
            '[SIMULATED — Ghidra not installed]',
            'WiFi Connection established successfully',
            'Binino Handoff active',
            'Device initialized in bootloader mode'
          ],
          symbols: ['_start', 'ROM_Vector_Table', 'esp_heap_alloc', 'vTaskDelay', 'sensor_isr'],
          entry_point: selectedArch === 'esp32' ? '0x40080000' : '0x08000000',
          raw_assembly_snippet: 'entry app_main:\n  entry a1, 32\n  l32r a8, wifi_config\n  call8 esp_wifi_init\n  retw.n',
          raw_c: `// [SIMULATED — Ghidra not installed]
// Reconstructed C code from ${selectedArch.toUpperCase()} backup image

#include <stdio.h>
#include <stdint.h>

void app_main() {
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
}`
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

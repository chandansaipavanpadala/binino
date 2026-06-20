import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Copy, Download, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { FileNode } from './FileTree';
import { getBackendUrl } from '../../utils/backend';

interface FileViewerProps {
  file: FileNode | null;
  content: string;
  loading: boolean;
  runtime: string;
  arch: string;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  file,
  content,
  loading,
  runtime,
  arch
}) => {
  const [explainStatus, setExplainStatus] = useState<'idle' | 'loading' | 'streaming' | 'done' | 'error'>('idle');
  const [streamedText, setStreamedText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const aiBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset AI explanation when active file changes
    setExplainStatus('idle');
    setStreamedText('');
    setErrorMessage(null);
    if (readerRef.current) {
      try { readerRef.current.cancel(); } catch (_) {}
      readerRef.current = null;
    }
  }, [file]);

  useEffect(() => {
    if (explainStatus === 'streaming') {
      aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamedText, explainStatus]);

  // Syntax highlighting logic for script files
  const highlightedLines = useMemo(() => {
    if (!content) return [];
    const lines = content.split('\n');
    const escapeHTML = (text: string): string =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const highlighted = lines.map((line) => {
      let index = 0;
      let result = '';

      let commentPattern = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/; // JS default
      const r = runtime.toLowerCase();
      if (r === 'micropython' || r === 'circuitpython') {
        commentPattern = /(#[^\n]*)/;
      } else if (r === 'nodemcu' || r === 'lua') {
        commentPattern = /(--[^\n]*)/;
      }

      const keywords = '\\b(import|from|def|class|function|local|var|let|const|if|else|elif|while|for|return|in|and|or|not|end|then|require|try|except|print|board|time|microcontroller|digitalio|analogio)\\b';
      const masterRegex = new RegExp(
        commentPattern.source + 
        '|("[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|\'[^\'\\\\]*(?:\\\\.[^\'\\\\]*)*\')|' + 
        keywords + '|\\b(0x[0-9a-fA-F]+|\\b\\d+)\\b', 
        'g'
      );

      let match;
      while ((match = masterRegex.exec(line)) !== null) {
        result += escapeHTML(line.substring(index, match.index));

        const [fullMatch, comment, str, keyword, num] = match;

        if (comment) {
          result += `<span style="color: #6A9955;">${escapeHTML(comment)}</span>`;
        } else if (str) {
          result += `<span style="color: #CE9178;">${escapeHTML(str)}</span>`;
        } else if (keyword) {
          result += `<span style="color: #569CD6;">${escapeHTML(keyword)}</span>`;
        } else if (num) {
          result += `<span style="color: #B5CEA8;">${escapeHTML(num)}</span>`;
        } else {
          result += escapeHTML(fullMatch);
        }

        index = masterRegex.lastIndex;
      }

      result += escapeHTML(line.substring(index));
      return result;
    });

    return highlighted;
  }, [content, runtime]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
  };

  const handleDownload = () => {
    if (!file || !content) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendToAI = async () => {
    if (!file || !content) return;

    setExplainStatus('loading');
    setStreamedText('');
    setErrorMessage(null);

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/explain-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          runtime,
          source_code: content,
          arch
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
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring(5).trim();
            try {
              const payload = JSON.parse(dataStr);
              if (payload.token) {
                setStreamedText((prev) => prev + payload.token);
              } else if (payload.message) {
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
      setErrorMessage(err.message || 'Connection with AI source explainer failed.');
      readerRef.current = null;
    }
  };



  return (
    <div 
      className="flex flex-col h-full bg-[#111111] border border-[var(--border-subtle)] rounded-lg min-h-0 overflow-hidden"
    >
      {/* Top File Action bar */}
      <div 
        className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[#111111] shrink-0"
      >
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
            {file ? file.name : 'No file selected'}
          </span>
          {file?.size !== undefined && (
            <span className="text-[10px] text-gray-500 font-mono">
              ({(file.size / 1024).toFixed(2)} KB)
            </span>
          )}
        </div>

        {file && !loading && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-[#222222] text-[#888888] hover:text-[#FFFFFF] transition-colors"
              title="Copy file contents"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDownload}
              className="p-1 rounded hover:bg-[#222222] text-[#888888] hover:text-[#FFFFFF] transition-colors"
              title="Download file locally"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleSendToAI}
              disabled={explainStatus === 'loading' || explainStatus === 'streaming'}
              className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--bg-base)'
              }}
            >
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>Explain script</span>
            </button>
          </div>
        )}
      </div>

      {/* Code Viewer Panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-2 select-none" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw className="h-6 w-6 animate-spin text-gray-600" />
            <span className="text-xs font-sans">Reading file content from serial link...</span>
          </div>
        ) : !file ? (
          <div className="flex-1 flex items-center justify-center text-xs select-none" style={{ color: 'var(--text-muted)' }}>
            Select a script file from the explorer list to read contents.
          </div>
        ) : (
          <div className="flex-1 overflow-auto relative bg-[#0F0F14] py-4 select-text">
            {highlightedLines.map((line, i) => (
              <div key={i + 1} className="group flex leading-5 min-w-fit font-mono text-[11px] hover:bg-[#1C1C24] transition-colors duration-75">
                {/* Gutter Line Number */}
                <span 
                  className="select-none text-right pr-3 pl-4 sticky left-0 z-10 w-12 shrink-0 bg-[#0F0F14] group-hover:bg-[#1C1C24] border-r select-none transition-colors duration-75"
                  style={{
                    color: 'var(--text-muted)',
                    borderColor: 'rgba(255, 255, 255, 0.04)',
                  }}
                >
                  {i + 1}
                </span>
                {/* Line Code */}
                <code 
                  className="pl-4 whitespace-pre selection:bg-[rgba(255,255,255,0.08)] selection:text-white"
                  dangerouslySetInnerHTML={{ __html: line || ' ' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Explanation Drawer / Bottom Section */}
      {explainStatus !== 'idle' && (
        <div 
          className="border-t border-[var(--border-subtle)] bg-[#141416] p-4 flex flex-col max-h-[200px] overflow-y-auto shrink-0 select-text font-sans text-xs leading-relaxed"
        >
          <div className="flex items-center space-x-2 mb-2 select-none">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
            <span className="font-semibold text-[var(--text-primary)]">AI Code Explanation</span>
          </div>
          {explainStatus === 'loading' && (
            <div className="text-[var(--text-muted)] italic flex items-center space-x-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500" />
              <span>Analyzing source scripts...</span>
            </div>
          )}
          {explainStatus === 'error' && (
            <div className="text-[var(--status-error)] flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
          {(explainStatus === 'streaming' || explainStatus === 'done') && (
            <div className="text-[#CCCCCC] whitespace-pre-wrap select-text selection:bg-[rgba(255,255,255,0.1)]">
              {streamedText}
            </div>
          )}
          <div ref={aiBottomRef} />
        </div>
      )}
    </div>
  );
};

export default FileViewer;

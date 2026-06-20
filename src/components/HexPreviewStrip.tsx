import React, { useState, useMemo, useEffect } from 'react';
import { ExtractionStatus } from '../hooks/useFlashExtractor';
import { ChevronDown, ChevronUp, Binary } from 'lucide-react';

interface HexPreviewStripProps {
  liveBuffer: Uint8Array;
  flashBuffer: Uint8Array | null;
  extractionStatus: ExtractionStatus;
}

export const HexPreviewStrip: React.FC<HexPreviewStripProps> = ({
  liveBuffer,
  flashBuffer,
  extractionStatus,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'live' | 'flash'>('live');

  const isExtracting = extractionStatus === 'syncing' || extractionStatus === 'reading';

  // Auto-switch to Flash mode and expand view when extraction starts
  useEffect(() => {
    if (isExtracting) {
      setPreviewMode('flash');
      setIsExpanded(true);
    }
  }, [isExtracting]);

  // Select active buffer based on mode selection
  const buffer = previewMode === 'live' ? liveBuffer : (flashBuffer || new Uint8Array(0));

  // Parse raw bytes into 16-byte hex + ASCII lines
  const hexRows = useMemo(() => {
    if (!isExpanded || buffer.length === 0) return [];
    
    const rows = [];
    const bytesPerRow = 16;
    // Cap rendering: 1KB for live stream, 4KB for flash dumps to keep DOM responsive
    const maxRenderBytes = previewMode === 'live' ? 1024 : 4096;
    const startOffset = Math.max(0, buffer.length - maxRenderBytes);
    const activeBuffer = buffer.slice(startOffset);

    for (let i = 0; i < activeBuffer.length; i += bytesPerRow) {
      const chunk = activeBuffer.slice(i, i + bytesPerRow);
      const rowOffset = startOffset + i;
      
      // Hex offsets
      const address = rowOffset.toString(16).toUpperCase().padStart(8, '0');
      
      // Hex Octets
      const octets: string[] = [];
      for (let j = 0; j < bytesPerRow; j++) {
        if (j < chunk.length) {
          octets.push(chunk[j].toString(16).toUpperCase().padStart(2, '0'));
        } else {
          octets.push('  ');
        }
      }

      // Format with gap after 8th octet for better readability (xxd / HxD style)
      const hexPart = `${octets.slice(0, 8).join(' ')}  ${octets.slice(8, 16).join(' ')}`;

      // ASCII Representation
      let asciiPart = '';
      for (let j = 0; j < chunk.length; j++) {
        const byte = chunk[j];
        // Only printable characters
        if (byte >= 32 && byte <= 126) {
          asciiPart += String.fromCharCode(byte);
        } else {
          asciiPart += '.';
        }
      }

      rows.push({
        address,
        hex: hexPart,
        ascii: asciiPart,
      });
    }
    return rows;
  }, [buffer, isExpanded, previewMode]);

  return (
    <div 
      className="rounded-xl overflow-hidden flex flex-col bg-[#111111]"
      style={{ border: '1px solid var(--border-subtle)' }}
    >
      {/* Toggle Bar */}
      <div
        onClick={() => {
          setIsExpanded(!isExpanded);
        }}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 transition-all duration-200 space-y-2 sm:space-y-0 hover:bg-[#1A1A1A] cursor-pointer"
        style={{ 
          backgroundColor: 'var(--bg-surface)',
          borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none'
        }}
        title="Toggle HEX Buffer Preview"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Binary className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          <span 
            className="text-xs font-semibold tracking-wider uppercase flex items-center" 
            style={{ color: 'var(--text-secondary)' }}
          >
            HEX Buffer Preview
            {isExtracting && (
              <span className="text-[9px] text-amber-500/70 lowercase font-mono font-normal normal-case italic ml-2 animate-pulse">
                (extracting firmware...)
              </span>
            )}
          </span>
          <span 
            className="text-[9px] font-mono px-2 py-0.5 rounded-full"
            style={{ 
              backgroundColor: 'var(--bg-inset)', 
              color: 'var(--accent)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            {buffer.length} bytes
          </span>

          {/* Segmented Control */}
          <div 
            className="flex p-0.5 rounded ml-0 sm:ml-2"
            style={{ 
              backgroundColor: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              opacity: isExtracting ? 0.5 : 1
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isExtracting) setPreviewMode('live');
              }}
              disabled={isExtracting}
              className="px-2 py-0.5 text-[9px] font-sans font-bold tracking-wider uppercase rounded transition-all duration-150 disabled:cursor-not-allowed"
              style={{
                backgroundColor: previewMode === 'live' ? 'var(--bg-elevated)' : 'transparent',
                color: previewMode === 'live' ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
            >
              Live
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isExtracting) setPreviewMode('flash');
              }}
              disabled={isExtracting || (!flashBuffer && extractionStatus !== 'done')}
              className="px-2 py-0.5 text-[9px] font-sans font-bold tracking-wider uppercase rounded transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: previewMode === 'flash' ? 'var(--bg-elevated)' : 'transparent',
                color: previewMode === 'flash' ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
              title={(!flashBuffer && extractionStatus !== 'done') ? 'Dump firmware first to unlock' : 'View full dump'}
            >
              Flash
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          {isExpanded && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {previewMode === 'live' ? 'Showing last 1KB' : 'Showing last 4KB'}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          )}
        </div>
      </div>

      {/* HEX Content Panel */}
      <div 
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isExpanded ? '256px' : '0px',
          opacity: isExpanded ? 1 : 0,
          pointerEvents: isExpanded ? 'auto' : 'none',
        }}
      >
        <div 
          className="p-4 h-64 overflow-y-auto font-mono text-[10px] leading-5 select-text"
          style={{ backgroundColor: 'var(--bg-inset)' }}
        >
          {isExtracting && buffer.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-1 font-sans animate-pulse" style={{ color: 'var(--text-muted)' }}>
              <span className="font-semibold text-amber-500">Syncing with bootloader...</span>
              <span className="text-[10px] font-mono">Establishing connection bridge...</span>
            </div>
          ) : buffer.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-1 font-sans" style={{ color: 'var(--text-muted)' }}>
              <span>HEX Buffer is empty.</span>
              <span className="text-[10px] font-mono">Waiting for binary stream...</span>
            </div>
          ) : (
            <div className="space-y-0.5 whitespace-pre">
              {/* Header labeling octets */}
              <div 
                className="select-none pb-1 mb-2 flex text-[9px] font-sans font-bold"
                style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                <span className="inline-block w-24 font-mono">OFFSET</span>
                <span className="inline-block flex-1 font-mono">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</span>
                <span className="inline-block w-32 pl-4 font-mono">ASCII PREVIEW</span>
              </div>
              
              {/* Rows */}
              {hexRows.map((row, index) => (
                <div key={index} className="flex hover:bg-[#1A1A1A] px-1 rounded transition-colors group">
                  {/* Address */}
                  <span className="select-none inline-block w-24" style={{ color: 'var(--text-muted)' }}>
                    {row.address}
                  </span>
                  
                  {/* Hex Octets */}
                  <span className="inline-block flex-1 group-hover:text-white transition-colors" style={{ color: 'var(--text-primary)' }}>
                    {row.hex}
                  </span>
                  
                  {/* ASCII Text */}
                  <span 
                    className="inline-block w-32 pl-4 transition-colors group-hover:text-white"
                    style={{ 
                      color: 'var(--text-secondary)',
                      borderLeft: '1px solid var(--border-subtle)' 
                    }}
                  >
                    {row.ascii}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HexPreviewStrip;

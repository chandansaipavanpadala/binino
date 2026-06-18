import React, { useState, useMemo } from 'react';
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
    <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg overflow-hidden flex flex-col mt-4">
      {/* Toggle Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 bg-[#0A0A0F] hover:bg-[#1E1E2E]/20 transition-colors border-b border-[#1E1E2E] space-y-2 sm:space-y-0"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Binary className="h-4 w-4 text-[#FFB347]" />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            HEX Buffer Preview
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1E1E2E] text-[#00FFC8] border border-[#1E1E2E]/50">
            {buffer.length} bytes accumulated
          </span>

          {/* Segmented Control */}
          <div className="flex bg-[#12121A] p-0.5 rounded border border-[#1E1E2D] ml-0 sm:ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewMode('live');
              }}
              className={`px-2 py-0.5 text-[9px] font-sans font-bold tracking-wider uppercase rounded transition-all ${
                previewMode === 'live'
                  ? 'bg-[#1E1E2E] text-[#00FFC8]'
                  : 'text-[#718096] hover:text-white'
              }`}
            >
              Live Stream
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewMode('flash');
              }}
              disabled={extractionStatus !== 'done'}
              className={`px-2 py-0.5 text-[9px] font-sans font-bold tracking-wider uppercase rounded transition-all ${
                previewMode === 'flash'
                  ? 'bg-[#1E1E2E] text-[#00FFC8]'
                  : 'text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white'
              }`}
              title={extractionStatus !== 'done' ? 'Dump firmware first to unlock' : 'View full dump'}
            >
              Flash Dump
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          {isExpanded && (
            <span className="text-[10px] text-slate-500 font-sans">
              {previewMode === 'live' ? 'Showing last 1KB' : 'Showing last 4KB'}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>


      {/* HEX Content Panel */}
      {isExpanded && (
        <div className="p-4 bg-[#0A0A0F] h-64 overflow-y-auto font-mono text-[11px] leading-5 select-text">
          {extractionStatus === 'syncing' || extractionStatus === 'reading' ? (
            <div className="space-y-2 py-2 animate-pulse select-none">
              <div className="text-slate-600 select-none pb-1 border-b border-[#1E1E2E] mb-2 flex">
                <span className="inline-block w-24">OFFSET</span>
                <span className="inline-block flex-1">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</span>
                <span className="inline-block w-32 pl-4">ASCII PREVIEW</span>
              </div>
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="h-3 w-16 bg-[#1E1E2D] rounded"></div>
                  <div className="h-3 flex-1 bg-[#1E1E2D] rounded"></div>
                  <div className="h-3 w-28 bg-[#1E1E2D] rounded"></div>
                </div>
              ))}
            </div>
          ) : buffer.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-1 font-sans">
              <span>HEX Buffer is empty.</span>
              <span className="text-[10px] font-mono text-slate-600">Waiting for binary stream...</span>
            </div>
          ) : (
            <div className="space-y-0.5 whitespace-pre">
              {/* Header labeling octets */}
              <div className="text-slate-600 select-none pb-1 border-b border-[#1E1E2E] mb-2 flex">
                <span className="inline-block w-24">OFFSET</span>
                <span className="inline-block flex-1">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</span>
                <span className="inline-block w-32 pl-4">ASCII PREVIEW</span>
              </div>
              
              {/* Rows */}
              {hexRows.map((row, index) => (
                <div key={index} className="flex hover:bg-[#1E1E2E]/30 px-1 rounded transition-colors group">
                  {/* Address */}
                  <span className="text-slate-500 font-bold select-none inline-block w-24">
                    {row.address}
                  </span>
                  
                  {/* Hex Octets */}
                  <span className="text-[#00FFC8] inline-block flex-1 group-hover:text-white transition-colors">
                    {row.hex}
                  </span>
                  
                  {/* ASCII Text */}
                  <span className="text-slate-400 inline-block w-32 pl-4 border-l border-[#1E1E2E]/50 group-hover:text-[#00FFC8] transition-colors">
                    {row.ascii}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

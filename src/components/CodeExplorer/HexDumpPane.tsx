import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AnalysisResult, FunctionRecord } from '../../types/analysis';

interface HexDumpPaneProps {
  result: AnalysisResult;
  flashBuffer: Uint8Array | null;
  activeFunction: FunctionRecord | null;
  onJumpToAddress: (address: string) => void;
}

export const HexDumpPane: React.FC<HexDumpPaneProps> = ({
  result,
  flashBuffer,
  activeFunction,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  // Address Jump Input States
  const [jumpInput, setJumpInput] = useState('');
  const [jumpError, setJumpError] = useState<string | null>(null);

  // Tooltip State
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    address: string;
    dec: number;
    bin: string;
    ascii: string;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    address: '',
    dec: 0,
    bin: '',
    ascii: '',
    visible: false,
  });

  // Calculate Base Virtual Address for mapping
  const baseAddr = useMemo(() => {
    const arch = result.arch?.toLowerCase() || '';
    if (arch === 'esp32') return 0x40080000;
    if (arch === 'esp8266') return 0x40000000;
    if (arch === 'avr') return 0x00000000;
    if (arch === 'arm' || arch === 'cortex') return 0x08000000;
    if (arch === 'riscv') return 0x00010000;
    return 0x0;
  }, [result.arch]);

  // Ensure we have a valid flash memory buffer (create fallback 64KB for simulated/demo runs)
  const activeBuffer = useMemo(() => {
    if (flashBuffer && flashBuffer.length > 0) return flashBuffer;
    
    // Fallback: Populate mock bytes for Demo Mode
    const dummy = new Uint8Array(65536);
    // Seed some pattern so it's interesting to look at
    for (let i = 0; i < dummy.length; i++) {
      if (i % 256 === 0) {
        // Mock entry headers
        dummy[i] = 0xE9;
        dummy[i + 1] = 0x03;
        dummy[i + 2] = 0x02;
        dummy[i + 3] = 0x40;
      } else {
        dummy[i] = Math.floor(Math.abs(Math.sin(i)) * 256);
      }
    }
    return dummy;
  }, [flashBuffer]);

  const bufferLength = activeBuffer.length;
  const totalRows = Math.ceil(bufferLength / 16);

  // PERF: row height is fixed at 22px. Change ROW_HEIGHT constant here for Phase 5 font adjustments.
  const ROW_HEIGHT = 22;
  const OVERSCAN = 10;
  const totalHeight = totalRows * ROW_HEIGHT;

  // Monitor element height to size virtual viewport
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // Convert input address string to byte offset
  const getOffsetFromAddress = (addrStr: string): number => {
    const clean = addrStr.trim().replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]+$/.test(clean)) {
      throw new Error('Invalid hexadecimal format.');
    }
    const val = parseInt(clean, 16);

    // If they typed a full virtual address
    if (val >= baseAddr && val < baseAddr + bufferLength) {
      return val - baseAddr;
    }
    // If they typed a raw offset
    if (val >= 0 && val < bufferLength) {
      return val;
    }
    throw new Error('Address out of bounds.');
  };

  const scrollToOffset = (offset: number) => {
    const row = Math.floor(offset / 16);
    const targetScrollTop = row * ROW_HEIGHT;
    if (containerRef.current) {
      // Center the target row slightly
      const viewportHeight = containerRef.current.clientHeight;
      const centeredScroll = targetScrollTop - viewportHeight / 3;
      containerRef.current.scrollTop = Math.max(0, Math.min(totalHeight, centeredScroll));
    }
  };

  // Jump Address Trigger
  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJumpError(null);
    try {
      const offset = getOffsetFromAddress(jumpInput);
      scrollToOffset(offset);
    } catch (err: any) {
      setJumpError(err.message || 'Error parsing address.');
    }
  };

  // Trigger scroll to active function when it updates
  useEffect(() => {
    if (activeFunction) {
      try {
        const offset = getOffsetFromAddress(activeFunction.address);
        scrollToOffset(offset);
      } catch (_) {}
    }
  }, [activeFunction]);

  // Compute active function bounds
  const funcBounds = useMemo(() => {
    if (!activeFunction) return null;
    try {
      const start = getOffsetFromAddress(activeFunction.address);
      const size = activeFunction.size || 0;
      return { start, end: start + size };
    } catch (_) {
      return null;
    }
  }, [activeFunction, baseAddr, bufferLength]);

  // Check if row has highlight
  const isRowInFunctionRange = (rowIdx: number): boolean => {
    if (!funcBounds) return false;
    const rowStart = rowIdx * 16;
    const rowEnd = rowStart + 16;
    return rowStart < funcBounds.end && rowEnd > funcBounds.start;
  };

  // Check if a specific byte is in function range
  const isByteInFunctionRange = (offset: number): boolean => {
    if (!funcBounds) return false;
    return offset >= funcBounds.start && offset < funcBounds.end;
  };

  // Byte hover tooltip handler
  const handleByteMouseEnter = (e: React.MouseEvent, offset: number, val: number) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const parentRect = containerRef.current?.getBoundingClientRect();

    if (!parentRect) return;

    // Position tooltip above the hovered byte
    const x = rect.left - parentRect.left + rect.width / 2;
    const y = rect.top - parentRect.top - 48 + containerRef.current!.scrollTop;

    setTooltip({
      x,
      y,
      address: `0x${(baseAddr + offset).toString(16).toUpperCase().padStart(8, '0')}`,
      dec: val,
      bin: val.toString(2).padStart(8, '0'),
      ascii: val >= 32 && val <= 126 ? String.fromCharCode(val) : 'N/A',
      visible: true,
    });
  };

  const handleByteMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // Compile slice of visible rows for custom virtual scrolling
  const visibleRows = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);

    const rows = [];
    for (let r = startIndex; r < endIndex; r++) {
      const startOffset = r * 16;
      const rowBytes = activeBuffer.slice(startOffset, startOffset + 16);
      rows.push({
        index: r,
        offset: startOffset,
        bytes: rowBytes,
        top: r * ROW_HEIGHT,
        isHighlighted: isRowInFunctionRange(r),
      });
    }
    return rows;
  }, [scrollTop, containerHeight, activeBuffer, funcBounds, totalRows]);

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] border-l border-[#1E1E2E] w-[30%] select-none min-w-[250px]">
      {/* Top toolbar with jump action */}
      <div className="p-3 border-b border-[#1E1E2E] flex flex-col gap-1.5 flex-shrink-0">
        <form onSubmit={handleJumpSubmit} className="flex gap-2 relative">
          <input
            type="text"
            value={jumpInput}
            onChange={(e) => {
              setJumpInput(e.target.value);
              setJumpError(null);
            }}
            placeholder="Jump to address (e.g. 0x40081200)..."
            className={`flex-1 h-8 px-2 bg-[#12121A] text-xs text-white rounded border focus:outline-none focus:border-[#00FFC8] transition-colors ${
              jumpError ? 'border-red-500 focus:border-red-500' : 'border-[#232334]'
            }`}
          />
          <button
            type="submit"
            className="h-8 px-3 bg-[#1A1A2E] hover:bg-[#1E1E38] border border-[#2D2D44] text-xs text-[#00FFC8] font-semibold rounded transition-colors"
          >
            Go
          </button>
        </form>
        {jumpError && (
          <span className="text-[10px] text-red-400 pl-1">{jumpError}</span>
        )}
      </div>

      {/* Hex grid labels */}
      <div className="px-4 py-1.5 bg-[#0D0D15] text-[9px] font-bold text-[#4A5568] tracking-widest font-mono flex border-b border-[#1E1E2E] flex-shrink-0">
        <div className="w-[72px]">ADDRESS</div>
        <div className="flex-1 flex justify-around pl-4 max-w-[290px]">
          <span>00</span><span>01</span><span>02</span><span>03</span><span>04</span><span>05</span><span>06</span><span>07</span>
          <span className="w-1"></span>
          <span>08</span><span>09</span><span>0a</span><span>0b</span><span>0c</span><span>0d</span><span>0e</span><span>0f</span>
        </div>
        <div className="w-20 text-center border-l border-[#1E1E2E] ml-2">ASCII</div>
      </div>

      {/* Scroller viewport */}
      <div
        className="flex-1 overflow-y-auto relative font-mono text-[11px]"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {/* Absolute Floating Byte Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-50 bg-[#12121B] border border-[#2B2B3C] rounded shadow-2xl p-2 text-[9px] text-[#A0AEC0] flex flex-col gap-0.5 select-text pointer-events-none"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-bold text-[#00FFC8]">{tooltip.address}</div>
            <div className="flex justify-between gap-4">
              <span>Dec: <strong className="text-white">{tooltip.dec}</strong></span>
              <span>Bin: <strong className="text-white">{tooltip.bin}</strong></span>
              <span>Char: <strong className="text-white">{tooltip.ascii}</strong></span>
            </div>
          </div>
        )}

        <div className="relative w-full" style={{ height: `${totalHeight}px` }}>
          {visibleRows.map((row) => {
            const rowAddrHex = (baseAddr + row.offset).toString(16).toUpperCase().padStart(8, '0');
            
            return (
              <div
                key={row.offset}
                className={`absolute left-0 right-0 h-[22px] flex items-center px-4 hover:bg-[#12121A]/30 border-l-2 transition-colors ${
                  row.isHighlighted
                    ? 'border-l-[#00FFC8] bg-[#00FFC8]/5'
                    : 'border-l-transparent'
                }`}
                style={{ top: `${row.top}px` }}
              >
                {/* Address block */}
                <div className="w-[72px] text-[#4FD1C5]/70 font-semibold select-none">
                  {rowAddrHex}
                </div>

                {/* Hex values blocks (16 octets) */}
                <div className="flex-1 flex justify-around pl-4 max-w-[290px]">
                  {Array.from({ length: 16 }).map((_, byteIdx) => {
                    const hasVal = byteIdx < row.bytes.length;
                    if (!hasVal) {
                      return <span key={byteIdx} className="w-5 text-center"></span>;
                    }
                    const val = row.bytes[byteIdx];
                    const valHex = val.toString(16).toUpperCase().padStart(2, '0');
                    const offset = row.offset + byteIdx;
                    const isHighlighted = isByteInFunctionRange(offset);

                    return (
                      <React.Fragment key={byteIdx}>
                        {byteIdx === 8 && <span className="w-1 select-none"></span>}
                        <span
                          className={`w-5 text-center cursor-help rounded transition-colors ${
                            isHighlighted
                              ? 'text-[#00FFC8] font-bold bg-[#00FFC8]/10'
                              : 'text-[#A0AEC0] hover:bg-[#00FFC8] hover:text-black'
                          }`}
                          onMouseEnter={(e) => handleByteMouseEnter(e, offset, val)}
                          onMouseLeave={handleByteMouseLeave}
                        >
                          {valHex}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* ASCII blocks */}
                <div className="w-20 text-center border-l border-[#1E1E2E]/60 ml-2 text-[#718096] select-none text-[10px]">
                  {Array.from(row.bytes).map((b, byteIdx) => {
                    const isHighlighted = isByteInFunctionRange(row.offset + byteIdx);
                    const isPrintable = b >= 32 && b <= 126;
                    const charStr = isPrintable ? String.fromCharCode(b) : '.';
                    return (
                      <span
                        key={byteIdx}
                        className={isHighlighted ? 'text-[#00FFC8]' : ''}
                      >
                        {charStr}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AnalysisResult, FunctionRecord } from '../../types/analysis';
import { MCU_REGISTRY } from '../../utils/mcuRegistry';

interface HexDumpPaneProps {
  result: AnalysisResult;
  flashBuffer: Uint8Array | null;
  activeFunction: FunctionRecord | null;
  onJumpToAddress: (address: string) => void;
  isDemoMode?: boolean;
}

export const HexDumpPane: React.FC<HexDumpPaneProps> = ({
  result,
  flashBuffer,
  activeFunction,
  isDemoMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  const mcuProfile = useMemo(() => {
    const archKey = result.arch?.toLowerCase() || '';
    return MCU_REGISTRY[archKey] || null;
  }, [result.arch]);

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

  // PERF: row height is measured dynamically to prevent token scale drift.
  const [rowHeight, setRowHeight] = useState(22);
  const rowRef = useRef<HTMLDivElement>(null);
  const OVERSCAN = 10;
  const totalHeight = totalRows * rowHeight;

  // Monitor element height to size virtual viewport and measure row height
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
      if (rowRef.current) {
        const height = rowRef.current.getBoundingClientRect().height;
        if (height > 0) {
          setRowHeight(height);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Measure row height on layout changes
  useEffect(() => {
    if (rowRef.current) {
      const height = rowRef.current.getBoundingClientRect().height;
      if (height > 0 && height !== rowHeight) {
        setRowHeight(height);
      }
    }
  }, [rowHeight]);

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

    // Subtract MCUProfile.flash_base from entered address
    const flashBase = mcuProfile ? mcuProfile.flash_base : 0;
    const offset = val - flashBase;

    if (offset < 0) {
      throw new Error('Address is negative relative to MCU flash base.');
    }
    if (offset < bufferLength) {
      return offset;
    }
    throw new Error('Address out of bounds.');
  };

  const scrollToOffset = (offset: number) => {
    const row = Math.floor(offset / 16);
    const targetScrollTop = row * rowHeight;
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
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
    const endIndex = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / rowHeight) + OVERSCAN);

    const rows = [];
    for (let r = startIndex; r < endIndex; r++) {
      const startOffset = r * 16;
      const rowBytes = activeBuffer.slice(startOffset, startOffset + 16);
      rows.push({
        index: r,
        offset: startOffset,
        bytes: rowBytes,
        top: r * rowHeight,
        isHighlighted: isRowInFunctionRange(r),
      });
    }
    return rows;
  }, [scrollTop, containerHeight, activeBuffer, funcBounds, totalRows, rowHeight]);

  if (!isDemoMode && !flashBuffer) {
    return (
      <div 
        className="flex flex-col h-full w-full items-center justify-center text-center p-6 space-y-3 select-text min-w-[250px]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-subtle)'
        }}
      >
        <svg className="w-8 h-8 text-slate-600 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Hex Dump Unavailable</span>
        <p className="text-[10px] max-w-[200px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Raw flash buffer unavailable. Re-run extraction to enable hex view.
        </p>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-full select-none min-w-[250px] w-full"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-subtle)',
      }}
    >
      {/* Top toolbar with jump action */}
      <div className="p-3 flex flex-col gap-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <form onSubmit={handleJumpSubmit} className="flex gap-2 relative">
          <input
            type="text"
            value={jumpInput}
            onChange={(e) => {
              setJumpInput(e.target.value);
              setJumpError(null);
            }}
            placeholder="Jump to address (e.g. 0x40081200)..."
            className="flex-1 h-8 px-2 text-xs text-[#F0F0F0] rounded focus:outline-none transition-colors"
            style={{
              backgroundColor: 'var(--bg-inset)',
              border: jumpError ? '1px solid var(--status-error)' : '1px solid var(--border-default)',
            }}
          />
          <button
            type="submit"
            className="h-8 px-3 text-xs font-semibold rounded transition-colors"
            style={{
              backgroundColor: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent)'
            }}
          >
            Go
          </button>
        </form>
        {jumpError && (
          <span className="text-[9px] pl-1" style={{ color: 'var(--status-error)' }}>{jumpError}</span>
        )}
      </div>

      {/* Hex grid labels */}
      <div 
        className="px-4 py-1.5 text-[8px] font-bold tracking-widest font-mono flex flex-shrink-0"
        style={{
          backgroundColor: 'var(--bg-inset)',
          borderBottom: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)'
        }}
      >
        <div className="w-[72px]">ADDRESS</div>
        <div className="flex-1 flex justify-around pl-4 max-w-[290px]">
          <span>00</span><span>01</span><span>02</span><span>03</span><span>04</span><span>05</span><span>06</span><span>07</span>
          <span className="w-1"></span>
          <span>08</span><span>09</span><span>0a</span><span>0b</span><span>0c</span><span>0d</span><span>0e</span><span>0f</span>
        </div>
        <div className="w-20 text-center ml-2" style={{ borderLeft: '1px solid var(--border-subtle)' }}>ASCII</div>
      </div>

      {/* Scroller viewport */}
      <div
        className="flex-1 overflow-y-auto relative font-mono text-[10px]"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {/* Absolute Floating Byte Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-50 rounded shadow-2xl p-2 text-[9px] flex flex-col gap-0.5 select-text pointer-events-none"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-secondary)'
            }}
          >
            <div className="font-bold" style={{ color: 'var(--accent)' }}>{tooltip.address}</div>
            <div className="flex justify-between gap-4">
              <span>Dec: <strong style={{ color: 'var(--text-primary)' }}>{tooltip.dec}</strong></span>
              <span>Bin: <strong style={{ color: 'var(--text-primary)' }}>{tooltip.bin}</strong></span>
              <span>Char: <strong style={{ color: 'var(--text-primary)' }}>{tooltip.ascii}</strong></span>
            </div>
          </div>
        )}

        <div className="relative w-full" style={{ height: `${totalHeight}px` }}>
          {visibleRows.map((row, idx) => {
            const rowAddrHex = (baseAddr + row.offset).toString(16).toUpperCase().padStart(8, '0');
            
            return (
              <div
                key={row.offset}
                ref={idx === 0 ? rowRef : undefined}
                className="absolute left-0 right-0 h-[22px] flex items-center px-4 hover:bg-[#1A1A1A] border-l-2 transition-colors"
                style={{ 
                  top: `${row.top}px`,
                  height: `${rowHeight}px`,
                  borderLeftColor: row.isHighlighted ? 'var(--accent)' : 'transparent',
                  backgroundColor: row.isHighlighted ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                }}
              >
                {/* Address block */}
                <div className="w-[72px] font-semibold select-none" style={{ color: 'var(--text-secondary)' }}>
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
                          className="w-5 text-center cursor-help rounded transition-colors"
                          style={{
                            color: isHighlighted ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: isHighlighted ? 'bold' : 'normal',
                            backgroundColor: isHighlighted ? 'rgba(255, 255, 255, 0.06)' : 'transparent'
                          }}
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
                <div 
                  className="w-20 text-center ml-2 select-none text-[9px]"
                  style={{ 
                    borderLeft: '1px solid var(--border-subtle)', 
                    color: 'var(--text-muted)' 
                  }}
                >
                  {Array.from(row.bytes).map((b, byteIdx) => {
                    const isHighlighted = isByteInFunctionRange(row.offset + byteIdx);
                    const isPrintable = b >= 32 && b <= 126;
                    const charStr = isPrintable ? String.fromCharCode(b) : '.';
                    return (
                      <span
                        key={byteIdx}
                        style={{ color: isHighlighted ? 'var(--accent)' : 'inherit' }}
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

export default HexDumpPane;

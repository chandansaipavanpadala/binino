import React from 'react';
import { Cpu } from 'lucide-react';

interface NavbarProps {
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isDemoMode, setIsDemoMode }) => {
  return (
    <header className="w-full bg-[#0A0A0F] border-b border-[#1E1E2E] py-4 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-[#1E1E2E] rounded-md border border-[#1E1E2E] flex items-center justify-center">
          <Cpu className="h-5 w-5 text-[#00FFC8]" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white font-sans">
          Binino<span className="text-[#00FFC8]">.</span>
        </span>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Demo Mode Toggle */}
        <button
          onClick={() => setIsDemoMode(!isDemoMode)}
          className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-medium rounded-md border transition-all ${
            isDemoMode
              ? 'border-[#00FFC8]/50 bg-[#00FFC8]/10 text-[#00FFC8]'
              : 'border-[#1E1E2E] bg-[#0A0A0F] text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Hardware Simulation Mode"
        >
          <span>Demo Mode: {isDemoMode ? 'ON' : 'OFF'}</span>
        </button>

        <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-[#1E1E2E] text-[#FFB347] border border-[#1E1E2E]">
          v0.1.0-alpha
        </span>
      </div>
    </header>
  );
};


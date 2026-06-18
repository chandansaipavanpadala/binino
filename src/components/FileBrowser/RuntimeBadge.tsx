import React from 'react';

interface RuntimeBadgeProps {
  runtime: string;
}

export const RuntimeBadge: React.FC<RuntimeBadgeProps> = ({ runtime }) => {
  const getStyle = () => {
    switch (runtime.toLowerCase()) {
      case 'micropython':
        return {
          bg: 'rgba(59, 130, 246, 0.1)',
          text: '#60A5FA',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          label: 'MicroPython'
        };
      case 'circuitpython':
        return {
          bg: 'rgba(168, 85, 247, 0.1)',
          text: '#C084FC',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          label: 'CircuitPython'
        };
      case 'nodemcu':
      case 'lua':
        return {
          bg: 'rgba(234, 179, 8, 0.1)',
          text: '#FACC15',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          label: 'Lua / NodeMCU'
        };
      case 'espruino':
        return {
          bg: 'rgba(249, 115, 22, 0.1)',
          text: '#FB923C',
          border: '1px solid rgba(249, 115, 22, 0.25)',
          label: 'Espruino (JS)'
        };
      default:
        return {
          bg: 'rgba(156, 163, 175, 0.1)',
          text: '#9CA3AF',
          border: '1px solid rgba(156, 163, 175, 0.25)',
          label: runtime
        };
    }
  };

  const style = getStyle();

  return (
    <span 
      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase select-none"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: style.border
      }}
    >
      {style.label}
    </span>
  );
};

export default RuntimeBadge;

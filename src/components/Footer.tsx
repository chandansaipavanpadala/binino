import React from 'react';
import { Github } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer
      className="w-full flex items-center justify-between px-6 select-none"
      style={{
        height: '52px',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        fontSize: '11px',
      }}
    >
      <div className="flex items-center space-x-3">
        <span className="font-bold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          BININO
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-mono"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          v1.0.0
        </span>
      </div>

      <span style={{ color: 'var(--text-muted)' }}>
        Built by Chandan Sai Pavan Padala
      </span>

      <a
        href="https://github.com/chandansaipavanpadala/binino"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center space-x-1.5 transition-opacity hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
      >
        <Github className="h-3.5 w-3.5" />
        <span>Star on GitHub</span>
      </a>
    </footer>
  );
};

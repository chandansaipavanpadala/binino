import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onClose?: () => void;
  onCrash?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level React Error Boundary wrapping the Code Explorer overlay.
 * Renders a full-screen diagnostic crash screen if a fatal layout error is caught.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Fatal CodeExplorer exception caught:', error, errorInfo);
    if (this.props.onCrash) {
      this.props.onCrash(error);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 font-sans select-none backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(8, 8, 8, 0.8)' }}
        >
          <div 
            className="max-w-md w-full rounded-lg p-6 flex flex-col space-y-4 shadow-2xl"
            style={{ 
              backgroundColor: 'var(--bg-surface)', 
              border: '1px solid var(--border-strong)' 
            }}
          >
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg uppercase tracking-widest" style={{ color: 'var(--status-error)' }}>Binino</span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--status-error)' }}>Crash Diagnostic</span>
            </div>
            
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              The Code Explorer encountered a critical runtime exception and had to terminate the layout process. Exception message logged below:
            </p>
            
            <div 
              className="p-3 rounded font-mono text-[10px] overflow-x-auto whitespace-pre-wrap max-h-32 select-text"
              style={{
                backgroundColor: 'var(--bg-inset)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--status-error)'
              }}
            >
              {this.state.error?.toString()}
            </div>
            
            <button
              onClick={() => {
                if (this.props.onClose) {
                  this.props.onClose();
                }
              }}
              className="h-9 w-full flex items-center justify-center text-xs font-semibold rounded transition-colors"
              style={{
                backgroundColor: 'var(--status-error)',
                color: 'var(--bg-base)'
              }}
            >
              Close Explorer
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface HexDumpProps {
  children: ReactNode;
}

interface HexDumpState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Inner inline React Error Boundary wrapping the HexDumpPane.
 * Keeps crashes isolated to the hex viewer column without unmounting the whole IDE.
 */
export class HexDumpErrorBoundary extends Component<HexDumpProps, HexDumpState> {
  public state: HexDumpState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): HexDumpState {
    return { hasError: true, error };
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border-subtle)'
          }}
        >
          <svg className="w-8 h-8 mb-2" style={{ color: 'var(--status-warn)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs font-bold mb-1" style={{ color: 'var(--status-warn)' }}>Hex View Failure</span>
          <span className="text-[10px] max-w-[180px] mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            An error occurred while virtualizing the memory flash dump view.
          </span>
          <pre 
            className="text-[9px] font-mono px-2 py-1 rounded overflow-x-auto max-w-full select-text"
            style={{
              backgroundColor: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--status-error)'
            }}
          >
            {this.state.error?.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

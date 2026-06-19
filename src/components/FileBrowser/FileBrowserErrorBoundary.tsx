import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FileBrowserErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FileBrowser exception caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-[var(--border-strong)] bg-[#111111] space-y-3 h-full select-none"
        >
          <AlertTriangle className="h-8 w-8 text-amber-500/80 animate-pulse" />
          <h3 className="text-sm font-semibold text-[var(--status-error)]">File Browser crashed</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-md leading-relaxed">
            Disconnect and reconnect to retry.
          </p>
          {this.state.error && (
            <pre 
              className="text-[9px] font-mono p-3 rounded overflow-x-auto max-w-full select-text text-[var(--status-error)]"
              style={{
                backgroundColor: 'var(--bg-inset)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

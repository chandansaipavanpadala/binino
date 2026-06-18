import React, { useState } from 'react';
import { Folder, FolderOpen, FileCode, RefreshCw, HardDrive, AlertCircle } from 'lucide-react';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
  isLocal?: boolean;
  handle?: any; // Directory or file system handle
}

interface FileTreeProps {
  files: FileNode[];
  selectedFilePath: string | null;
  onSelectFile: (file: FileNode) => void;
  onRefresh: () => void;
  onLocalFilesLoaded: (files: FileNode[]) => void;
  loading: boolean;
  detectedRuntime: string;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  selectedFilePath,
  onSelectFile,
  onRefresh,
  onLocalFilesLoaded,
  loading,
  detectedRuntime
}) => {
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({ '/': true });

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const formatSize = (bytes?: number): string => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleBrowseLocalDrive = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert('The Directory Picker API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
        return;
      }
      
      const dirHandle = await (window as any).showDirectoryPicker();
      const loadedNodes: FileNode[] = [];

      const traverse = async (handle: any, currentPath: string, parentArray: FileNode[]) => {
        for await (const entry of handle.values()) {
          const entryPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
          if (entry.kind === 'file') {
            const fileObj = await entry.getFile();
            // Skip hidden or dot files
            if (entry.name.startsWith('.')) continue;

            parentArray.push({
              name: entry.name,
              path: entryPath,
              type: 'file',
              size: fileObj.size,
              isLocal: true,
              handle: entry
            });
          } else if (entry.kind === 'directory') {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

            const dirNode: FileNode = {
              name: entry.name,
              path: entryPath,
              type: 'directory',
              isLocal: true,
              children: []
            };
            parentArray.push(dirNode);
            await traverse(entry, entryPath, dirNode.children || []);
          }
        }
      };

      await traverse(dirHandle, '/', loadedNodes);
      onLocalFilesLoaded(loadedNodes);

    } catch (err: any) {
      console.warn('Directory Picker cancelled or failed:', err);
    }
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isDir = node.type === 'directory';
    const isExpanded = expandedDirs[node.path];
    const isSelected = selectedFilePath === node.path;

    if (isDir) {
      return (
        <div key={node.path} className="flex flex-col">
          <button
            onClick={() => toggleDir(node.path)}
            className="flex items-center space-x-2 px-2 py-1 hover:bg-[#161616] text-left transition-colors duration-150 text-xs w-full select-none"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <span className="text-gray-500 font-mono text-[9px] w-3 text-center shrink-0">
              {isExpanded ? '▼' : '▶'}
            </span>
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
            <span className="truncate text-[#E0E0E0] font-medium">{node.name}</span>
          </button>
          {isExpanded && node.children && (
            <div className="flex flex-col">
              {node.children.length === 0 ? (
                <span 
                  className="py-1 text-[10px] text-gray-600 font-mono"
                  style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
                >
                  (empty)
                </span>
              ) : (
                node.children.map((child) => renderNode(child, depth + 1))
              )}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <button
          key={node.path}
          onClick={() => onSelectFile(node)}
          className={`flex items-center space-x-2 px-2 py-1.5 text-left transition-colors duration-150 text-xs w-full border-l-2 ${
            isSelected 
              ? 'bg-amber-500/5 border-amber-500 text-amber-500 font-semibold' 
              : 'border-transparent hover:bg-[#161616] text-[#CCCCCC]'
          }`}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
        >
          <FileCode className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-amber-500' : 'text-blue-400'}`} />
          <span className="truncate flex-1">{node.name}</span>
          {node.size !== undefined && (
            <span className="text-[9px] font-mono text-gray-500 select-none ml-2 shrink-0">
              {formatSize(node.size)}
            </span>
          )}
        </button>
      );
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-[#111111] border border-[var(--border-subtle)] rounded-lg min-h-0 overflow-hidden"
    >
      {/* Header bar */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] bg-[#111111]"
      >
        <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-secondary)] select-none">
          Filesystem Explorer
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 rounded hover:bg-[#222222] text-[#888888] hover:text-[#FFFFFF] transition-colors disabled:opacity-50"
          title="Refresh filesystem list"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Local picker trigger for CircuitPython */}
      {detectedRuntime === 'circuitpython' && (
        <div className="p-3 border-b border-[var(--border-subtle)]">
          <button
            onClick={handleBrowseLocalDrive}
            className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded text-[11px] font-semibold hover:bg-purple-500/20 transition-all duration-150"
          >
            <HardDrive className="h-3.5 w-3.5 shrink-0" />
            <span>Browse CIRCUITPY Drive</span>
          </button>
        </div>
      )}

      {/* Files Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center text-[var(--text-muted)] space-y-2 select-none">
            <AlertCircle className="h-5 w-5 text-gray-600" />
            <div className="text-[11px]">
              {loading 
                ? 'Loading device filesystem tree...' 
                : 'No files found. Hit refresh or mount a local CIRCUITPY drive.'
              }
            </div>
          </div>
        ) : (
          files.map((file) => renderNode(file))
        )}
      </div>
    </div>
  );
};

export default FileTree;

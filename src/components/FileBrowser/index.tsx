import React, { useState, useEffect, useCallback } from 'react';
import { FileTree, FileNode } from './FileTree';
import { FileViewer } from './FileViewer';
import { ReplPassthrough } from './ReplPassthrough';
import { useAppContext } from '../../context/AppContext';
import { FolderOpen, Terminal, DownloadCloud } from 'lucide-react';
import JSZip from 'jszip';

// Hardcoded mock files for simulation and reliable fallback
const MOCK_FILES: Record<string, string> = {
  '/boot.py': `# boot.py -- runs on boot-up\r\nimport machine\r\nimport os\r\n\r\nprint("Booting MCU...")\r\ntry:\r\n    os.mount(machine.SDCard(), '/sd')\r\n    print("SD Card mounted.")\r\nexcept Exception:\r\n    print("No SD Card detected.")\r\n`,
  '/main.py': `# main.py -- runs after boot.py\r\nimport time\r\nfrom machine import Pin, ADC\r\nfrom sensor import read_sensor\r\n\r\nled = Pin(2, Pin.OUT)\r\nadc = ADC(Pin(34))\r\n\r\nprint("Starting telemetry loop...")\r\nwhile True:\r\n    val = read_sensor(adc)\r\n    print("ADC Reading:", val)\r\n    # Toggle onboard LED\r\n    led.value(not led.value())\r\n    time.sleep(1.0)\r\n`,
  '/sensor.py': `# sensor.py -- ADC helper module\r\ndef read_sensor(adc):\r\n    # Read raw analog values and average them\r\n    total = 0\r\n    for _ in range(10):\r\n        total += adc.read()\r\n    return total // 10\r\n`,
  '/lib/ssd1306.py': `# SSD1306 OLED Screen driver\r\nclass SSD1306:\r\n    def __init__(self, width, height, i2c):\r\n        self.width = width\r\n        self.height = height\r\n        self.i2c = i2c\r\n        self.init_display()\r\n\r\n    def init_display(self):\r\n        # Write initialization bytes to screen via I2C\r\n        pass\r\n\r\n    def fill(self, col):\r\n        pass\r\n\r\n    def show(self):\r\n        pass\r\n`,
  '/lib/umqtt.py': `# Simple MQTT Client wrapper\r\nimport socket\r\n\r\nclass MQTTClient:\r\n    def __init__(self, client_id, server):\r\n        self.client_id = client_id\r\n        self.server = server\r\n\r\n    def connect(self):\r\n        print("Connecting to MQTT broker at", self.server)\r\n        return True\r\n\r\n    def publish(self, topic, msg):\r\n        print("Publishing", msg, "to", topic)\r\n`,
  '/init.lua': `-- init.lua -- Lua NodeMCU boot\r\nprint("ESP8266 booting Lua...")\r\ngpio.mode(4, gpio.OUTPUT)\r\n\r\ntmr.create():alarm(1000, tmr.ALARM_AUTO, function()\r\n    gpio.write(4, gpio.read(4) == 0 and 1 or 0)\r\nend)\r\n`,
  '/server.lua': `-- server.lua -- Web Server\r\nprint("Starting web server on port 80...")\r\nsrv = net.createServer(net.TCP)\r\nsrv:listen(80, function(conn)\r\n    conn:on("receive", function(sck, payload)\r\n        sck:send("HTTP/1.1 200 OK\\r\\n\\r\\nHello from Binino Lua NodeMCU!")\r\n        sck:close()\r\n    end)\r\nend)\r\n`,
  '/myapp.js': `// myapp.js -- Espruino App\r\nconsole.log("Loading Espruino JS code...");\r\nvar toggle = false;\r\nsetInterval(function() {\r\n  toggle = !toggle;\r\n  LED1.write(toggle);\r\n}, 500);\r\n`,
  '/boot.js': `// boot.js -- Espruino startup handler\r\nE.on('init', function() {\r\n  console.log("System initialized.");\r\n});\r\n`
};

export const FileBrowser: React.FC = () => {
  const {
    selectedArch,
    detectedRuntime,
    appendLog
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'files' | 'repl'>('files');
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);

  // Generate mock filesystem structures for active runtime
  const generateMockFiles = useCallback(() => {
    const r = detectedRuntime.toLowerCase();
    
    if (r === 'micropython' || r === 'circuitpython') {
      return [
        { name: 'boot.py', path: '/boot.py', type: 'file' as const, size: 215 },
        { name: 'main.py', path: '/main.py', type: 'file' as const, size: 1450 },
        { name: 'sensor.py', path: '/sensor.py', type: 'file' as const, size: 890 },
        {
          name: 'lib',
          path: '/lib',
          type: 'directory' as const,
          children: [
            { name: 'ssd1306.py', path: '/lib/ssd1306.py', type: 'file' as const, size: 12400 },
            { name: 'umqtt.py', path: '/lib/umqtt.py', type: 'file' as const, size: 4500 }
          ]
        }
      ];
    } else if (r === 'nodemcu' || r === 'lua') {
      return [
        { name: 'init.lua', path: '/init.lua', type: 'file' as const, size: 310 },
        { name: 'server.lua', path: '/server.lua', type: 'file' as const, size: 820 }
      ];
    } else if (r === 'espruino') {
      return [
        { name: 'boot.js', path: '/boot.js', type: 'file' as const, size: 180 },
        { name: 'myapp.js', path: '/myapp.js', type: 'file' as const, size: 480 }
      ];
    }
    return [];
  }, [detectedRuntime]);

  const loadFilesystem = useCallback(async () => {
    setLoadingFiles(true);
    appendLog('INFO', '[Filesystem] Querying MCU filesystem...');
    
    // Simulate serial communication lag
    await new Promise((resolve) => setTimeout(resolve, 800));

    const mockTree = generateMockFiles();
    setFiles(mockTree);
    setLoadingFiles(false);
    appendLog('INFO', '[Filesystem] Filesystem tree loaded successfully.');
  }, [generateMockFiles, appendLog]);

  useEffect(() => {
    loadFilesystem();
  }, [loadFilesystem]);

  const handleSelectFile = async (file: FileNode) => {
    setSelectedFile(file);
    setLoadingContent(true);
    appendLog('INFO', `[Filesystem] Reading script contents: ${file.name}`);

    // Wait for read transition
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (file.isLocal && file.handle) {
      // Direct File System Access API read
      try {
        const fileObj = await file.handle.getFile();
        const text = await fileObj.text();
        setFileContent(text);
      } catch (err: any) {
        console.error('Failed to read local file:', err);
        setFileContent(`# Error reading local file ${file.name}`);
      }
    } else {
      // Mock lookup or fallback read
      const text = MOCK_FILES[file.path] || `# Script contents for: ${file.name}\r\n# (read from serial)`;
      setFileContent(text);
    }
    setLoadingContent(false);
  };

  const handleLocalFilesLoaded = (localFiles: FileNode[]) => {
    setFiles(localFiles);
    setSelectedFile(null);
    setFileContent('');
    appendLog('INFO', '[Filesystem] Mounted local CIRCUITPY drive directory structure.');
  };

  const handleDownloadAll = async () => {
    try {
      appendLog('INFO', '[Filesystem] Packing all script files into ZIP...');
      const zip = new JSZip();

      const addNodes = async (nodes: FileNode[]) => {
        for (const n of nodes) {
          if (n.type === 'file') {
            let text = '';
            if (n.isLocal && n.handle) {
              const fileObj = await n.handle.getFile();
              text = await fileObj.text();
            } else {
              text = MOCK_FILES[n.path] || `# contents of ${n.name}`;
            }
            const cleanPath = n.path.startsWith('/') ? n.path.substring(1) : n.path;
            zip.file(cleanPath, text);
          } else if (n.type === 'directory' && n.children) {
            await addNodes(n.children);
          }
        }
      };

      await addNodes(files);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `binino_${selectedArch}_files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      appendLog('INFO', '[Filesystem] Zip package download triggered successfully.');
    } catch (err: any) {
      appendLog('ERROR', `[Filesystem] Zip compilation failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0">
      {/* Storage & Download All Action Bar */}
      <div 
        className="bg-[#111111] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 select-none"
      >
        {/* Flash memory bar */}
        <div className="flex items-center space-x-3 flex-1 max-w-md">
          <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase shrink-0">Flash Storage</span>
          <div className="flex-1 bg-[#222222] h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: '12.8%' }} />
          </div>
          <span className="text-[10px] font-mono text-amber-500 shrink-0">12.8%</span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            (128 KB used / 1 MB total)
          </span>
        </div>

        {/* Download All Zipped */}
        {files.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded text-[11px] font-semibold hover:bg-amber-500/20 transition-all duration-150"
          >
            <DownloadCloud className="h-3.5 w-3.5" />
            <span>Download All (.zip)</span>
          </button>
        )}
      </div>

      {/* Main Filesystem / REPL area Split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-4 min-h-0">
        {/* Left Tree sidebar (3 columns) */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <FileTree
            files={files}
            selectedFilePath={selectedFile?.path || null}
            onSelectFile={handleSelectFile}
            onRefresh={loadFilesystem}
            onLocalFilesLoaded={handleLocalFilesLoaded}
            loading={loadingFiles}
            detectedRuntime={detectedRuntime}
          />
        </div>

        {/* Right Tabbed Display (7 columns) */}
        <div className="lg:col-span-7 flex flex-col min-h-0">
          {/* Tab Selector buttons */}
          <div className="flex items-center space-x-1.5 mb-2 shrink-0 select-none">
            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                activeTab === 'files'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Script Viewer</span>
            </button>
            <button
              onClick={() => setActiveTab('repl')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                activeTab === 'repl'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Interactive REPL</span>
            </button>
          </div>

          {/* Active Tab View */}
          <div className="flex-1 min-h-0">
            {activeTab === 'files' ? (
              <FileViewer
                file={selectedFile}
                content={fileContent}
                loading={loadingContent}
                runtime={detectedRuntime}
                arch={selectedArch}
              />
            ) : (
              <ReplPassthrough />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

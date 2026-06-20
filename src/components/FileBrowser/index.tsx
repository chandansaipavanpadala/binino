import React, { useState, useEffect, useCallback } from 'react';
import { FileTree, FileNode } from './FileTree';
import { FileViewer } from './FileViewer';
import { ReplPassthrough } from './ReplPassthrough';
import { useAppContext } from '../../context/AppContext';
import { FolderOpen, Terminal, DownloadCloud, AlertTriangle } from 'lucide-react';
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

// Helper to query directory tree recursively over Web Serial CDC link
const queryFilesystemOverSerial = async (
  port: SerialPort,
  runtime: string,
  appendLog: (level: any, msg: string) => void
): Promise<FileNode[]> => {
  if (!port.writable || !port.readable) {
    throw new Error('Serial port streams are not available.');
  }
  const writer = port.writable.getWriter();
  const reader = port.readable.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const rName = runtime.toLowerCase();
  
  try {
    if (rName === 'micropython' || rName === 'circuitpython') {
      // 1. Enter Raw REPL (Ctrl+A)
      await writer.write(encoder.encode('\r\n\x01'));
      
      // Wait for Raw REPL prompt (500ms max)
      let buffer = '';
      let useRawRepl = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 500) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value);
          if (buffer.includes('raw REPL; ready') || buffer.includes('>')) {
            useRawRepl = true;
            break;
          }
        }
      }
      
      if (useRawRepl) {
        appendLog('INFO', '[Filesystem] MicroPython: raw REPL mode activated.');
        // 2. Write the JSON printer script
        const listScript = `
import os, json
def list_dir(d):
  r=[]
  try:
    for e in os.listdir(d):
      p=d+('/' if d!='/' else '')+e
      try:
        is_dir=(os.stat(p)[0]&0x4000)!=0
      except:
        is_dir=False
      if is_dir:
        r.append({'name':e,'path':p,'type':'directory','children':list_dir(p)})
      else:
        r.append({'name':e,'path':p,'type':'file','size':os.stat(p)[6] if len(os.stat(p))>6 else 0})
  except: pass
  return r
print('\\x00BININO_FS_START\\x00' + json.dumps(list_dir('/')) + '\\x00BININO_FS_END\\x00')
`;
        await writer.write(encoder.encode(listScript + '\x04')); // Ctrl+D to execute
      } else {
        appendLog('WARN', '[Filesystem] MicroPython: raw REPL not supported, falling back to interactive REPL.');
        // Exit raw REPL in case it was partially entered
        await writer.write(encoder.encode('\r\n\x02'));
        await writer.write(encoder.encode('\r\n\x03\r\n'));
        await new Promise(r => setTimeout(r, 100));

        // Send single-line script to standard REPL
        const singleLine = "import os, json; r=[]; [r.append({'name':e,'path':'/'+e,'type':'directory' if (os.stat('/'+e)[0]&0x4000) else 'file','size':os.stat('/'+e)[6]}) for e in os.listdir('/')]; print('\\x00BININO_FS_START\\x00' + json.dumps(r) + '\\x00BININO_FS_END\\x00')\r\n";
        await writer.write(encoder.encode(singleLine));
      }
      
      // 3. Read output
      buffer = '';
      const endMarker = '\x00BININO_FS_END\x00';
      const readStartTime = Date.now();
      while (Date.now() - readStartTime < 4000) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value);
          if (buffer.includes(endMarker)) {
            break;
          }
        }
      }
      
      if (useRawRepl) {
        // 4. Exit Raw REPL (Ctrl+B)
        await writer.write(encoder.encode('\x02'));
      }
      
      // Extract contents
      const startMarker = '\x00BININO_FS_START\x00';
      const startIdx = buffer.indexOf(startMarker);
      const endIdx = buffer.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = buffer.substring(startIdx + startMarker.length, endIdx).trim();
        return JSON.parse(jsonStr);
      }
    } 
    else if (rName === 'nodemcu' || rName === 'lua') {
      const luaScript = `
local t={} for k,v in pairs(file.list()) do t[#t+1]=k..":"..tostring(v) end print("\\x00BININO_FS_START\\x00\\n"..table.concat(t,"\\n").."\\n\\x00BININO_FS_END\\x00")
\r\n`;
      await writer.write(encoder.encode(luaScript));
      
      let buffer = '';
      const endMarker = '\x00BININO_FS_END\x00';
      const readStartTime = Date.now();
      while (Date.now() - readStartTime < 3000) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value);
          if (buffer.includes(endMarker)) {
            break;
          }
        }
      }
      
      const startMarker = '\x00BININO_FS_START\x00';
      const startIdx = buffer.indexOf(startMarker);
      const endIdx = buffer.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        const payloadStr = buffer.substring(startIdx + startMarker.length, endIdx).trim();
        const lines = payloadStr.split('\n');
        const nodes: FileNode[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx !== -1) {
            const name = trimmed.substring(0, colonIdx);
            const size = parseInt(trimmed.substring(colonIdx + 1), 10) || 0;
            nodes.push({
              name,
              path: '/' + name,
              type: 'file',
              size
            });
          } else {
            nodes.push({
              name: trimmed,
              path: '/' + trimmed,
              type: 'file',
              size: 0
            });
          }
        }
        return nodes;
      }
    }
    else if (rName === 'espruino') {
      const jsScript = `
(function(){
  var list = require("Storage").list();
  var files = [];
  if (list && list.length !== undefined) {
    for (var i=0; i<list.length; i++) {
      var entry = list[i];
      if (typeof entry === "string") {
        var sz = 0;
        try { sz = require("Storage").read(entry).length; } catch(_) {}
        files.push({name:entry, path:"/"+entry, type:"file", size:sz});
      } else if (entry && typeof entry === "object" && entry.name) {
        var sz = entry.size;
        if (sz === undefined) {
          try { sz = require("Storage").read(entry.name).length; } catch(_) {}
        }
        files.push({name:entry.name, path:"/"+entry.name, type:"file", size:sz || 0});
      }
    }
  }
  print("\\x00BININO_FS_START\\x00" + JSON.stringify(files) + "\\x00BININO_FS_END\\x00");
})()
\r\n`;
      await writer.write(encoder.encode(jsScript));
      
      let buffer = '';
      const endMarker = '\x00BININO_FS_END\x00';
      const readStartTime = Date.now();
      while (Date.now() - readStartTime < 3000) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value);
          if (buffer.includes(endMarker)) {
            break;
          }
        }
      }
      
      const startMarker = '\x00BININO_FS_START\x00';
      const startIdx = buffer.indexOf(startMarker);
      const endIdx = buffer.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = buffer.substring(startIdx + startMarker.length, endIdx).trim();
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          return parsed.map((entry: any) => {
            if (typeof entry === 'string') {
              return {
                name: entry,
                path: '/' + entry,
                type: 'file',
                size: 0
              };
            } else if (entry && typeof entry === 'object') {
              const name = entry.name || '';
              const size = entry.size !== undefined ? entry.size : 0;
              return {
                name,
                path: '/' + name,
                type: 'file',
                size
              };
            }
            return entry;
          });
        }
      }
    }
  } catch (err) {
    console.error('Error querying directory tree over serial:', err);
  } finally {
    try { writer.releaseLock(); } catch (_) {}
    try {
      await reader.cancel();
      reader.releaseLock();
    } catch (_) {}
  }
  return [];
};

// Helper to read file contents recursively/securely as Base64 over serial
const readFileOverSerial = async (
  port: SerialPort,
  runtime: string,
  filePath: string,
  appendLog: (level: any, msg: string) => void
): Promise<string> => {
  if (!port.writable || !port.readable) {
    throw new Error('Serial port streams are not available.');
  }
  const writer = port.writable.getWriter();
  const reader = port.readable.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const rName = runtime.toLowerCase();
  
  try {
    if (rName === 'micropython' || rName === 'circuitpython') {
      // 1. Enter Raw REPL (Ctrl+A)
      await writer.write(encoder.encode('\r\n\x01'));
      
      // Wait for Raw REPL prompt (500ms max)
      let buffer = '';
      let useRawRepl = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 500) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value);
          if (buffer.includes('raw REPL; ready') || buffer.includes('>')) {
            useRawRepl = true;
            break;
          }
        }
      }
      
      // Clean path backslashes and escape quotes
      const cleanPath = filePath.replace(/'/g, "\\'");
      
      if (useRawRepl) {
        appendLog('INFO', '[Filesystem] MicroPython: raw REPL mode activated.');
        // 2. Send python read file script (Base64 wrapper in chunks of 1024 bytes)
        const readScript = `
import ubinascii, sys
try:
  print('\\x00BININO_FILE_START\\x00')
  with open('${cleanPath}', 'rb') as f:
    while True:
      chunk = f.read(1024)
      if not chunk: break
      sys.stdout.write(ubinascii.b2a_base64(chunk).decode('ascii'))
  print('\\x00BININO_READ_END\\x00')
except Exception as e:
  print('\\x00BININO_FILE_START_ERR:\\x00' + str(e) + '\\x00BININO_FILE_END\\x00')
`;
        await writer.write(encoder.encode(readScript + '\x04')); // Ctrl+D to execute
      } else {
        appendLog('WARN', '[Filesystem] MicroPython: raw REPL not supported, falling back to interactive REPL.');
        // Exit raw REPL in case it was half-entered
        await writer.write(encoder.encode('\r\n\x02'));
        await writer.write(encoder.encode('\r\n\x03\r\n'));
        await new Promise(r => setTimeout(r, 100));

        // Send single-line script to standard REPL
        const singleLineRead = `import ubinascii, sys; f=open('${cleanPath}', 'rb'); print('\\x00BININO_FILE_START\\x00'); [sys.stdout.write(ubinascii.b2a_base64(chunk).decode('ascii')) for chunk in iter(lambda: f.read(1024), b'')]; print('\\x00BININO_READ_END\\x00'); f.close()\r\n`;
        await writer.write(encoder.encode(singleLineRead));
      }
      
      // 3. Read output
      buffer = '';
      const endMarker = buffer.includes('\x00BININO_READ_END\x00') ? '\x00BININO_READ_END\x00' : '\x00BININO_FILE_END\x00';
      const readStartTime = Date.now();
      while (Date.now() - readStartTime < 8000) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value);
          if (buffer.includes(endMarker) || buffer.includes('\x00BININO_FILE_END\x00')) {
            break;
          }
        }
      }
      
      if (useRawRepl) {
        // 4. Exit Raw REPL (Ctrl+B)
        await writer.write(encoder.encode('\x02'));
      }
      
      const startMarker = '\x00BININO_FILE_START\x00';
      const errMarker = '\x00BININO_FILE_START_ERR:\x00';
      const errEndMarker = '\x00BININO_FILE_END\x00';
      
      if (buffer.includes(errMarker)) {
        const startIdx = buffer.indexOf(errMarker);
        const endIdx = buffer.indexOf(errEndMarker);
        return `Error: ${buffer.substring(startIdx + errMarker.length, endIdx).trim()}`;
      }
      
      const startIdx = buffer.indexOf(startMarker);
      const endIdx = buffer.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        const base64Str = buffer.substring(startIdx + startMarker.length, endIdx).replace(/\s/g, '');
        try {
          const binaryString = window.atob(base64Str);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return new TextDecoder().decode(bytes);
        } catch (e) {
          return `Error: Failed to base64 decode script contents. ${e}`;
        }
      }
    }
    else if (rName === 'nodemcu' || rName === 'lua') {
      const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      const luaScript = `
(function()
  if not file.exists("${cleanPath}") then
    print("\\x00BININO_FILE_START_ERR:\\x00File not found\\x00BININO_FILE_END\\x00")
    return
  end
  file.open("${cleanPath}", "r")
  local data = file.read()
  file.close()
  if data then
    print("\\x00BININO_FILE_START\\x00" .. encoder.toBase64(data) .. "\\x00BININO_FILE_END\\x00")
  else
    print("\\x00BININO_FILE_START\\x00\\x00BININO_FILE_END\\x00")
  end
end)()
\r\n`;
      await writer.write(encoder.encode(luaScript));
      
      let buffer = '';
      const endMarker = '\x00BININO_FILE_END\x00';
      const readStartTime = Date.now();
      while (Date.now() - readStartTime < 3000) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value);
          if (buffer.includes(endMarker)) {
            break;
          }
        }
      }
      
      const startMarker = '\x00BININO_FILE_START\x00';
      const errMarker = '\x00BININO_FILE_START_ERR:\x00';
      if (buffer.includes(errMarker)) {
        return `Error: File ${cleanPath} not found on Lua flash.`;
      }
      
      const startIdx = buffer.indexOf(startMarker);
      const endIdx = buffer.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        const base64Str = buffer.substring(startIdx + startMarker.length, endIdx).trim();
        try {
          return window.atob(base64Str);
        } catch (e) {
          return `Error: Base64 decode failed. ${e}`;
        }
      }
    }
    else if (rName === 'espruino') {
      const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      const jsScript = `
(function() {
  var content = require("Storage").read("${cleanPath}");
  if (content === undefined) {
    print("\\x00BININO_FILE_START_ERR:\\x00File not found\\x00BININO_FILE_END\\x00");
  } else {
    print("\\x00BININO_FILE_START\\x00" + btoa(content) + "\\x00BININO_FILE_END\\x00");
  }
})()
\r\n`;
      await writer.write(encoder.encode(jsScript));
      
      let buffer = '';
      const endMarker = '\x00BININO_FILE_END\x00';
      const readStartTime = Date.now();
      while (Date.now() - readStartTime < 3000) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value);
          if (buffer.includes(endMarker)) {
            break;
          }
        }
      }
      
      const startMarker = '\x00BININO_FILE_START\x00';
      const errMarker = '\x00BININO_FILE_START_ERR:\x00';
      if (buffer.includes(errMarker)) {
        return `Error: File ${cleanPath} not found in Espruino Storage.`;
      }
      
      const startIdx = buffer.indexOf(startMarker);
      const endIdx = buffer.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        const base64Str = buffer.substring(startIdx + startMarker.length, endIdx).trim();
        try {
          return window.atob(base64Str);
        } catch (e) {
          return `Error: Base64 decode failed. ${e}`;
        }
      }
    }
  } catch (err) {
    console.error('Error reading file over serial:', err);
    return `Error reading file: ${err}`;
  } finally {
    try { writer.releaseLock(); } catch (_) {}
    try {
      await reader.cancel();
      reader.releaseLock();
    } catch (_) {}
  }
  return '';
};

export const FileBrowser: React.FC = () => {
  const {
    selectedArch,
    detectedRuntime,
    appendLog,
    connectionStatus,
    portRef,
    pauseReadLoop,
    resumeReadLoop,
    isDemoMode,
    fileList: files,
    setFileList: setFiles,
    selectedFile,
    setSelectedFile,
    selectedFileContent: fileContent,
    setSelectedFileContent: setFileContent
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'files' | 'repl'>('files');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);

  if (connectionStatus !== 'connected') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-[#111111] rounded-lg border border-[var(--border-subtle)] text-center space-y-3 min-h-[300px]">
        <AlertTriangle className="h-6 w-6 text-[var(--status-error)]" />
        <h3 className="text-sm font-semibold">File Browser Disconnected</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-sm">
          Please connect a device supporting interpreted runtimes to view filesystem.
        </p>
      </div>
    );
  }

  const generateMockFiles = useCallback(() => {
    const r = (detectedRuntime || 'compiled').toLowerCase();
    
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
    
    if (connectionStatus === 'connected' && !isDemoMode && portRef.current) {
      try {
        await pauseReadLoop();
        const mcuFiles = await queryFilesystemOverSerial(portRef.current, detectedRuntime || 'compiled', appendLog);
        setFiles(mcuFiles);
        appendLog('INFO', `[Filesystem] Real MCU files loaded successfully (found ${mcuFiles.length} root items).`);
      } catch (err: any) {
        appendLog('ERROR', `[Filesystem] Query failed: ${err.message || err}`);
        const mockTree = generateMockFiles();
        setFiles(mockTree);
      } finally {
        resumeReadLoop();
      }
    } else {
      // Simulate serial communication lag
      await new Promise((resolve) => setTimeout(resolve, 800));
      const mockTree = generateMockFiles();
      setFiles(mockTree);
      appendLog('INFO', '[Filesystem] Emulated files loaded (Demo/Offline Mode).');
    }
    
    setLoadingFiles(false);
  }, [connectionStatus, isDemoMode, portRef, detectedRuntime, generateMockFiles, appendLog, pauseReadLoop, resumeReadLoop]);

  useEffect(() => {
    loadFilesystem();
  }, [loadFilesystem]);

  const handleSelectFile = async (file: FileNode) => {
    setSelectedFile(file);
    setLoadingContent(true);
    appendLog('INFO', `[Filesystem] Reading script contents: ${file.name}`);

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
    } else if (connectionStatus === 'connected' && !isDemoMode && portRef.current) {
      try {
        await pauseReadLoop();
        const text = await readFileOverSerial(portRef.current, detectedRuntime || 'compiled', file.path, appendLog);
        setFileContent(text);
      } catch (err: any) {
        appendLog('ERROR', `[Filesystem] Read failed for ${file.name}: ${err.message || err}`);
        setFileContent(`# Error reading script from serial link.`);
      } finally {
        resumeReadLoop();
      }
    } else {
      // Wait for read transition
      await new Promise((resolve) => setTimeout(resolve, 400));
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
            } else if (connectionStatus === 'connected' && !isDemoMode && portRef.current) {
              text = await readFileOverSerial(portRef.current, detectedRuntime || 'compiled', n.path, appendLog);
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
            detectedRuntime={detectedRuntime || 'compiled'}
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
                content={fileContent || ''}
                loading={loadingContent}
                runtime={detectedRuntime || 'compiled'}
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

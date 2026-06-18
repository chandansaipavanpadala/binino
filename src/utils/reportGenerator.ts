import { AnalysisResult } from '../types/analysis';
import { highlightC } from '../components/CodeExplorer/SyntaxHighlighter';

/**
 * Utility to generate a standalone, self-contained, offline-compatible HTML report
 * containing function indices, decompiled pseudo-C code blocks, symbols, and strings.
 */
export const generateReportHtml = (result: AnalysisResult, filename: string): string => {
  const timestamp = new Date().toLocaleString();
  
  // Format the function listings
  const functionRows = (result.functions || []).map(f => `
    <tr>
      <td style="font-family: monospace; color: #00ffc8; width: 150px;">${f.address}</td>
      <td style="font-weight: bold; color: #e2e8f0;">${f.name}</td>
      <td style="color: #a0aec0; text-align: right;">${f.size ? f.size + ' B' : '—'}</td>
    </tr>
  `).join('');

  // Format the detailed decompiled code blocks
  const functionDetails = (result.functions || []).map(f => {
    const highlightedCode = highlightC(f.pseudo_c);
    return `
      <div class="card" style="margin-bottom: 25px;" id="func-${f.name}">
        <div class="card-header">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span class="badge">${f.address}</span>
              <strong style="font-size: 14px; margin-left: 8px; font-family: monospace; color: #ffffff;">${f.name}</strong>
            </div>
            <span style="font-size: 11px; color: #718096; font-family: monospace;">Size: ${f.size || 0} bytes</span>
          </div>
        </div>
        <div style="overflow-x: auto; background-color: #0f0f14;">
          <pre class="code-block"><code>${highlightedCode}</code></pre>
        </div>
      </div>
    `;
  }).join('');

  // Format strings
  const stringRows = (result.strings || []).map(s => `
    <tr>
      <td style="font-family: monospace; color: #00ffc8; width: 150px; white-space: nowrap;">${s.address}</td>
      <td style="color: #ce9178; font-family: monospace; word-break: break-all;">"${escapeHtml(s.value)}"</td>
      <td style="color: #718096; width: 100px; text-transform: uppercase; font-size: 10px; font-weight: bold;">${s.encoding || 'ASCII'}</td>
    </tr>
  `).join('');

  // Format symbols
  const symbolRows = (result.symbols || []).map(sym => `
    <tr>
      <td style="font-family: monospace; color: #00ffc8; width: 150px; white-space: nowrap;">${sym.address}</td>
      <td style="font-family: monospace; font-weight: bold; color: #e2e8f0; word-break: break-all;">${sym.name}</td>
      <td style="width: 100px;">
        <span class="badge-type">${sym.type || 'Unknown'}</span>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Binino Security Audit Report - ${filename}</title>
  <style>
    body {
      background-color: #0a0a0f;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 40px 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    header {
      border-bottom: 1px solid #1e1e2e;
      padding-bottom: 24px;
      margin-bottom: 35px;
    }
    h1 {
      color: #00ffc8;
      margin: 0 0 12px 0;
      font-size: 26px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      font-size: 13px;
      color: #a0aec0;
    }
    .meta-item strong {
      color: #ffffff;
      font-family: monospace;
    }
    h2 {
      color: #e2e8f0;
      font-size: 18px;
      font-weight: 700;
      border-bottom: 1px solid #1e1e2e;
      padding-bottom: 10px;
      margin-top: 45px;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: 13px;
      background-color: #0f0f14/40;
    }
    th, td {
      text-align: left;
      padding: 12px 16px;
      border-bottom: 1px solid #1e1e2e;
    }
    th {
      color: #718096;
      text-transform: uppercase;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      background-color: #0c0c12;
      border-top: 1px solid #1e1e2e;
    }
    tr:hover td {
      background-color: #161622/30;
    }
    .card {
      border: 1px solid #1e1e2e;
      border-radius: 8px;
      background-color: #0f0f14;
      overflow: hidden;
    }
    .card-header {
      background-color: #0b0b11;
      padding: 12px 18px;
      border-bottom: 1px solid #1e1e2e;
    }
    .badge {
      background-color: #162725;
      color: #00ffc8;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      font-weight: bold;
      border: 1px solid #1e433a;
    }
    .badge-type {
      background-color: #1a2333;
      color: #569cd6;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      font-weight: bold;
      border: 1px solid #23354c;
    }
    .code-block {
      margin: 0;
      padding: 18px;
      font-family: "JetBrains Mono", "Fira Code", monospace;
      font-size: 12px;
      line-height: 1.6;
      color: #e2e8f0;
      background-color: #0f0f14;
    }
    footer {
      margin-top: 80px;
      padding-top: 25px;
      border-top: 1px solid #1e1e2e;
      text-align: center;
      font-size: 11px;
      color: #4a5568;
      letter-spacing: 0.5px;
    }
    a {
      color: #00ffc8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Binino Firmware Analysis Report</h1>
      <div class="meta-grid">
        <div class="meta-item">Filename: <strong>${filename}</strong></div>
        <div class="meta-item">Architecture: <strong>${result.arch.toUpperCase()}</strong></div>
        <div class="meta-item">Analysis Date: <strong>${timestamp}</strong></div>
        <div class="meta-item">Job Token: <strong>${result.job_id}</strong></div>
      </div>
    </header>

    <h2>Function Index</h2>
    <table>
      <thead>
        <tr>
          <th>Address</th>
          <th>Name</th>
          <th style="text-align: right;">Size</th>
        </tr>
      </thead>
      <tbody>
        ${functionRows}
      </tbody>
    </table>

    <h2>Decompiled Function Sources</h2>
    <div style="margin-top: 20px;">
      ${functionDetails}
    </div>

    <h2>Extracted String Literals</h2>
    <table>
      <thead>
        <tr>
          <th>Address</th>
          <th>Literal Value</th>
          <th>Encoding</th>
        </tr>
      </thead>
      <tbody>
        ${stringRows || '<tr><td colspan="3" style="text-align: center; color: #4a5568; padding: 24px;">No string constants extracted.</td></tr>'}
      </tbody>
    </table>

    <h2>Global Symbol Table</h2>
    <table>
      <thead>
        <tr>
          <th>Address</th>
          <th>Symbol Name</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        ${symbolRows || '<tr><td colspan="3" style="text-align: center; color: #4a5568; padding: 24px;">No symbols resolved.</td></tr>'}
      </tbody>
    </table>

    <footer>
      Generated dynamically by <a href="https://github.com/chandansaipavanpadala/binino" target="_blank">Binino</a> · Browser-to-Hardware Reverse Engineering Toolkit.
    </footer>
  </div>
</body>
</html>`;
};

/**
 * Escapes special HTML tags inside code/strings to prevent breaks.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

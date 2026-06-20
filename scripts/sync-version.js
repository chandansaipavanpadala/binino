import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const readmePath = path.join(rootDir, 'README.md');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Read README.md
let readme = fs.readFileSync(readmePath, 'utf8');

// Replace standard version headers
// E.g., `Version 2.1.6` -> `Version 2.2.4`
readme = readme.replace(/`Version \d+\.\d+\.\d+`/g, `\`Version ${version}\``);

// E.g., (v2.1.6) -> (v2.2.4)
readme = readme.replace(/\(v\d+\.\d+\.\d+\)/g, `(v${version})`);

// E.g., BININO v2.1.6 -> BININO v2.2.4
readme = readme.replace(/BININO v\d+\.\d+\.\d+/g, `BININO v${version}`);

// Write back README.md
fs.writeFileSync(readmePath, readme, 'utf8');
console.log(`[Version Sync] Successfully synced version ${version} to README.md`);

// Sync server/main.py
const mainPyPath = path.join(rootDir, 'server', 'main.py');
if (fs.existsSync(mainPyPath)) {
  let mainPy = fs.readFileSync(mainPyPath, 'utf8');
  mainPy = mainPy.replace(/version="[0-9.]+"/g, `version="${version}"`);
  mainPy = mainPy.replace(/"version": "[0-9.]+"/g, `"version": "${version}"`);
  fs.writeFileSync(mainPyPath, mainPy, 'utf8');
  console.log(`[Version Sync] Successfully synced version ${version} to server/main.py`);
}

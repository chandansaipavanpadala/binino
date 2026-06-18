import React from 'react';

/**
 * Escapes HTML characters to prevent XSS and rendering breakages.
 */
const escapeHTML = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Parses C pseudo-code and returns syntax-highlighted HTML.
 */
export function highlightC(code: string): string {
  if (!code) return '';
  const lines = code.split('\n');

  const highlightedLines = lines.map((line) => {
    let index = 0;
    let result = '';

    // Capture groups:
    // 1. Comments (single & multi-line)
    // 2. Strings (double & single quote)
    // 3. Types (uint8_t, uint16_t, etc.)
    // 4. Keywords (void, int, char, if, for, etc.)
    // 5. Function calls (identifier followed by '(')
    // 6. Numbers (hex & decimal)
    const masterRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')|\b(uint8_t|uint16_t|uint32_t|bool|size_t)\b|\b(void|int|char|unsigned|long|if|else|while|for|return|switch|case|break)\b|\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()|\b(0x[0-9a-fA-F]+|\b\d+)\b/g;

    let match;
    while ((match = masterRegex.exec(line)) !== null) {
      // Add text before match
      result += escapeHTML(line.substring(index, match.index));

      const [
        fullMatch,
        comment,
        str,
        type,
        keyword,
        funcCall,
        num
      ] = match;

      if (comment) {
        result += `<span style="color: #6A9955;">${escapeHTML(comment)}</span>`;
      } else if (str) {
        result += `<span style="color: #CE9178;">${escapeHTML(str)}</span>`;
      } else if (type) {
        result += `<span style="color: #4EC9B0;">${escapeHTML(type)}</span>`;
      } else if (keyword) {
        result += `<span style="color: #569CD6;">${escapeHTML(keyword)}</span>`;
      } else if (funcCall) {
        result += `<span style="color: #DCDCAA;">${escapeHTML(funcCall)}</span>`;
      } else if (num) {
        result += `<span style="color: #B5CEA8;">${escapeHTML(num)}</span>`;
      } else {
        result += escapeHTML(fullMatch);
      }

      index = masterRegex.lastIndex;
    }

    result += escapeHTML(line.substring(index));
    return result;
  });

  return highlightedLines.join('\n');
}

/**
 * Parses assembly instruction snippets and returns syntax-highlighted HTML.
 */
export function highlightAsm(code: string): string {
  if (!code) return '';
  const lines = code.split('\n');

  const highlightedLines = lines.map((line) => {
    // If the entire line is a comment, highlight it green and exit early
    const commentMatch = line.match(/^(\s*)(;[^\n]*)$/);
    if (commentMatch) {
      return `${commentMatch[1]}<span style="color: #6A9955;">${escapeHTML(commentMatch[2])}</span>`;
    }

    // Split off any trailing comments
    const parts = line.split(/(;[^\n]*)$/);
    const mainPart = parts[0];
    const trailingComment = parts[1] || '';

    let prefix = '';
    let instructionPart = mainPart;

    // Detect labels like 'app_main:' or '00000000 <main>:'
    const labelMatch = mainPart.match(/^(\s*)([a-zA-Z0-9_\.<>]+:)/);
    if (labelMatch) {
      prefix = `${labelMatch[1]}<span style="color: #718096;">${escapeHTML(labelMatch[2])}</span>`;
      instructionPart = mainPart.substring(labelMatch[0].length);
    }

    // Detect the first word (mnemonic instruction)
    const mnemonicMatch = instructionPart.match(/^(\s*)([a-zA-Z\.]+)/);
    let mnemonicPrefix = '';
    let restPart = instructionPart;

    if (mnemonicMatch) {
      mnemonicPrefix = `${mnemonicMatch[1]}<span style="color: #00FFC8; font-weight: 500;">${escapeHTML(mnemonicMatch[2])}</span>`;
      restPart = instructionPart.substring(mnemonicMatch[0].length);
    }

    // Parse registers and hex/decimal numbers in the remaining operands
    let index = 0;
    let restHighlighted = '';
    const asmRegex = /\b([ar](?:[0-9]|1[0-5])|sp|lr|pc)\b|\b(0x[0-9a-fA-F]+|\d+)\b/gi;
    let match;

    while ((match = asmRegex.exec(restPart)) !== null) {
      restHighlighted += escapeHTML(restPart.substring(index, match.index));
      const [fullMatch, reg, num] = match;

      if (reg) {
        // Registers (a0-a15, r0-r15, sp, lr, pc) in Amber
        restHighlighted += `<span style="color: #FFB638;">${escapeHTML(fullMatch)}</span>`;
      } else if (num) {
        // Hex immediates & numbers in number highlight color
        restHighlighted += `<span style="color: #B5CEA8;">${escapeHTML(fullMatch)}</span>`;
      }
      index = asmRegex.lastIndex;
    }
    restHighlighted += escapeHTML(restPart.substring(index));

    let lineResult = prefix + mnemonicPrefix + restHighlighted;
    if (trailingComment) {
      lineResult += `<span style="color: #6A9955;">${escapeHTML(trailingComment)}</span>`;
    }
    return lineResult;
  });

  return highlightedLines.join('\n');
}

interface SyntaxHighlighterProps {
  code: string;
  language: 'c' | 'asm';
  wordWrap: boolean;
}

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({ code, language, wordWrap }) => {
  const highlightedHtml = React.useMemo(() => {
    return language === 'c' ? highlightC(code) : highlightAsm(code);
  }, [code, language]);

  return (
    <pre
      className={`font-mono text-xs leading-5 p-4 overflow-auto bg-[#0F0F14] select-text h-full ${
        wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
      }`}
      style={{ margin: 0, outline: 'none' }}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  );
};

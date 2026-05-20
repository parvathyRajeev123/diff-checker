import { Button, Label } from 'react-aria-components';
import React, { useCallback, useRef, useState } from 'react';

type ChangeType =
  | 'text_change'
  | 'bold_change'
  | 'italic_change'
  | 'underline_change'
  | 'strikethrough_change'
  | 'spacing_change'
  | 'line_break_change'
  | 'other_formatting_change';

interface WordSegment {
  text: string;
  html: string;
  highlighted: boolean;
  changeType?: ChangeType;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'modified' | 'line_break_change';
  text: string;
  html: string;
  lineNumber: number | null;
  wordSegments?: WordSegment[];
}

interface DiffExplanation {
  line: number;
  description: string;
  type: 'text_change' | 'formatting_change' | 'line_added' | 'line_removed';
}

interface DiffResult {
  left: DiffLine[];
  right: DiffLine[];
  explanations: DiffExplanation[];
}

interface HtmlLine {
  text: string;
  html: string;
}

interface HtmlToken {
  text: string;
  html: string;
}

const ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'sub',
  'sup',
]);

const SKIP_TAGS = new Set([
  'style',
  'script',
  'head',
  'meta',
  'link',
  'title',
  'html',
  'body',
  'colgroup',
  'col',
  'o:p',
]);

const rtfToHtml = (rtf: string): string => {
  interface FmtState {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
  }
  const defaultFmt = (): FmtState => ({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
  });

  const segments: { text: string; fmt: FmtState }[] = [];
  let cur = '';
  let fmt = defaultFmt();
  const stack: FmtState[] = [];
  let i = 0;
  let skipGroup = false;
  let skipDepth = 0;
  let depth = 0;

  const flush = () => {
    if (cur) {
      segments.push({ text: cur, fmt: { ...fmt } });
      cur = '';
    }
  };

  while (i < rtf.length) {
    const ch = rtf[i];

    if (ch === '{') {
      depth++;
      stack.push({ ...fmt });
      const ahead = rtf.substring(i + 1, i + 20);
      if (
        !skipGroup &&
        /^\\(fonttbl|colortbl|stylesheet|info|pict|header|footer)\b/.test(ahead)
      ) {
        skipGroup = true;
        skipDepth = depth;
      }
      i++;
      continue;
    }

    if (ch === '}') {
      if (skipGroup && depth === skipDepth) {
        skipGroup = false;
      }
      flush();
      if (stack.length > 0) {
        fmt = stack.pop()!;
      }
      depth--;
      i++;
      continue;
    }

    if (skipGroup) {
      i++;
      continue;
    }

    if (ch === '\\') {
      i++;
      if (i >= rtf.length) break;

      if (rtf[i] === '~') {
        cur += '\u00A0';
        i++;
        continue;
      }
      if (rtf[i] === '\n' || rtf[i] === '\r') {
        i++;
        continue;
      }
      if (rtf[i] === '{' || rtf[i] === '}' || rtf[i] === '\\') {
        cur += rtf[i];
        i++;
        continue;
      }
      if (rtf[i] === "'") {
        const hex = rtf.substring(i + 1, i + 3);
        const byteVal = parseInt(hex, 16);
        if (!isNaN(byteVal)) {
          // Windows-1252 bytes 0x80-0x9F differ from Unicode codepoints
          const W: Record<number, number> = {
            0x91: 0x2018, 0x92: 0x2019, // ' '
            0x93: 0x201C, 0x94: 0x201D, // " "
            0x96: 0x2013, 0x97: 0x2014, // – —
            0x85: 0x2026, 0x80: 0x20AC, // … €
            0x82: 0x201A, 0x84: 0x201E, // ‚ „
          };
          cur += String.fromCharCode(W[byteVal] ?? byteVal);
        }
        i += 3;
        continue;
      }

      let word = '';
      while (i < rtf.length && /[a-zA-Z]/.test(rtf[i])) {
        word += rtf[i];
        i++;
      }

      let param = '';
      if (i < rtf.length && (rtf[i] === '-' || /[0-9]/.test(rtf[i]))) {
        if (rtf[i] === '-') {
          param += '-';
          i++;
        }
        while (i < rtf.length && /[0-9]/.test(rtf[i])) {
          param += rtf[i];
          i++;
        }
      }

      if (i < rtf.length && rtf[i] === ' ') {
        i++;
      }

      const pNum = param ? parseInt(param) : null;
      if (word === 'u' && pNum !== null) {
        let code = pNum;
        if (code < 0) code = 65536 + code;
        cur += String.fromCodePoint(code);
        // Skip the ANSI fallback character(s) after \uN
        if (i < rtf.length) {
          if (rtf[i] === '\\' && i + 1 < rtf.length && rtf[i + 1] === "'") {
            i += 4; // skip \'xx (backslash + apostrophe + 2 hex digits)
          } else {
            i++; // skip single fallback char (usually '?')
          }
        }
        continue;
      }

      flush();
      switch (word) {
        case 'b':
          fmt.bold = pNum !== 0;
          break;
        case 'i':
          fmt.italic = pNum !== 0;
          break;
        case 'ul':
          fmt.underline = pNum !== 0;
          break;
        case 'ulnone':
          fmt.underline = false;
          break;
        case 'strike':
          fmt.strike = pNum !== 0;
          break;
        case 'par':
        case 'line':
          cur += '\n';
          break;
        case 'ldblquote':
          cur += '\u201C';
          break;
        case 'rdblquote':
          cur += '\u201D';
          break;
        case 'lquote':
          cur += '\u2018';
          break;
        case 'rquote':
          cur += '\u2019';
          break;
        case 'emdash':
          cur += '\u2014';
          break;
        case 'endash':
          cur += '\u2013';
          break;
        case 'bullet':
          cur += '\u2022';
          break;
        case 'tab':
          cur += '\t';
          break;
      }
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    cur += String.fromCodePoint(ch.codePointAt(0)!);
    i++;
  }

  flush();

  const merged: typeof segments = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.fmt.bold === seg.fmt.bold &&
      last.fmt.italic === seg.fmt.italic &&
      last.fmt.underline === seg.fmt.underline &&
      last.fmt.strike === seg.fmt.strike
    ) {
      last.text += seg.text;
    } else {
      merged.push({ text: seg.text, fmt: { ...seg.fmt } });
    }
  }

  let html = '';
  for (const seg of merged) {
    if (!seg.text) continue;
    let t = seg.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    if (seg.fmt.bold) t = `<b>${t}</b>`;
    if (seg.fmt.italic) t = `<i>${t}</i>`;
    if (seg.fmt.underline) t = `<u>${t}</u>`;
    if (seg.fmt.strike) t = `<s>${t}</s>`;

    html += t;
  }

  return html.trim();
};

const sanitizeHtml = (html: string): string => {
  // Extract class-based CSS rules before stripping (Excel uses <style> blocks)
  const classStyles: Record<string, Record<string, string>> = {};
  const styleBlockRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sbMatch: RegExpExecArray | null;
  while ((sbMatch = styleBlockRe.exec(html)) !== null) {
    const css = sbMatch[1].replace(/<!--/g, '').replace(/-->/g, '');
    const ruleRe = /\.([a-zA-Z_][\w]*)\s*\{([^}]*)\}/g;
    let rMatch: RegExpExecArray | null;
    while ((rMatch = ruleRe.exec(css)) !== null) {
      const cls = rMatch[1];
      const props: Record<string, string> = {};
      rMatch[2].split(';').forEach((decl) => {
        const idx = decl.indexOf(':');
        if (idx > 0) {
          const prop = decl.substring(0, idx).trim();
          const val = decl.substring(idx + 1).trim();
          if (prop && val) props[prop] = val;
        }
      });
      classStyles[cls] = { ...classStyles[cls], ...props };
    }
  }

  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');

  const tmp = document.createElement('div');
  tmp.innerHTML = stripped;

  // Apply extracted class styles as inline styles so cleanNode can detect them
  if (Object.keys(classStyles).length > 0) {
    tmp.querySelectorAll('*').forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.classList.forEach((cls) => {
        const rules = classStyles[cls];
        if (rules) {
          Object.entries(rules).forEach(([prop, val]) => {
            htmlEl.style.setProperty(prop, val);
          });
        }
      });
    });
  }

  const cleanNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      return '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (SKIP_TAGS.has(tag)) return '';

    let childHtml = '';
    for (let c = 0; c < el.childNodes.length; c++) {
      childHtml += cleanNode(el.childNodes[c]);
    }

    if (tag === 'br') return '\x01';
    if (ALLOWED_TAGS.has(tag)) {
      return `<${tag}>${childHtml}</${tag}>`;
    }
    if (tag === 'p' || tag === 'div') {
      return '\x01' + childHtml;
    }

    // Convert inline styles (from Sticky Notes, Excel, etc.) to HTML tags
    const style = el.style;
    let wrapped = childHtml;
    if (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700) {
      wrapped = `<b>${wrapped}</b>`;
    }
    if (style.fontStyle === 'italic') {
      wrapped = `<i>${wrapped}</i>`;
    }
    if (style.textDecoration?.includes('underline') || style.textDecorationLine?.includes('underline')) {
      wrapped = `<u>${wrapped}</u>`;
    }
    if (style.textDecoration?.includes('line-through') || style.textDecorationLine?.includes('line-through')) {
      wrapped = `<s>${wrapped}</s>`;
    }
    return wrapped;
  };

  let result = '';
  for (let c = 0; c < tmp.childNodes.length; c++) {
    result += cleanNode(tmp.childNodes[c]);
  }
  result = result
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]{2,}/g, (match) => {
      let out = '';
      for (let i = 0; i < match.length; i++) {
        out += i % 2 === 0 ? '\u00A0' : ' ';
      }
      return out;
    })
    .trim();
  // Collapse block markers with only whitespace between them into double <br> (empty line)
  // but keep single block markers as single <br>
  while (result.includes('\x01 \x01')) {
    result = result.split('\x01 \x01').join('\x01\x01');
  }
  if (result.startsWith('\x01')) result = result.slice(1).trimStart();
  if (result.endsWith('\x01')) result = result.slice(0, -1).trimEnd();
  result = result.split('\x01').join('<br>');
  return result;
};

const stripHtml = (html: string): string => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? '';
};

const LINE_SPLIT_MARKER = '\x00LINE\x00';

const htmlToLines = (html: string): HtmlLine[] => {
  // Pre-process: convert empty block elements (<div><br></div>, <p><br></p>,
  // empty <div></div>) into a single LINE_SPLIT_MARKER each, BEFORE the
  // general replacements.  This prevents one blank line from producing
  // two markers.
  const prepared = html
    .replace(/<div[^>]*>\s*<br\s*\/?>\s*<\/div>/gi, LINE_SPLIT_MARKER)
    .replace(/<p[^>]*>\s*<br\s*\/?>\s*<\/p>/gi, LINE_SPLIT_MARKER)
    .replace(/<div[^>]*>\s*<\/div>/gi, LINE_SPLIT_MARKER)
    .replace(/<p[^>]*>\s*<\/p>/gi, LINE_SPLIT_MARKER);

  // Now do the standard line-break replacements
  const withBreaks = prepared
    .replace(/<\/div>\s*<div[^>]*>/gi, LINE_SPLIT_MARKER)
    .replace(/<\/p>\s*<p[^>]*>/gi, LINE_SPLIT_MARKER)
    .replace(/<br\s*\/?>/gi, LINE_SPLIT_MARKER)
    .replace(/<div[^>]*>/gi, LINE_SPLIT_MARKER)
    .replace(/<\/?(?:div|p)[^>]*>/gi, '');

  const parts = withBreaks.split(LINE_SPLIT_MARKER);
  const mapped = parts.map((part) => {
    const clean = sanitizeHtml(part);
    return {
      html: clean,
      text: stripHtml(clean).trim(),
    };
  });

  // Keep all interior empty lines (blank paragraphs).
  // Only strip leading and trailing empty lines.
  const result: HtmlLine[] = [];
  for (const line of mapped) {
    result.push(line);
  }
  // Strip leading empty lines
  while (result.length > 0 && result[0].text.length === 0) {
    result.shift();
  }
  // Strip trailing empty lines
  while (result.length > 0 && result[result.length - 1].text.length === 0) {
    result.pop();
  }
  return result;
};

const tokenizeHtmlLine = (lineHtml: string): HtmlToken[] => {
  const tokens: HtmlToken[] = [];
  const tmp = document.createElement('div');
  tmp.innerHTML = lineHtml;

  const walkNode = (node: Node, wrapperOpen: string, wrapperClose: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent ?? '';
      const regex = /(\S+|\s+)/g;
      let match: RegExpExecArray | null = regex.exec(textContent);
      while (match !== null) {
        const word = match[0];
        const wordHtml = wrapperOpen
          ? `${wrapperOpen}${word}${wrapperClose}`
          : word;
        tokens.push({ text: word, html: wordHtml });
        match = regex.exec(textContent);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const attrs = el.attributes;
      let attrStr = '';
      for (let a = 0; a < attrs.length; a++) {
        attrStr += ` ${attrs[a].name}="${attrs[a].value}"`;
      }
      const openTag = `<${tag}${attrStr}>`;
      const closeTag = `</${tag}>`;
      const newOpen = wrapperOpen + openTag;
      const newClose = closeTag + wrapperClose;

      for (let c = 0; c < node.childNodes.length; c++) {
        walkNode(node.childNodes[c], newOpen, newClose);
      }
    }
  };

  for (let c = 0; c < tmp.childNodes.length; c++) {
    walkNode(tmp.childNodes[c], '', '');
  }

  return tokens;
};

const computeLCS = (left: string[], right: string[]): boolean[][] => {
  const m = left.length;
  const n = right.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (left[i - 1] === right[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const inLCS: boolean[][] = [Array(m).fill(false), Array(n).fill(false)];

  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      inLCS[0][i - 1] = true;
      inLCS[1][j - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return inLCS;
};

const getFormattingTags = (html: string, text: string): string[] => {
  const tags: string[] = [];
  const trimmedText = text.trim();
  if (!trimmedText) return tags;
  const lower = html.toLowerCase();
  if (lower.includes('<b>') || lower.includes('<strong>')) tags.push('bold');
  if (lower.includes('<i>') || lower.includes('<em>')) tags.push('italic');
  if (lower.includes('<u>')) tags.push('underline');
  if (lower.includes('<s>') || lower.includes('<strike>'))
    tags.push('strikethrough');
  if (lower.includes('<sub>')) tags.push('subscript');
  if (lower.includes('<sup>')) tags.push('superscript');
  return tags;
};

const describeFormattingDiff = (
  word: string,
  oldHtml: string,
  newHtml: string
): string | null => {
  const oldFmt = getFormattingTags(oldHtml, word);
  const newFmt = getFormattingTags(newHtml, word);
  const added = newFmt.filter((f) => !oldFmt.includes(f));
  const removed = oldFmt.filter((f) => !newFmt.includes(f));
  const parts: string[] = [];
  if (added.length) parts.push(`${added.join(', ')} added in Changed Text`);
  if (removed.length)
    parts.push(`${removed.join(', ')} removed in Changed Text`);
  if (parts.length === 0) return null;
  return `"${word.trim()}" — ${parts.join('; ')}`;
};

const getFormattingChangeType = (
  oldHtml: string,
  newHtml: string,
  text: string
): ChangeType | null => {
  const oldFmt = getFormattingTags(oldHtml, text);
  const newFmt = getFormattingTags(newHtml, text);
  const added = newFmt.filter((f) => !oldFmt.includes(f));
  const removed = oldFmt.filter((f) => !newFmt.includes(f));
  const allChanges = [...added, ...removed];
  if (allChanges.length === 0) return null;
  if (allChanges.includes('bold')) return 'bold_change';
  if (allChanges.includes('italic')) return 'italic_change';
  if (allChanges.includes('underline')) return 'underline_change';
  if (allChanges.includes('strikethrough')) return 'strikethrough_change';
  return 'other_formatting_change';
};

const computeWordDiff = (
  oldLine: HtmlLine,
  newLine: HtmlLine
): {
  oldSegments: WordSegment[];
  newSegments: WordSegment[];
  explanations: string[];
} => {
  const oldTokens = tokenizeHtmlLine(oldLine.html);
  const newTokens = tokenizeHtmlLine(newLine.html);

  // Helper to check if a string is whitespace-only (including non-breaking spaces)
  const isWsOnly = (s: string): boolean => /^[\s\u00A0]+$/.test(s);

  // Normalize whitespace tokens to single space for LCS alignment
  // This prevents identical whitespace tokens from being unmatched due to LCS path ambiguity
  const normalizeForLCS = (text: string): string =>
    isWsOnly(text) ? ' ' : text;
  const oldTexts = oldTokens.map((t) => normalizeForLCS(t.text));
  const newTexts = newTokens.map((t) => normalizeForLCS(t.text));

  const m = oldTexts.length;
  const n = newTexts.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldTexts[i - 1] === newTexts[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const oldInLCS = Array(m).fill(false);
  const newInLCS = Array(n).fill(false);
  const explanations: string[] = [];

  // Collect matched pairs for explanation generation
  const matchedPairs: { oi: number; ni: number }[] = [];

  let wi = m;
  let wj = n;
  while (wi > 0 && wj > 0) {
    if (oldTexts[wi - 1] === newTexts[wj - 1]) {
      // Text matches — also check if HTML matches for true "unchanged" status
      if (oldTokens[wi - 1].html === newTokens[wj - 1].html) {
        oldInLCS[wi - 1] = true;
        newInLCS[wj - 1] = true;
      } else {
        // Formatting change — collect for explanation
        matchedPairs.push({ oi: wi - 1, ni: wj - 1 });
      }
      wi--;
      wj--;
    } else if (dp[wi - 1][wj] > dp[wi][wj - 1]) {
      wi--;
    } else {
      wj--;
    }
  }

  // Track change types per token for color-coded highlighting
  const oldTokenChangeTypes: (ChangeType | undefined)[] =
    Array(m).fill(undefined);
  const newTokenChangeTypes: (ChangeType | undefined)[] =
    Array(n).fill(undefined);
  const matchedOldIndices = new Set(matchedPairs.map((p) => p.oi));
  const matchedNewIndices = new Set(matchedPairs.map((p) => p.ni));

  // Set formatting change types for matched pairs
  for (const { oi, ni } of matchedPairs) {
    const word = oldTokens[oi].text;
    if (isWsOnly(word)) {
      // Compare whitespace lengths to detect genuine spacing differences
      if (oldTokens[oi].text.length !== newTokens[ni].text.length) {
        oldTokenChangeTypes[oi] = 'spacing_change';
        newTokenChangeTypes[ni] = 'spacing_change';
      } else {
        oldInLCS[oi] = true;
        newInLCS[ni] = true;
      }
      continue;
    }
    const fmtChangeType = getFormattingChangeType(
      oldTokens[oi].html,
      newTokens[ni].html,
      word
    );
    oldTokenChangeTypes[oi] = fmtChangeType ?? 'other_formatting_change';
    newTokenChangeTypes[ni] = fmtChangeType ?? 'other_formatting_change';
  }

  // Handle remaining unmatched whitespace tokens
  const unmatchedOldWs: number[] = [];
  const unmatchedNewWs: number[] = [];
  for (let idx = 0; idx < m; idx++) {
    if (
      !oldInLCS[idx] &&
      !matchedOldIndices.has(idx) &&
      isWsOnly(oldTokens[idx].text)
    ) {
      unmatchedOldWs.push(idx);
    }
  }
  for (let idx = 0; idx < n; idx++) {
    if (
      !newInLCS[idx] &&
      !matchedNewIndices.has(idx) &&
      isWsOnly(newTokens[idx].text)
    ) {
      unmatchedNewWs.push(idx);
    }
  }
  // Greedily pair remaining whitespace; compare lengths to detect spacing changes
  const minWs = Math.min(unmatchedOldWs.length, unmatchedNewWs.length);
  for (let k = 0; k < minWs; k++) {
    const oi = unmatchedOldWs[k];
    const ni = unmatchedNewWs[k];
    if (oldTokens[oi].text.length !== newTokens[ni].text.length) {
      oldTokenChangeTypes[oi] = 'spacing_change';
      newTokenChangeTypes[ni] = 'spacing_change';
    } else {
      oldInLCS[oi] = true;
      newInLCS[ni] = true;
    }
  }
  // Mark excess whitespace tokens as spacing changes
  for (let k = minWs; k < unmatchedOldWs.length; k++) {
    oldTokenChangeTypes[unmatchedOldWs[k]] = 'spacing_change';
  }
  for (let k = minWs; k < unmatchedNewWs.length; k++) {
    newTokenChangeTypes[unmatchedNewWs[k]] = 'spacing_change';
  }

  // Set text change type for unmatched non-whitespace tokens
  for (let idx = 0; idx < m; idx++) {
    if (
      !oldInLCS[idx] &&
      !matchedOldIndices.has(idx) &&
      !isWsOnly(oldTokens[idx].text)
    ) {
      oldTokenChangeTypes[idx] = 'text_change';
    }
  }
  for (let idx = 0; idx < n; idx++) {
    if (
      !newInLCS[idx] &&
      !matchedNewIndices.has(idx) &&
      !isWsOnly(newTokens[idx].text)
    ) {
      newTokenChangeTypes[idx] = 'text_change';
    }
  }

  // Generate formatting change explanations
  for (const { oi, ni } of matchedPairs) {
    const word = oldTokens[oi].text;
    if (isWsOnly(word)) continue;
    const desc = describeFormattingDiff(
      word,
      oldTokens[oi].html,
      newTokens[ni].html
    );
    if (desc) explanations.push(desc);
  }

  // Generate text change explanations
  const removedWords = oldTokens
    .filter((_, idx) => !oldInLCS[idx])
    .map((t) => t.text.trim())
    .filter(
      (w) =>
        w.length > 0 &&
        !matchedPairs.some((p) => oldTokens[p.oi].text.trim() === w)
    );
  const addedWords = newTokens
    .filter((_, idx) => !newInLCS[idx])
    .map((t) => t.text.trim())
    .filter(
      (w) =>
        w.length > 0 &&
        !matchedPairs.some((p) => newTokens[p.ni].text.trim() === w)
    );

  if (removedWords.length > 0 && addedWords.length > 0) {
    explanations.push(
      `"${removedWords.join(' ')}" changed to "${addedWords.join(' ')}"`
    );
  } else if (removedWords.length > 0) {
    explanations.push(`"${removedWords.join(' ')}" removed`);
  } else if (addedWords.length > 0) {
    explanations.push(`"${addedWords.join(' ')}" added`);
  }

  const buildSegments = (
    tokens: HtmlToken[],
    inLcs: boolean[],
    changeTypes: (ChangeType | undefined)[]
  ): WordSegment[] => {
    const segments: WordSegment[] = [];
    let currentText = '';
    let currentHtml = '';
    let currentHighlighted = false;
    let currentChangeType: ChangeType | undefined = undefined;

    for (let idx = 0; idx < tokens.length; idx++) {
      const isHighlighted = !inLcs[idx];
      const tokenChangeType = changeTypes[idx];
      if (idx === 0) {
        currentHighlighted = isHighlighted;
        currentChangeType = tokenChangeType;
        currentText = tokens[idx].text;
        currentHtml = tokens[idx].html;
      } else if (
        isHighlighted === currentHighlighted &&
        tokenChangeType === currentChangeType
      ) {
        currentText += tokens[idx].text;
        currentHtml += tokens[idx].html;
      } else {
        segments.push({
          text: currentText,
          html: currentHtml,
          highlighted: currentHighlighted,
          changeType: currentChangeType,
        });
        currentText = tokens[idx].text;
        currentHtml = tokens[idx].html;
        currentHighlighted = isHighlighted;
        currentChangeType = tokenChangeType;
      }
    }

    if (currentText) {
      segments.push({
        text: currentText,
        html: currentHtml,
        highlighted: currentHighlighted,
        changeType: currentChangeType,
      });
    }

    return segments;
  };

  return {
    oldSegments: buildSegments(oldTokens, oldInLCS, oldTokenChangeTypes),
    newSegments: buildSegments(newTokens, newInLCS, newTokenChangeTypes),
    explanations,
  };
};

const computeDiff = (leftHtml: string, rightHtml: string): DiffResult => {
  const leftLines = htmlToLines(leftHtml);
  const rightLines = htmlToLines(rightHtml);

  // ── Quick check: if all non-empty content is the same (just different
  //    line breaks / blank paragraphs), treat the whole thing as a line-break
  //    change.  This prevents empty lines from acting as false LCS anchors
  //    that split the comparison at the wrong points.
  const leftNonEmptyLines = leftLines.filter((l) => l.text.length > 0);
  const rightNonEmptyLines = rightLines.filter((l) => l.text.length > 0);
  const normalizeWsGlobal = (s: string): string =>
    s.replace(/[\s\u00A0]+/g, ' ').trim();
  const leftFullText = normalizeWsGlobal(
    leftNonEmptyLines.map((l) => l.text).join(' ')
  );
  const rightFullText = normalizeWsGlobal(
    rightNonEmptyLines.map((l) => l.text).join(' ')
  );

  const linesAreIdentical =
    leftLines.length === rightLines.length &&
    leftLines.every((l, i) => l.html === rightLines[i].html);

  // Check whether the line *structure* actually differs (not just formatting).
  // If line count is the same and text per line matches, it's a formatting-only
  // change (bold/italic/etc.) — let the normal diff handle it.
  const lineStructureDiffers =
    leftLines.length !== rightLines.length ||
    leftLines.some((l, i) => l.text !== rightLines[i].text);

  // ── Shared helpers for marker-based line-break handling ──
  // These are used by both the pre-check (same text, different breaks)
  // and emitChunk (misaligned lines with text + break changes).
  const LINE_BREAK_MARKER = '\u21B5'; // ↵
  const markerRe = new RegExp(LINE_BREAK_MARKER, 'g');

  const joinWithMarkers = (lines: HtmlLine[]): HtmlLine => {
    const textParts: string[] = [];
    const htmlParts: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        textParts.push(LINE_BREAK_MARKER);
        htmlParts.push(LINE_BREAK_MARKER);
      }
      if (lines[i].text.length === 0) {
        // Empty line — represent as an extra marker
        textParts.push(LINE_BREAK_MARKER);
        htmlParts.push(LINE_BREAK_MARKER);
      } else {
        textParts.push(lines[i].text);
        htmlParts.push(lines[i].html);
      }
    }
    return { text: textParts.join(' '), html: htmlParts.join(' ') };
  };

  // Post-process: convert ↵ segments to line_break_change and render as <br>
  const processSegments = (segments: WordSegment[]): WordSegment[] =>
    segments.map((seg) => {
      if (!seg.text.includes(LINE_BREAK_MARKER)) return seg;
      if (seg.highlighted) {
        return {
          ...seg,
          changeType: 'line_break_change' as ChangeType,
          html: seg.html.replace(markerRe, '<br>'),
        };
      }
      return { ...seg, html: seg.html.replace(markerRe, '<br>') };
    });

  if (
    !linesAreIdentical &&
    leftFullText === rightFullText &&
    lineStructureDiffers
  ) {
    // Content is the same — only line breaks / blank paragraphs differ.
    // Use ↵ markers so the word-diff highlights ONLY break points.
    const left: DiffLine[] = [];
    const right: DiffLine[] = [];
    const explanations: DiffExplanation[] = [];

    const leftJoined = joinWithMarkers(leftLines);
    const rightJoined = joinWithMarkers(rightLines);
    const wordDiff = computeWordDiff(leftJoined, rightJoined);

    left.push({
      type: 'line_break_change',
      text: leftLines.map((l) => l.text).join('\n'),
      html: leftJoined.html,
      lineNumber: 1,
      wordSegments: processSegments(wordDiff.oldSegments),
    });
    right.push({
      type: 'line_break_change',
      text: rightLines.map((l) => l.text).join('\n'),
      html: rightJoined.html,
      lineNumber: 1,
      wordSegments: processSegments(wordDiff.newSegments),
    });

    return { left, right, explanations };
  }

  const leftKeys = leftLines.map((l) => l.html);
  const rightKeys = rightLines.map((l) => l.html);
  const inLCS = computeLCS(leftKeys, rightKeys);

  const left: DiffLine[] = [];
  const right: DiffLine[] = [];
  const explanations: DiffExplanation[] = [];

  const emitChunk = (
    leftChunk: { line: HtmlLine; idx: number }[],
    rightChunk: { line: HtmlLine; idx: number }[]
  ) => {
    if (leftChunk.length > 0 && rightChunk.length > 0) {
      // Filter out empty lines (blank paragraphs) for joining/comparison
      const leftNonEmpty = leftChunk.filter((c) => c.line.text.length > 0);
      const rightNonEmpty = rightChunk.filter((c) => c.line.text.length > 0);

      // If only empty lines differ (one side has extra blank paragraphs)
      if (leftNonEmpty.length === 0 && rightNonEmpty.length === 0) {
        // Both chunks are just empty lines — show as line break changes
        const maxLen = Math.max(leftChunk.length, rightChunk.length);
        for (let k = 0; k < maxLen; k++) {
          left.push({
            type: 'line_break_change',
            text: k < leftChunk.length ? leftChunk[k].line.text : '',
            html: k < leftChunk.length ? leftChunk[k].line.html : '',
            lineNumber: k < leftChunk.length ? leftChunk[k].idx + 1 : null,
          });
          right.push({
            type: 'line_break_change',
            text: k < rightChunk.length ? rightChunk[k].line.text : '',
            html: k < rightChunk.length ? rightChunk[k].line.html : '',
            lineNumber: k < rightChunk.length ? rightChunk[k].idx + 1 : null,
          });
        }
        return;
      }

      // Check if lines match 1:1 (same count and same text per line)
      const leftJoinedText = leftNonEmpty.map((c) => c.line.text).join(' ');
      const rightJoinedText = rightNonEmpty.map((c) => c.line.text).join(' ');
      const linesMatch =
        leftNonEmpty.length === rightNonEmpty.length &&
        leftNonEmpty.every(
          (c, k) => c.line.text === rightNonEmpty[k].line.text
        );

      // Normalize whitespace to detect line break changes even when spacing differs
      const normalizeWs = (s: string): string =>
        s.replace(/[\s\u00A0]+/g, ' ').trim();
      const isLineBreakChange =
        !linesMatch &&
        normalizeWs(leftJoinedText) === normalizeWs(rightJoinedText);

      if (isLineBreakChange) {
        // Line break change (possibly with spacing differences)
        // Join and do word-level diff — will only highlight spacing diffs, not words
        const leftJoined: HtmlLine = {
          text: leftJoinedText,
          html: leftNonEmpty.map((c) => c.line.html).join(' '),
        };
        const rightJoined: HtmlLine = {
          text: rightJoinedText,
          html: rightNonEmpty.map((c) => c.line.html).join(' '),
        };
        const wordDiff = computeWordDiff(leftJoined, rightJoined);
        const hasWordChanges = wordDiff.oldSegments.some(
          (s) =>
            s.changeType !== undefined &&
            s.changeType !== 'spacing_change' &&
            !/^[\s\u00A0]+$/.test(s.text)
        );

        if (hasWordChanges) {
          // Joined text matched after normalizing, but word diff found formatting/text changes
          // Show as line_break_change with word highlights
          left.push({
            type: 'line_break_change',
            text: leftJoinedText,
            html: leftJoined.html,
            lineNumber: leftChunk[0].idx + 1,
            wordSegments: wordDiff.oldSegments,
          });
          right.push({
            type: 'line_break_change',
            text: rightJoinedText,
            html: rightJoined.html,
            lineNumber: rightChunk[0].idx + 1,
            wordSegments: wordDiff.newSegments,
          });
        } else if (leftJoinedText === rightJoinedText) {
          // Pure line break change — no spacing or text diffs at all
          const maxLen = Math.max(leftChunk.length, rightChunk.length);
          for (let k = 0; k < maxLen; k++) {
            if (k < leftChunk.length) {
              left.push({
                type: 'line_break_change',
                text: leftChunk[k].line.text,
                html: leftChunk[k].line.html,
                lineNumber: leftChunk[k].idx + 1,
              });
            } else {
              left.push({
                type: 'line_break_change',
                text: '',
                html: '',
                lineNumber: null,
              });
            }
            if (k < rightChunk.length) {
              right.push({
                type: 'line_break_change',
                text: rightChunk[k].line.text,
                html: rightChunk[k].line.html,
                lineNumber: rightChunk[k].idx + 1,
              });
            } else {
              right.push({
                type: 'line_break_change',
                text: '',
                html: '',
                lineNumber: null,
              });
            }
          }
        } else {
          // Line break + spacing changes — show joined with spacing highlights
          left.push({
            type: 'line_break_change',
            text: leftJoinedText,
            html: leftJoined.html,
            lineNumber: leftChunk[0].idx + 1,
            wordSegments: wordDiff.oldSegments,
          });
          right.push({
            type: 'line_break_change',
            text: rightJoinedText,
            html: rightJoined.html,
            lineNumber: rightChunk[0].idx + 1,
            wordSegments: wordDiff.newSegments,
          });
        }

        for (const desc of wordDiff.explanations) {
          explanations.push({
            line: leftChunk[0].idx + 1,
            description: desc,
            type: desc.includes('changed to')
              ? 'text_change'
              : desc.includes('added in') || desc.includes('removed in')
                ? 'formatting_change'
                : 'text_change',
          });
        }
      } else {
        // Check alignment for same-count case: when lines have the same
        // count but content is split at different positions (misaligned),
        // join with ↵ markers so line breaks are preserved alongside
        // text changes.
        if (leftNonEmpty.length === rightNonEmpty.length) {
          const linesAligned = leftNonEmpty.every((c, k) => {
            const leftWc = c.line.text.split(/\s+/).length;
            const rightWc = rightNonEmpty[k].line.text.split(/\s+/).length;
            const diff = Math.abs(leftWc - rightWc);
            return diff <= 5;
          });

          if (!linesAligned) {
            const leftJoinedMis = joinWithMarkers(
              leftNonEmpty.map((c) => c.line)
            );
            const rightJoinedMis = joinWithMarkers(
              rightNonEmpty.map((c) => c.line)
            );
            const wordDiffMis = computeWordDiff(leftJoinedMis, rightJoinedMis);

            left.push({
              type: 'line_break_change',
              text: leftNonEmpty.map((c) => c.line.text).join('\n'),
              html: leftJoinedMis.html,
              lineNumber: leftChunk[0].idx + 1,
              wordSegments: processSegments(wordDiffMis.oldSegments),
            });
            right.push({
              type: 'line_break_change',
              text: rightNonEmpty.map((c) => c.line.text).join('\n'),
              html: rightJoinedMis.html,
              lineNumber: rightChunk[0].idx + 1,
              wordSegments: processSegments(wordDiffMis.newSegments),
            });

            for (const desc of wordDiffMis.explanations) {
              explanations.push({
                line: leftChunk[0].idx + 1,
                description: desc,
                type: desc.includes('changed to')
                  ? 'text_change'
                  : desc.includes('added in') || desc.includes('removed in')
                    ? 'formatting_change'
                    : 'text_change',
              });
            }
            return;
          }
        }

        // Interleaving walk: process lines in original chunk order,
        // emitting empties as line_break_change, pairing non-empties
        // 1:1 for word diffs, and handling surplus lines as
        // removed/added when one side is exhausted.
        {
          let li = 0;
          let ri = 0;
          while (li < leftChunk.length || ri < rightChunk.length) {
            const lEmpty =
              li < leftChunk.length && leftChunk[li].line.text.length === 0;
            const rEmpty =
              ri < rightChunk.length && rightChunk[ri].line.text.length === 0;

            if (lEmpty && !rEmpty) {
              // Extra empty on left — line break change
              left.push({
                type: 'line_break_change',
                text: '',
                html: '',
                lineNumber: leftChunk[li].idx + 1,
              });
              right.push({
                type: 'line_break_change',
                text: '',
                html: '',
                lineNumber: null,
              });
              li++;
            } else if (rEmpty && !lEmpty) {
              // Extra empty on right — line break change
              left.push({
                type: 'line_break_change',
                text: '',
                html: '',
                lineNumber: null,
              });
              right.push({
                type: 'line_break_change',
                text: '',
                html: '',
                lineNumber: rightChunk[ri].idx + 1,
              });
              ri++;
            } else if (lEmpty && rEmpty) {
              // Both empty — matched, skip
              li++;
              ri++;
            } else if (li < leftChunk.length && ri < rightChunk.length) {
              // Both non-empty — compare
              const wordDiff = computeWordDiff(
                leftChunk[li].line,
                rightChunk[ri].line
              );
              left.push({
                type: 'modified',
                text: leftChunk[li].line.text,
                html: leftChunk[li].line.html,
                lineNumber: leftChunk[li].idx + 1,
                wordSegments: wordDiff.oldSegments,
              });
              right.push({
                type: 'modified',
                text: rightChunk[ri].line.text,
                html: rightChunk[ri].line.html,
                lineNumber: rightChunk[ri].idx + 1,
                wordSegments: wordDiff.newSegments,
              });
              for (const desc of wordDiff.explanations) {
                explanations.push({
                  line: leftChunk[li].idx + 1,
                  description: desc,
                  type: desc.includes('changed to')
                    ? 'text_change'
                    : desc.includes('added in') || desc.includes('removed in')
                      ? 'formatting_change'
                      : 'text_change',
                });
              }
              li++;
              ri++;
            } else if (li < leftChunk.length) {
              // Right side exhausted — remaining left lines
              const isEmpty = leftChunk[li].line.text.length === 0;
              left.push({
                type: isEmpty ? 'line_break_change' : 'removed',
                text: leftChunk[li].line.text,
                html: leftChunk[li].line.html,
                lineNumber: leftChunk[li].idx + 1,
              });
              right.push({
                type: isEmpty ? 'line_break_change' : 'removed',
                text: '',
                html: '',
                lineNumber: null,
              });
              if (!isEmpty) {
                explanations.push({
                  line: leftChunk[li].idx + 1,
                  description: `Line removed: "${leftChunk[li].line.text}"`,
                  type: 'line_removed',
                });
              }
              li++;
            } else if (ri < rightChunk.length) {
              // Left side exhausted — remaining right lines
              const isEmpty = rightChunk[ri].line.text.length === 0;
              left.push({
                type: isEmpty ? 'line_break_change' : 'added',
                text: '',
                html: '',
                lineNumber: null,
              });
              right.push({
                type: isEmpty ? 'line_break_change' : 'added',
                text: rightChunk[ri].line.text,
                html: rightChunk[ri].line.html,
                lineNumber: rightChunk[ri].idx + 1,
              });
              if (!isEmpty) {
                explanations.push({
                  line: rightChunk[ri].idx + 1,
                  description: `Line added: "${rightChunk[ri].line.text}"`,
                  type: 'line_added',
                });
              }
              ri++;
            }
          }
        }
      }
    } else if (leftChunk.length > 0) {
      // If every line in the chunk is empty, it's a blank-paragraph
      // difference — show as line_break_change (emerald) instead of removed.
      const allEmpty = leftChunk.every((c) => c.line.text.length === 0);
      for (const c of leftChunk) {
        left.push({
          type: allEmpty ? 'line_break_change' : 'removed',
          text: c.line.text,
          html: c.line.html,
          lineNumber: c.idx + 1,
        });
        right.push({
          type: allEmpty ? 'line_break_change' : 'removed',
          text: '',
          html: '',
          lineNumber: null,
        });
        if (!allEmpty) {
          explanations.push({
            line: c.idx + 1,
            description: `Line removed: "${c.line.text}"`,
            type: 'line_removed',
          });
        }
      }
    } else if (rightChunk.length > 0) {
      const allEmpty = rightChunk.every((c) => c.line.text.length === 0);
      for (const c of rightChunk) {
        left.push({
          type: allEmpty ? 'line_break_change' : 'added',
          text: '',
          html: '',
          lineNumber: null,
        });
        right.push({
          type: allEmpty ? 'line_break_change' : 'added',
          text: c.line.text,
          html: c.line.html,
          lineNumber: c.idx + 1,
        });
        if (!allEmpty) {
          explanations.push({
            line: c.idx + 1,
            description: `Line added: "${c.line.text}"`,
            type: 'line_added',
          });
        }
      }
    }
  };

  let li = 0;
  let ri = 0;

  while (li < leftLines.length || ri < rightLines.length) {
    // Both in LCS → unchanged
    if (
      li < leftLines.length &&
      ri < rightLines.length &&
      inLCS[0][li] &&
      inLCS[1][ri]
    ) {
      left.push({
        type: 'unchanged',
        text: leftLines[li].text,
        html: leftLines[li].html,
        lineNumber: li + 1,
      });
      right.push({
        type: 'unchanged',
        text: rightLines[ri].text,
        html: rightLines[ri].html,
        lineNumber: ri + 1,
      });
      li++;
      ri++;
      continue;
    }

    // Collect consecutive unmatched lines on both sides
    const leftChunk: { line: HtmlLine; idx: number }[] = [];
    const rightChunk: { line: HtmlLine; idx: number }[] = [];
    while (li < leftLines.length && !inLCS[0][li]) {
      leftChunk.push({ line: leftLines[li], idx: li });
      li++;
    }
    while (ri < rightLines.length && !inLCS[1][ri]) {
      rightChunk.push({ line: rightLines[ri], idx: ri });
      ri++;
    }

    emitChunk(leftChunk, rightChunk);
  }

  return { left, right, explanations };
};

const getLineClassName = (type: DiffLine['type'], side: 'left' | 'right') => {
  if (type === 'removed') {
    return side === 'left'
      ? 'bg-red-100 text-red-800'
      : 'bg-red-50 text-gray-400';
  }
  if (type === 'added') {
    return side === 'right'
      ? 'bg-green-100 text-green-800'
      : 'bg-green-50 text-gray-400';
  }
  if (type === 'modified') {
    return side === 'left'
      ? 'bg-red-50 text-red-800'
      : 'bg-green-50 text-green-800';
  }
  if (type === 'line_break_change') {
    return '';
  }
  return '';
};

const getSegmentHighlightClass = (
  changeType: ChangeType | undefined,
  side: 'left' | 'right'
): string => {
  const base = 'rounded-sm px-0.5';
  switch (changeType) {
    case 'text_change':
      return `bg-amber-200 ${base}`;
    case 'bold_change':
      return `bg-blue-200 ${base}`;
    case 'italic_change':
      return `bg-purple-200 ${base}`;
    case 'underline_change':
      return `bg-cyan-200 ${base}`;
    case 'strikethrough_change':
      return `bg-pink-200 ${base}`;
    case 'spacing_change':
  return `bg-orange-400 text-black ${base}`;
    case 'line_break_change':
      return `bg-emerald-200 ${base}`;
    case 'other_formatting_change':
      return `bg-teal-200 ${base}`;
    default:
      return side === 'left' ? `bg-red-300 ${base}` : `bg-green-300 ${base}`;
  }
};

const renderWordSegments = (
  segments: WordSegment[],
  side: 'left' | 'right'
) => {
  return segments.map((segment, idx) => {
    if (segment.highlighted) {
      return (
        <span
          key={idx}
          className={getSegmentHighlightClass(segment.changeType, side)}
          dangerouslySetInnerHTML={{ __html: segment.html }}
        />
      );
    }
    return (
      <span key={idx} dangerouslySetInnerHTML={{ __html: segment.html }} />
    );
  });
};

const RichTextEditor = ({
  html,
  onHtmlChange,
  placeholder,
}: {
  html: string;
  onHtmlChange: (newHtml: string) => void;
  placeholder: string;
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const internalHtmlRef = useRef(html);
  const initializedRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(!html);

  React.useEffect(() => {
    if (!editorRef.current) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (html) {
        editorRef.current.innerHTML = html;
        internalHtmlRef.current = html;
        setIsEmpty(false);
      }
      return;
    }
    if (html !== internalHtmlRef.current) {
      internalHtmlRef.current = html;
      editorRef.current.innerHTML = html;
      setIsEmpty(!html);
    }
  }, [html]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const current = editorRef.current.innerHTML;
      internalHtmlRef.current = current;
      setIsEmpty(!editorRef.current.textContent?.trim());
      onHtmlChange(current);
    }
  }, [onHtmlChange]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
     const clipboardHtml = e.clipboardData.getData('text/html');

const clipboardText = e.clipboardData.getData('text/plain');

const clipboardRtf = e.clipboardData.getData('text/rtf');

// KEEP ORIGINAL UNICODE CHARACTERS

const safeClipboardText = clipboardText;


      // DEBUG: Log clipboard contents to diagnose paste issues
      console.log('[PASTE DEBUG] types:', Array.from(e.clipboardData.types));
      console.log('[PASTE DEBUG] html:', clipboardHtml ? clipboardHtml.substring(0, 500) : '(empty)');
      console.log('[PASTE DEBUG] text:', safeClipboardText ? safeClipboardText.substring(0, 200) : '(empty)');
      console.log('[PASTE DEBUG] rtf:', clipboardRtf ? clipboardRtf.substring(0, 1000) : '(empty)');


      // When clipboard has RTF but no HTML (VDI tools), parse RTF ourselves
      // since Chrome ignores RTF formatting on native paste.
      if (!clipboardHtml && clipboardRtf) {
        e.preventDefault();
        const rtfHtml = rtfToHtml(clipboardRtf);
        console.log('[PASTE DEBUG] rtfToHtml result:', rtfHtml.substring(0, 500));
        if (editorRef.current) {
          const editorIsEmpty = !editorRef.current.textContent?.trim();
          if (editorIsEmpty) {
            editorRef.current.innerHTML = rtfHtml;
          } else {
            editorRef.current.focus();
            const didInsert = document.execCommand('insertHTML', false, rtfHtml);
            if (!didInsert) {
              editorRef.current.innerHTML += rtfHtml;
            }
          }
          const current = editorRef.current.innerHTML;
          internalHtmlRef.current = current;
          setIsEmpty(!editorRef.current.textContent?.trim());
          onHtmlChange(current);
        }
        return;
      }


      // No HTML and no RTF (pure plain text or VDI without RTF) —
      // let the browser handle the paste natively, then sanitize.
      if (!clipboardHtml) {
        setTimeout(() => {
          if (!editorRef.current) return;
          const rawHtml = editorRef.current.innerHTML;
          const cleaned = sanitizeHtml(rawHtml);
          console.log('[PASTE DEBUG] after sanitize:', cleaned.substring(0, 500));
          editorRef.current.innerHTML = cleaned;
          internalHtmlRef.current = cleaned;
          setIsEmpty(!editorRef.current.textContent?.trim());
          onHtmlChange(cleaned);
        }, 50);
        return;
      }


      e.preventDefault();


      let cleanedHtml: string;
      const plainTextToHtml = (text: string) =>
 text
   .replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/\r\n|\r|\n/g, '<br>');

      if (clipboardHtml) {
        cleanedHtml = sanitizeHtml(clipboardHtml);
        // If sanitized HTML is empty but we have plain text, fall back
        if (!cleanedHtml.trim() && safeClipboardText) {
          cleanedHtml = plainTextToHtml(safeClipboardText);
        }
        // If sanitized HTML lost line breaks that exist in the plain text,
        // fall back to plain text so blank lines are preserved — BUT only
        // when the sanitized HTML has no formatting tags.  Falling back to
        // plain text when formatting (bold/italic/underline) is present
        // would discard the formatting the user pasted from Word, etc.
        const hasFormattingTags = /<(b|strong|i|em|u|s|strike|sub|sup)\b/i.test(
          cleanedHtml
        );
        if (!hasFormattingTags) {
          const htmlBreaks = (cleanedHtml.match(/<br\s*\/?>/gi) || []).length;
          const textBreaks = safeClipboardText
            ? (safeClipboardText.match(/\n/g) || []).length
            : 0;
          if (textBreaks > 0 && htmlBreaks < textBreaks) {
            cleanedHtml = plainTextToHtml(safeClipboardText);
          }
        }
      } else {
        cleanedHtml = plainTextToHtml(safeClipboardText || '');
      }

      if (!editorRef.current) return;

      // Direct innerHTML set — simple and reliable
      const editorIsEmpty = !editorRef.current.textContent?.trim();
      if (editorIsEmpty) {
        editorRef.current.innerHTML = cleanedHtml;
      } else {
        // Editor has existing content — try to insert at cursor
        editorRef.current.focus();
        const didInsert = document.execCommand('insertHTML', false, cleanedHtml);
        if (!didInsert) {
          editorRef.current.innerHTML += cleanedHtml;
        }
      }

      const current = editorRef.current.innerHTML;
      internalHtmlRef.current = current;
      setIsEmpty(!editorRef.current.textContent?.trim());
      onHtmlChange(current);
    },
    [onHtmlChange]
  );

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="h-[500px] w-full overflow-auto rounded border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        onInput={handleInput}
        onPaste={handlePaste}
      />
      {isEmpty && (
        <div className="pointer-events-none absolute top-3 left-3 text-sm text-gray-400">
          {placeholder}
        </div>
      )}
    </div>
  );
};

const TextCompare = () => {
  const [leftHtml, setLeftHtml] = useState('');
  const [rightHtml, setRightHtml] = useState('');
  const [history, setHistory] = useState<{ left: string; right: string }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setLeftHtml(prev.left);
      setRightHtml(prev.right);
      setHistoryIndex(historyIndex - 1);
    }
  };


  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setLeftHtml(next.left);
      setRightHtml(next.right);
      setHistoryIndex(historyIndex + 1);
    }
  };
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [isIdentical, setIsIdentical] = useState(false);
  const saveHistory = (left: string, right: string) => {
  const newHistory = history.slice(0, historyIndex + 1);

  newHistory.push({ left, right });

  setHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
};
  

  const btnPrimary =
"rounded-md bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700";

const btnDanger =
  "rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700";

const btnSecondary =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700";

  const handleCompare = useCallback(() => {
  const result = computeDiff(leftHtml, rightHtml);

  setDiffResult(result);
  setIsEditing(false);

  const identical =
    result.left.every((l) => l.type === "unchanged") &&
    result.right.every((l) => l.type === "unchanged");

  setIsIdentical(identical);
}, [leftHtml, rightHtml]);

  const handleClearAll = useCallback(() => {
  setLeftHtml("");
  setRightHtml("");
  setDiffResult(null);
  setIsEditing(true);
  setIsIdentical(false);
}, []);

  const handleEditTexts = useCallback(() => {
  setIsEditing(true);
  setDiffResult(null);
  setIsIdentical(false);
}, []);

  const handleSwitchTexts = useCallback(() => {
    const tmpLeft = leftHtml;
    setLeftHtml(rightHtml);
    setRightHtml(tmpLeft);
    setDiffResult(null);
  }, [leftHtml, rightHtml]);

  const handleLeftHtmlChange = useCallback((newHtml: string) => {
  setLeftHtml(newHtml);
  saveHistory(newHtml, rightHtml);
}, [rightHtml, history, historyIndex]);

  const handleRightHtmlChange = useCallback((newHtml: string) => {
  setRightHtml(newHtml);
  saveHistory(leftHtml, newHtml);
}, [leftHtml, history, historyIndex]);

  const renderDiffPanel = (lines: DiffLine[], side: 'left' | 'right') => {
    return (
      <div className="overflow-auto rounded border border-gray-200 bg-white text-sm">
        {lines.map((line, index) => (
          <div
            key={`${side}-${index}`}
            className={`flex min-h-[24px] border-b border-gray-100 ${getLineClassName(line.type, side)}${line.type === 'line_break_change' && !line.text ? 'bg-emerald-50' : ''}`}
          >
            <span className="w-10 shrink-0 border-r border-gray-200 bg-gray-50 px-2 py-0.5 text-right text-xs text-gray-400 select-none">
              {line.lineNumber ?? ''}
            </span>
            <span className="px-2 py-0.5 break-all whitespace-pre-wrap">
              {(line.type === 'modified' ||
                line.type === 'line_break_change') &&
              line.wordSegments ? (
                renderWordSegments(line.wordSegments, side)
              ) : (
                <span dangerouslySetInnerHTML={{ __html: line.html }} />
              )}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderStats = () => {
    if (!diffResult) return null;

    const addedCount = diffResult.right.filter(
      (l) => l.type === 'added'
    ).length;
    const removedCount = diffResult.left.filter(
      (l) => l.type === 'removed'
    ).length;
    const modifiedCount = diffResult.left.filter(
      (l) => l.type === 'modified' || l.type === 'line_break_change'
    ).length;
    const unchangedCount = diffResult.left.filter(
      (l) => l.type === 'unchanged'
    ).length;

    return (
      <div className="flex gap-4 text-sm">
        <span className="text-green-700">+ {addedCount} added</span>
        <span className="text-red-700">- {removedCount} removed</span>
        <span className="text-yellow-700">~ {modifiedCount} modified</span>
        <span className="text-gray-500">{unchangedCount} unchanged</span>
      </div>
    );
  };

  const renderChangeLegend = () => {
    if (!diffResult) return null;
    return (
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-amber-300 bg-amber-200" />
          Text change
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-blue-300 bg-blue-200" />
          Bold change
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-purple-300 bg-purple-200" />
          Italic change
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-cyan-300 bg-cyan-200" />
          Underline change
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-gray-400 bg-orange-400" />
          Spacing change
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-200" />
          Line break change
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-green-300 bg-green-100" />
          Line added
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-red-300 bg-red-100" />
          Line removed
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-10">
      {!isEditing && isIdentical && (
  <div className="flex justify-center">
    <div className="rounded bg-green-500 px-4 py-1 text-white text-sm font-medium">
      The two texts are identical!
    </div>
  </div>
)}
      <div className="grid grid-cols-3 items-center gap-2">

  {/* LEFT SIDE */}
  <div className="flex gap-2">
    {!isEditing && (
      <Button onPress={handleEditTexts} className={btnSecondary}>
        Edit texts
      </Button>
    )}
  </div>
  {/* CENTER */}
  <div className="flex justify-center">
    <Button onPress={handleCompare} className={btnPrimary}>
      Compare
    </Button>
  </div>
        {/* RIGHT SIDE */}
  <div className="flex justify-end items-center gap-3">
    {renderStats()}

    <Button onPress={handleUndo} className={btnSecondary}>
      Undo
    </Button>

    <Button onPress={handleRedo} className={btnSecondary}>
      Redo
    </Button>

    <Button onPress={handleClearAll} className={btnDanger}>
      Clear all
    </Button>
  </div>

</div>

      {isEditing ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium">
              Original Text
            </Label>
            <RichTextEditor
              html={leftHtml}
              onHtmlChange={handleLeftHtmlChange}
              placeholder="Paste original text here..."
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium">
              Changed Text
            </Label>
            <RichTextEditor
              html={rightHtml}
              onHtmlChange={handleRightHtmlChange}
              placeholder="Paste changed text here..."
            />
          </div>
        </div>
      ) : diffResult ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium">
                Original Text
              </Label>
              {renderDiffPanel(diffResult.left, 'left')}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm font-medium">
                Changed Text
              </Label>
              {renderDiffPanel(diffResult.right, 'right')}
            </div>
          </div>
          {renderChangeLegend()} 
        </>
      ) : null}
    </div>
  );
};

export default TextCompare;
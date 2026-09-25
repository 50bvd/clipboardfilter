// ==================================================
// CLIPBOARDFILTER - Filter Engine
// Pure, dependency-free text filtering engine.
//
// This file is loaded twice:
//  - as a regular module by the main process (validation / fallback),
//  - as the source of a worker thread (see filterRunner.ts), so that a
//    catastrophic regular expression can never freeze the application.
// It must therefore only depend on Node built-ins.
// ==================================================

import { isMainThread, parentPort, workerData } from 'worker_threads';

export interface EngineRule {
  id: string;
  pattern: string;
  replacement: string;
  useRegex: boolean;
  enabled: boolean;
  caseSensitive?: boolean;
}

export interface FilterDetail {
  id: string;
  count: number;
}

export interface FilterResult {
  filtered: string;
  count: number;
  details?: FilterDetail[];
}

type ReplacementPart =
  | { kind: 'text'; value: string }
  | { kind: 'match' }
  | { kind: 'before' }
  | { kind: 'after' }
  | { kind: 'group'; index: number }
  | { kind: 'named'; name: string };

interface CompiledRule {
  id: string;
  regex: RegExp;
  // Literal every match must contain (fast pre-check), as a plain string
  // when it has no letters, otherwise as a case-insensitive literal regex.
  required: string | RegExp | null;
  // Constant replacement (no `$` tokens) -> fast path
  constant: string | null;
  parts: ReplacementPart[];
}

export interface CompiledRuleSet {
  rules: CompiledRule[];
  errors: { id: string; error: string }[];
}

export const LIMITS = {
  patternLength: 2000,
  replacementLength: 1000
};

const flagsFor = (caseSensitive?: boolean) => (caseSensitive ? 'g' : 'gi');

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates a pattern. Returns null when valid, otherwise an error code.
 */
export function validatePattern(pattern: string, useRegex: boolean, caseSensitive = false): string | null {
  if (typeof pattern !== 'string' || pattern.length === 0) return 'patternRequired';
  if (pattern.length > LIMITS.patternLength) return 'patternTooLong';
  if (!useRegex) return null;
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flagsFor(caseSensitive));
  } catch {
    return 'invalidRegex';
  }
  // A pattern matching the empty string would insert the replacement
  // between every character of the clipboard.
  regex.lastIndex = 0;
  const m = regex.exec('');
  if (m && m[0] === '') return 'emptyMatch';
  return null;
}

// Parses a String.prototype.replace() style template once, so that it can be
// expanded inside a replace callback (needed to count matches in one pass).
function parseReplacement(replacement: string, groupCount: number): ReplacementPart[] {
  const parts: ReplacementPart[] = [];
  let text = '';
  const flush = () => {
    if (text) {
      parts.push({ kind: 'text', value: text });
      text = '';
    }
  };
  for (let i = 0; i < replacement.length; i++) {
    const c = replacement[i];
    if (c !== '$' || i === replacement.length - 1) {
      text += c;
      continue;
    }
    const n = replacement[i + 1];
    if (n === '$') { text += '$'; i++; continue; }
    if (n === '&') { flush(); parts.push({ kind: 'match' }); i++; continue; }
    if (n === '`') { flush(); parts.push({ kind: 'before' }); i++; continue; }
    if (n === "'") { flush(); parts.push({ kind: 'after' }); i++; continue; }
    if (n === '<') {
      const end = replacement.indexOf('>', i + 2);
      if (end !== -1) {
        flush();
        parts.push({ kind: 'named', name: replacement.slice(i + 2, end) });
        i = end;
        continue;
      }
    }
    if (n >= '0' && n <= '9') {
      const two = replacement.slice(i + 1, i + 3);
      if (/^\d\d$/.test(two) && Number(two) >= 1 && Number(two) <= groupCount) {
        flush();
        parts.push({ kind: 'group', index: Number(two) });
        i += 2;
        continue;
      }
      const one = Number(n);
      if (one >= 1 && one <= groupCount) {
        flush();
        parts.push({ kind: 'group', index: one });
        i += 1;
        continue;
      }
    }
    text += c;
  }
  flush();
  return parts;
}

const NON_LITERAL_ESCAPES = new Set('dDwWsSbBcxukpP0123456789'.split(''));

/**
 * Extracts the longest ASCII literal (original case) that every match of `source` must
 * contain, or null. Only the top level of the pattern is analysed and any
 * doubt ends the current literal, so the result is conservative: if the
 * literal is absent from the text, the regex cannot match.
 */
export function requiredLiteral(source: string): string | null {
  const runs: string[] = [];
  let run = '';
  const end = () => { if (run) runs.push(run); run = ''; };
  let depth = 0;
  let i = 0;

  // Top-level alternation: no single literal is required.
  for (let j = 0, d = 0, inClass = false; j < source.length; j++) {
    const c = source[j];
    if (c === '\\') { j++; continue; }
    if (inClass) { if (c === ']') inClass = false; continue; }
    if (c === '[') inClass = true;
    else if (c === '(') d++;
    else if (c === ')') d--;
    else if (c === '|' && d === 0) return null;
  }

  while (i < source.length) {
    const c = source[i];
    let literal: string | null = null;
    let next = i + 1;

    if (c === '\\') {
      const e = source[i + 1];
      if (e === undefined) return null;
      next = i + 2;
      if (!NON_LITERAL_ESCAPES.has(e) && !/[a-zA-Z]/.test(e)) {
        literal = e;
      } else if (/[0-9]/.test(e)) {
        while (/[0-9]/.test(source[next] || '')) next++; // backreference / legacy octal
      } else if (e === 'x') {
        next += 2;
      } else if (e === 'c') {
        next += 1;
      } else if (e === 'u') {
        next += source[next] === '{' ? source.indexOf('}', next) - next + 1 : 4;
      } else if ((e === 'k' && source[next] === '<') || ((e === 'p' || e === 'P') && source[next] === '{')) {
        const close = source.indexOf(e === 'k' ? '>' : '}', next);
        if (close === -1) return null;
        next = close + 1;
      }
      if (next <= i + 1 || next > source.length) return null;
    } else if (c === '[') {
      let j = i + 1;
      if (source[j] === '^') j++;
      while (j < source.length && source[j] !== ']') j += source[j] === '\\' ? 2 : 1;
      next = j + 1;
    } else if (c === '(') {
      depth = 1;
      let j = i + 1;
      while (j < source.length && depth > 0) {
        const g = source[j];
        if (g === '\\') { j += 2; continue; }
        if (g === '[') {
          j++;
          while (j < source.length && source[j] !== ']') j += source[j] === '\\' ? 2 : 1;
        } else if (g === '(') depth++;
        else if (g === ')') depth--;
        j++;
      }
      next = j;
    } else if (!'^$.*+?{}|)]'.includes(c)) {
      literal = c;
    }

    // Quantifier applied to this token?
    const q = source[next];
    let optional = false;
    let repeated = false;
    if (q === '*' || q === '?') { optional = true; next++; }
    else if (q === '+') { repeated = true; next++; }
    else if (q === '{') {
      const m = /^\{(\d+)(,\d*)?\}/.exec(source.slice(next));
      if (m) {
        optional = Number(m[1]) === 0;
        repeated = !optional;
        next += m[0].length;
      } else {
        return null; // ambiguous literal brace: give up
      }
    }
    if (source[next] === '?' && (optional || repeated)) next++; // lazy

    if (literal !== null && literal.charCodeAt(0) < 128 && !optional) {
      if (repeated) { end(); run = literal; end(); }
      else run += literal;
    } else {
      end();
    }
    i = next;
  }
  end();

  let best: string | null = null;
  for (const r of runs) if (!best || r.length > best.length) best = r;
  return best;
}

function countGroups(regex: RegExp): number {
  // Matching an alternation with the empty string always succeeds and exposes
  // the number of capture groups of the original expression.
  const m = new RegExp(`${regex.source}|`, regex.flags.replace('g', '')).exec('');
  return m ? m.length - 1 : 0;
}

export function compileRules(rules: EngineRule[]): CompiledRuleSet {
  const compiled: CompiledRule[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const rule of rules) {
    if (!rule || !rule.enabled) continue;
    const error = validatePattern(rule.pattern, rule.useRegex, !!rule.caseSensitive);
    if (error) {
      errors.push({ id: rule.id, error });
      continue;
    }
    const source = rule.useRegex ? rule.pattern : escapeRegex(rule.pattern);
    const regex = new RegExp(source, flagsFor(rule.caseSensitive));
    const replacement = typeof rule.replacement === 'string' ? rule.replacement : '';
    const literal = requiredLiteral(source);
    const required = literal === null ? null
      : !rule.caseSensitive && /[a-z]/i.test(literal) ? new RegExp(escapeRegex(literal), 'i') : literal;

    if (!rule.useRegex || !replacement.includes('$')) {
      // Literal filters always use their replacement verbatim.
      compiled.push({ id: rule.id, regex, required, constant: replacement, parts: [] });
    } else {
      const parts = parseReplacement(replacement, countGroups(regex));
      const constant = parts.every(p => p.kind === 'text')
        ? parts.map(p => (p as { value: string }).value).join('')
        : null;
      compiled.push({ id: rule.id, regex, required, constant, parts });
    }
  }

  return { rules: compiled, errors };
}

function expand(parts: ReplacementPart[], args: any[]): string {
  // args = [match, p1..pn, offset, input, groups?]
  const hasNamed = typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null;
  const groups = hasNamed ? args[args.length - 1] : undefined;
  const inputIndex = hasNamed ? args.length - 2 : args.length - 1;
  const input: string = args[inputIndex];
  const offset: number = args[inputIndex - 1];
  const match: string = args[0];

  let out = '';
  for (const p of parts) {
    switch (p.kind) {
      case 'text': out += p.value; break;
      case 'match': out += match; break;
      case 'before': out += input.slice(0, offset); break;
      case 'after': out += input.slice(offset + match.length); break;
      case 'group': out += args[p.index] ?? ''; break;
      case 'named': out += groups?.[p.name] ?? ''; break;
    }
  }
  return out;
}

/**
 * Applies every compiled rule sequentially (same semantics as before:
 * a rule sees the output of the previous ones), in a single pass per rule.
 * `onRule` is called before each rule runs (used for progress reporting).
 */
export function applyRules(
  set: CompiledRuleSet,
  text: string,
  withDetails = false,
  onRule?: (index: number) => void
): FilterResult {
  if (!text) return { filtered: text ?? '', count: 0, details: withDetails ? [] : undefined };

  let result = text;
  let total = 0;
  const details: FilterDetail[] | undefined = withDetails ? [] : undefined;

  for (let i = 0; i < set.rules.length; i++) {
    const rule = set.rules[i];
    const required = rule.required;
    if (required !== null && !(typeof required === 'string' ? result.includes(required) : required.test(result))) continue;
    if (onRule) onRule(i);
    let n = 0;
    rule.regex.lastIndex = 0;
    const next = result.replace(rule.regex, (...args: any[]) => {
      const match: string = args[0];
      if (match === '') return '';
      n++;
      return rule.constant !== null ? rule.constant : expand(rule.parts, args);
    });
    if (n > 0) {
      result = next;
      total += n;
      if (details) details.push({ id: rule.id, count: n });
    }
  }

  return { filtered: result, count: total, details };
}

export function filterOnce(rules: EngineRule[], text: string, withDetails = false): FilterResult {
  return applyRules(compileRules(rules), text, withDetails);
}

// ==================================================
// WORKER ENTRY POINT
// ==================================================

export const WORKER_FLAG = '__clipboardFilterWorker';

function startWorker(): void {
  const port = parentPort!;
  const progress: Int32Array | null = workerData.progress ? new Int32Array(workerData.progress) : null;
  let set: CompiledRuleSet = { rules: [], errors: [] };

  port.on('message', (msg: any) => {
    try {
      if (msg.type === 'rules') {
        set = compileRules(msg.rules);
        port.postMessage({ type: 'rules-ok', version: msg.version, ids: set.rules.map(r => r.id), errors: set.errors });
      } else if (msg.type === 'filter') {
        const result = applyRules(set, msg.text, !!msg.details, progress ? (i) => { progress[0] = i; } : undefined);
        if (progress) progress[0] = -1;
        port.postMessage({ type: 'result', id: msg.id, result });
      }
    } catch (error: any) {
      port.postMessage({ type: 'error', id: msg.id, message: String(error?.message || error) });
    }
  });
}

if (!isMainThread && workerData && workerData[WORKER_FLAG]) {
  startWorker();
}

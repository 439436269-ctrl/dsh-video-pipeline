/**
 * Minimal frontmatter reader for bundled skill files.
 *
 * The DSH skill format is YAML frontmatter followed by a Markdown body. Skill
 * frontmatter in the wild is shallow: top-level scalars, occasionally a block
 * scalar (`|` / `>`) for a long description, and occasionally a nested map
 * (`metadata:`). Reading a package dependency to parse that would make this
 * plugin's install heavier than its whole payload, so this module implements
 * exactly that subset and reports anything it cannot represent instead of
 * guessing.
 *
 * @module dsh-video-pipeline/frontmatter
 */

const BLOCK_SCALAR_RE = /^([|>])[-+]?$/;
const KEY_RE = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/;

/**
 * Remove one layer of matching quotes from a scalar.
 * @param {string} value - raw scalar text.
 * @returns {string} unquoted text.
 */
function unquote(value) {
  const text = value.trim();
  if (text.length >= 2) {
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return text.slice(1, -1);
    }
  }
  return text;
}

/**
 * Count leading spaces, treating tabs as one column.
 * @param {string} line - source line.
 * @returns {number} indentation width.
 */
function indentOf(line) {
  const match = /^[ \t]*/.exec(line);
  return match ? match[0].length : 0;
}

/**
 * Read a `|` literal or `>` folded block scalar.
 * @param {string[]} lines - all frontmatter lines.
 * @param {number} start - index of the first line after the block header.
 * @param {number} end - exclusive index of the closing delimiter.
 * @param {string} style - `|` or `>`.
 * @returns {{ text: string, next: number }} block text and the next index to scan.
 */
function readBlock(lines, start, end, style) {
  let base = -1;
  const collected = [];
  let index = start;
  for (; index < end; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      collected.push('');
      continue;
    }
    const indent = indentOf(line);
    if (base === -1) base = indent;
    if (indent < base) break;
    collected.push(line.slice(base));
  }
  while (collected.length && !collected[collected.length - 1].trim()) collected.pop();
  while (collected.length && !collected[0].trim()) collected.shift();
  const text = style === '>' ? collected.join(' ').replace(/\s+/g, ' ').trim() : collected.join('\n');
  return { text, next: index };
}

/**
 * Read a nested map of scalars (`key: value` pairs indented under a parent).
 * @param {string[]} lines - all frontmatter lines.
 * @param {number} start - index of the first candidate child line.
 * @param {number} end - exclusive index of the closing delimiter.
 * @returns {{ map: Record<string, string>, next: number }} parsed children.
 */
function readMap(lines, start, end) {
  const map = {};
  let index = start;
  for (; index < end; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (indentOf(line) === 0) break;
    const match = KEY_RE.exec(line.trim());
    if (match) map[match[1]] = unquote(match[2]);
  }
  return { map, next: index };
}

/**
 * Parse a skill file's YAML frontmatter and return it with the Markdown body.
 * @param {string} raw - complete file text.
 * @returns {{ attrs: Record<string, unknown>, body: string }} parsed attributes and body.
 * @throws {Error} when the file has no usable frontmatter block.
 */
export function parseFrontmatter(raw) {
  const lines = String(raw).split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== '---') {
    throw new Error('frontmatter must open with a --- line');
  }
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('frontmatter must close with a --- line');

  const attrs = {};
  let index = 1;
  while (index < end) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) {
      index += 1;
      continue;
    }
    if (indentOf(line) > 0) {
      index += 1;
      continue;
    }
    const match = KEY_RE.exec(line.trim());
    if (!match) {
      index += 1;
      continue;
    }
    const key = match[1];
    const rest = match[2].trim();
    const block = BLOCK_SCALAR_RE.exec(rest);
    if (block) {
      const read = readBlock(lines, index + 1, end, block[1]);
      attrs[key] = read.text;
      index = read.next;
      continue;
    }
    if (rest === '') {
      const read = readMap(lines, index + 1, end);
      attrs[key] = read.map;
      index = read.next;
      continue;
    }
    attrs[key] = unquote(rest);
    index += 1;
  }

  return { attrs, body: lines.slice(end + 1).join('\n') };
}

const TRUE_WORDS = new Set(['true', 'yes', 'on', '1']);
const FALSE_WORDS = new Set(['false', 'no', 'off', '0']);

/**
 * Parse a frontmatter boolean using the skill format's strict spelling rules.
 * An unparsable value returns `undefined` so the caller can drop the skill with
 * a warning rather than silently picking an invocation policy.
 * @param {unknown} value - raw frontmatter value.
 * @returns {boolean | undefined} parsed boolean, or `undefined` when unusable.
 */
export function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const word = value.trim().toLowerCase();
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return undefined;
}

/**
 * Resolve the invocation policy carried by a skill's frontmatter.
 * @param {Record<string, unknown>} attrs - parsed frontmatter attributes.
 * @returns {{ policy?: { modelInvocable: boolean, userInvocable: boolean }, error?: string }} policy or a rejection reason.
 */
export function invocationPolicy(attrs) {
  const disableModel = attrs['disable-model-invocation'];
  const disableUser = attrs['user-invocable'];
  const model = disableModel === undefined ? true : parseBoolean(disableModel);
  const user = disableUser === undefined ? true : parseBoolean(disableUser);
  if (model === undefined) {
    return { error: `disable-model-invocation is not a boolean: ${JSON.stringify(disableModel)}` };
  }
  if (user === undefined) {
    return { error: `user-invocable is not a boolean: ${JSON.stringify(disableUser)}` };
  }
  return {
    policy: {
      modelInvocable: disableModel === undefined ? true : !model,
      userInvocable: disableUser === undefined ? true : user,
    },
  };
}

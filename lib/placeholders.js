/**
 * Placeholder resolution for bundled skill bodies.
 *
 * The bundled skills were written against one concrete deployment, so host
 * specific values (a Feishu base token, a NAS delivery root, a workstation
 * path) appear in their instructions. Publishing those verbatim would hand
 * every installer someone else's identifiers and could not be configured. The
 * bundled files therefore carry `{{TOKEN}}` placeholders, and this module turns
 * them into values at load time: the installer's own environment for the
 * tokens that have a real environment source, an explicit config override when
 * one is given, and a readable angle-bracket hint otherwise so an unconfigured
 * skill still explains what it needs.
 *
 * @module dsh-video-pipeline/placeholders
 */

import { homedir } from 'node:os';

/** Placeholder tokens with no safe real-world default. */
export const PLACEHOLDER_DEFAULTS = Object.freeze({
  USER_HOME: '%USERPROFILE%',
  WORKSPACE: '<你的工作区>',
  FEISHU_BASE_APP: '<飞书多维表格 base app_token>',
  FEISHU_TABLE: '<飞书数据表 table_id>',
  FEISHU_RECORD: '<飞书记录 record_id>',
  NAS_DELIVERABLE_DIR: '<NAS 交付目录，如 /sata1/public/公共分组/唐诗300首短剧>',
  NAS_DELIVERABLE_PARENT: '<NAS 交付目录的父目录>',
  NAS_HOST: '<NAS 主机>',
  ARK_API_KEY: '<设置环境变量 ARK_API_KEY>',
  ARK_API_KEY_FILE: '<本地保存 ARK key 的文件>',
});

/** Environment variables that fill a placeholder when the config does not. */
const ENV_SOURCES = Object.freeze({
  USER_HOME: ['USERPROFILE', 'HOME'],
  WORKSPACE: ['DSH_WORKSPACE', 'WORKSPACE'],
  ARK_API_KEY: ['ARK_API_KEY', 'ARK_STD_KEY'],
  NAS_DELIVERABLE_DIR: ['NAS_DELIVERABLE_DIR'],
  NAS_DELIVERABLE_PARENT: ['NAS_DELIVERABLE_PARENT'],
  NAS_HOST: ['NAS_HOST'],
  ARK_API_KEY_FILE: ['ARK_API_KEY_FILE'],
  FEISHU_BASE_APP: ['FEISHU_BASE_APP'],
  FEISHU_TABLE: ['FEISHU_TABLE'],
  FEISHU_RECORD: ['FEISHU_RECORD'],
});

/**
 * Build the effective placeholder map for one plugin instance.
 * Precedence: explicit config override, then environment, then built-in
 * default, then the local home directory as a last resort for `USER_HOME`.
 * @param {Record<string, unknown>} [overrides] - `config.placeholders` from the loader row.
 * @param {Record<string, string | undefined>} [env] - environment to read; defaults to `process.env`.
 * @returns {Record<string, string>} token to replacement text.
 */
export function resolvePlaceholders(overrides, env = process.env) {
  const map = { ...PLACEHOLDER_DEFAULTS };
  for (const [token, names] of Object.entries(ENV_SOURCES)) {
    for (const name of names) {
      const value = env?.[name];
      if (typeof value === 'string' && value.trim()) {
        map[token] = value;
        break;
      }
    }
  }
  if (map.USER_HOME === PLACEHOLDER_DEFAULTS.USER_HOME) {
    try {
      const home = homedir();
      if (home) map.USER_HOME = home;
    } catch {
      /* keep the readable default */
    }
  }
  if (overrides && typeof overrides === 'object') {
    for (const [token, value] of Object.entries(overrides)) {
      if (value === undefined || value === null) continue;
      map[token] = String(value);
    }
  }
  return map;
}

/**
 * Replace `{{TOKEN}}` occurrences with their resolved text.
 * Unknown tokens are left untouched so a typo stays visible instead of turning
 * into an empty string inside an instruction.
 * @param {string} text - skill body or description.
 * @param {Record<string, string>} map - resolved placeholders.
 * @returns {string} substituted text.
 */
export function applyPlaceholders(text, map) {
  if (typeof text !== 'string' || !text.includes('{{')) return text;
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, token) =>
    Object.prototype.hasOwnProperty.call(map, token) ? String(map[token]) : match);
}

/**
 * List every placeholder token that appears in a piece of text.
 * @param {string} text - text to scan.
 * @returns {string[]} unique token names, in first-appearance order.
 */
export function findPlaceholders(text) {
  if (typeof text !== 'string') return [];
  const found = [];
  const re = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

/**
 * Bundled skill provider.
 *
 * DSH resolves skills through the `ctx.skills` provider registry. Mounting
 * `@deepseek-ai/dsh-skill-filesystem` with a `bundledSkillDir` would also work,
 * but it makes the deployment carry a second config the installer has to get
 * right. Registering a provider here keeps the plugin self-contained: the
 * skills travel inside the package and appear the moment the plugin is mounted,
 * with no copy step into a skills root.
 *
 * Discovery is one level deep, matching the format the skills are written in:
 * `<skillsDir>/<name>/SKILL.md` directory bundles (which may carry their own
 * `references/` and `scripts/` trees) and flat `<skillsDir>/<name>.md` files.
 * Candidates are reported at the bundled rank so an installer's own project or
 * user skills win any name collision instead of being shadowed by the package.
 *
 * @module dsh-video-pipeline/provider
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { invocationPolicy, parseFrontmatter } from './frontmatter.js';
import { applyPlaceholders } from './placeholders.js';

/** Precedence rank for packaged skill providers and local bundled roots. */
export const BUNDLED_SKILL_RANK = 600;

/** Provider name registered on `ctx.skills`. */
export const PROVIDER_NAME = 'dsh-video-pipeline';

/** File name of a directory-bundle skill. */
export const SKILL_FILE = 'SKILL.md';

/** Public skill-name grammar: lowercase kebab-case. */
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Return whether a string is a valid kebab-case skill name.
 * @param {unknown} value - candidate name.
 * @returns {boolean} whether the name is usable.
 */
export function isSkillName(value) {
  return typeof value === 'string' && SKILL_NAME_RE.test(value);
}

/**
 * Enumerate the skill files under a bundled skills directory.
 * @param {string} skillsDir - absolute path to the bundled skills root.
 * @param {(message: string) => void} warn - warning sink.
 * @returns {Array<{ dir: string, file: string }>} discovered skill files.
 */
function discover(skillsDir, warn) {
  let dirents;
  try {
    dirents = readdirSync(skillsDir, { withFileTypes: true });
  } catch (error) {
    warn(`cannot read bundled skills directory ${skillsDir}: ${error.message}`);
    return [];
  }

  const found = [];
  for (const dirent of dirents) {
    const full = join(skillsDir, dirent.name);
    if (dirent.isDirectory()) {
      const file = join(full, SKILL_FILE);
      try {
        if (statSync(file).isFile()) found.push({ dir: full, file });
      } catch {
        warn(`skipping ${dirent.name}: no ${SKILL_FILE}`);
      }
      continue;
    }
    if (dirent.isFile() && dirent.name.endsWith('.md') && dirent.name !== SKILL_FILE) {
      found.push({ dir: skillsDir, file: full });
    }
  }
  return found;
}

/**
 * Read and validate one skill file into a provider candidate.
 * @param {{ dir: string, file: string }} entry - discovered skill file.
 * @param {(message: string) => void} warn - warning sink.
 * @returns {object | undefined} a candidate, or `undefined` when the file is unusable.
 */
function readCandidate(entry, warn) {
  let parsed;
  try {
    parsed = parseFrontmatter(readFileSync(entry.file, 'utf8'));
  } catch (error) {
    warn(`skipping ${entry.file}: ${error.message}`);
    return undefined;
  }

  const { attrs } = parsed;
  const name = typeof attrs.name === 'string' ? attrs.name.trim() : '';
  if (!isSkillName(name)) {
    warn(`skipping ${entry.file}: name must be kebab-case, got ${JSON.stringify(attrs.name)}`);
    return undefined;
  }
  const directoryName = basename(entry.dir);
  if (entry.file === join(entry.dir, SKILL_FILE) && directoryName !== name) {
    warn(`${name}: directory name ${directoryName} differs from frontmatter name (frontmatter wins)`);
  }

  const description = typeof attrs.description === 'string' ? attrs.description.trim() : '';
  if (!description) {
    warn(`skipping ${name}: description is required`);
    return undefined;
  }

  const { policy, error } = invocationPolicy(attrs);
  if (error) {
    warn(`skipping ${name}: ${error}`);
    return undefined;
  }

  const whenToUse = typeof attrs.whenToUse === 'string' ? attrs.whenToUse.trim() : undefined;
  const metadata = attrs.metadata && typeof attrs.metadata === 'object' && !Array.isArray(attrs.metadata)
    ? attrs.metadata
    : undefined;

  return {
    name,
    description,
    whenToUse,
    invocation: policy,
    source: 'bundled',
    provider: PROVIDER_NAME,
    path: entry.file,
    resourceBase: { kind: 'directory', path: entry.dir },
    rank: BUNDLED_SKILL_RANK,
    locator: entry.file,
    metadata,
  };
}

/**
 * Create the bundled skill provider registered on `ctx.skills`.
 * @param {object} options - provider options.
 * @param {string} options.skillsDir - absolute path to the bundled skills root.
 * @param {string[]} [options.enabledSkills] - when non-empty, only these skill names are served.
 * @param {Record<string, string>} [options.placeholderMap] - resolved `{{TOKEN}}` values.
 * @param {(message: string) => void} [options.onWarn] - warning sink.
 * @returns {{ name: string, list: Function, get: Function }} the provider.
 */
export function createBundledSkillProvider(options = {}) {
  const {
    skillsDir,
    enabledSkills = [],
    placeholderMap = {},
    onWarn,
  } = options;
  const warn = typeof onWarn === 'function' ? onWarn : () => {};
  const allowed = new Set((Array.isArray(enabledSkills) ? enabledSkills : []).map(String));
  let catalog;

  /**
   * Build (once) the validated catalog of candidates.
   * @returns {object[]} candidates sorted by name.
   */
  function candidates() {
    if (catalog) return catalog;
    catalog = discover(skillsDir, warn)
      .map((entry) => readCandidate(entry, warn))
      .filter(Boolean)
      .filter((candidate) => allowed.size === 0 || allowed.has(candidate.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    return catalog;
  }

  return {
    name: PROVIDER_NAME,

    /**
     * List every bundled skill for the current lookup.
     * @param {{ signal?: AbortSignal }} [lookup] - lookup options.
     * @returns {Promise<object[]>} provider candidates.
     */
    async list(lookup) {
      if (lookup?.signal?.aborted) return [];
      return candidates();
    },

    /**
     * Load one bundled skill body, with placeholders resolved.
     * @param {object} candidate - a candidate previously returned by `list`.
     * @param {{ signal?: AbortSignal }} [lookup] - lookup options.
     * @returns {Promise<object | undefined>} the full definition, or `undefined` when unreadable.
     */
    async get(candidate, lookup) {
      if (lookup?.signal?.aborted) return undefined;
      let parsed;
      try {
        parsed = parseFrontmatter(readFileSync(candidate.locator, 'utf8'));
      } catch (error) {
        warn(`cannot load ${candidate.name}: ${error.message}`);
        return undefined;
      }
      const { policy } = invocationPolicy(parsed.attrs);
      const content = applyPlaceholders(parsed.body.replace(/^\s*\n/, ''), placeholderMap);
      return {
        name: candidate.name,
        description: applyPlaceholders(candidate.description, placeholderMap),
        whenToUse: candidate.whenToUse ? applyPlaceholders(candidate.whenToUse, placeholderMap) : undefined,
        invocation: policy ?? candidate.invocation,
        source: 'bundled',
        provider: PROVIDER_NAME,
        path: candidate.path,
        resourceBase: candidate.resourceBase,
        metadata: candidate.metadata,
        content,
      };
    },
  };
}

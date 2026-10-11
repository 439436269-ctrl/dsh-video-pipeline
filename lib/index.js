/**
 * dsh-video-pipeline — bundled video-production skills for the DeepSeek Harness.
 *
 * Mounting this plugin registers a skill provider on `ctx.skills` that serves
 * the `skills/` directory shipped inside the package. Every bundled skill then
 * shows up in the agent's skill catalog with no copy step, and the orchestration
 * skill can reach its atomic skills by name because they are all in one catalog.
 *
 * Nothing here depends on another package: the provider interface is a plain
 * object, so the plugin declares no runtime dependency and cannot hit a peer
 * range resolution failure on install.
 *
 * @module dsh-video-pipeline
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePlaceholders } from './placeholders.js';
import { createBundledSkillProvider, PROVIDER_NAME } from './provider.js';

/** Cordis plugin name. */
export const name = PROVIDER_NAME;

/** Directory holding the bundled skills, relative to this module. */
const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');

/**
 * Emit a warning through whatever logging surface the host context exposes.
 * The context shape differs between host versions, so this never throws: a
 * missing logger must not take the provider down with it.
 * @param {object} ctx - cordis context.
 * @param {string} message - warning text.
 */
function warn(ctx, message) {
  try {
    const logger = typeof ctx?.logger === 'function' ? ctx.logger(PROVIDER_NAME) : ctx?.logger;
    if (logger && typeof logger.warn === 'function') {
      logger.warn(message);
      return;
    }
  } catch {
    /* fall through to the console */
  }
  try {
    console.warn(`[${PROVIDER_NAME}] ${message}`);
  } catch {
    /* nothing left to report to */
  }
}

/**
 * Register the bundled skill provider.
 * @param {object} ctx - cordis context.
 * @param {object} [config] - loader row config.
 * @param {string[]} [config.enabledSkills] - when non-empty, only these bundled skills are served.
 * @param {Record<string, string>} [config.placeholders] - `{{TOKEN}}` overrides for the bundled bodies.
 */
export function apply(ctx, config = {}) {
  const settings = config && typeof config === 'object' ? config : {};
  const providerOptions = {
    skillsDir: SKILLS_DIR,
    enabledSkills: settings.enabledSkills,
    placeholderMap: resolvePlaceholders(settings.placeholders),
    onWarn: (message) => warn(ctx, message),
  };

  ctx.inject(['skills'], (skillCtx) => {
    skillCtx.skills.registerProvider(() => createBundledSkillProvider(providerOptions));
  });
}

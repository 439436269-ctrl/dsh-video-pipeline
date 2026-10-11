#!/usr/bin/env node
/**
 * Reproducible importer for the bundled skills.
 *
 * The skills live in the author's local skill root. Copying them by hand into
 * the package is unrepeatable and hides what changed; this script makes the
 * published payload a function of (source, rules) so the same input always
 * produces the same package.
 *
 *   node tools/import-skills.mjs --audit    # report only, writes nothing (default)
 *   node tools/import-skills.mjs --write    # copy + scrub into skills/
 *   node tools/import-skills.mjs --verify   # residual scan over skills/
 *
 * The audit and the write share one code path, so the audit is a faithful
 * preview. `--verify` is the independent gate: it re-reads the written files
 * and fails on any credential or personal-identifier shape that survived,
 * including in files no scrub rule matched.
 *
 * Environment:
 *   SKILLS_SOURCE   source skill root (default: %USERPROFILE%\.agents\skills)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SKILLS,
  TEMPLATES,
  TEXT_EXTENSIONS,
  dropReason,
  residualFindings,
  scrubText,
} from './scrub-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TARGET = join(ROOT, 'skills');
/** Skills authored for this package rather than imported from the local root. */
const AUTHORED = join(ROOT, 'authored');
const SOURCE = process.env.SKILLS_SOURCE || join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills');

const mode = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--verify') ? 'verify'
    : 'audit';

/** Walk a directory recursively, returning file paths relative to its root. */
function walk(root, current = root, out = []) {
  for (const dirent of readdirSync(current, { withFileTypes: true })) {
    const full = join(current, dirent.name);
    if (dirent.isDirectory()) walk(root, full, out);
    else if (dirent.isFile()) out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

/**
 * Normalise line endings to LF.
 *
 * The source skills live on Windows and carry CRLF. Publishing that as-is makes
 * the tarball depend on the packaging machine's line endings, which shows up
 * later as "local tgz differs from the registry tarball" during read-back
 * verification even though nothing changed. LF also keeps shell examples honest
 * on Linux and macOS.
 * @param {string} text - file contents.
 * @returns {string} text with LF endings only.
 */
function normalizeEol(text) {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Collect the import plan for every bundled skill without touching the disk.
 * @returns {{ files: object[], templates: object[], missing: string[] }} planned file actions,
 *   structure-only examples that stand in for dropped real data, and missing skills.
 */
function plan() {
  const files = [];
  const missing = [];
  for (const skill of SKILLS) {
    const sourceRoot = join(SOURCE, skill.name);
    if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
      missing.push(skill.name);
      continue;
    }
    for (const rel of walk(sourceRoot).sort()) {
      const reason = dropReason(`${skill.name}/${rel}`);
      const absolute = join(sourceRoot, rel);
      if (reason) {
        files.push({ skill: skill.name, rel, action: 'drop', reason });
        continue;
      }
      const ext = extname(rel).toLowerCase();
      if (!TEXT_EXTENSIONS.has(ext)) {
        files.push({
          skill: skill.name,
          rel,
          action: 'copy-binary',
          reason: '非文本文件，原样复制',
          origin: absolute,
        });
        continue;
      }
      const raw = readFileSync(absolute, 'utf8');
      const { text, applied } = scrubText(raw);
      const normalized = normalizeEol(text);
      files.push({
        skill: skill.name,
        rel,
        action: applied.length ? 'scrub' : 'copy',
        applied,
        reason: applied.length ? `脱敏：${applied.join('、')}` : undefined,
        bytes: Buffer.byteLength(normalized),
        origin: absolute,
        text: normalized,
      });
    }
  }

  // Skills written for this package live under authored/ so that the import —
  // which rebuilds skills/ from scratch — cannot delete them. They get the same
  // scrub and residual treatment as imported content.
  if (existsSync(AUTHORED)) {
    for (const rel of walk(AUTHORED).sort()) {
      const segments = rel.split('/');
      if (segments.length < 2) continue;
      const [skillName, ...rest] = segments;
      const origin = join(AUTHORED, rel);
      const { text, applied } = scrubText(readFileSync(origin, 'utf8'));
      const normalized = normalizeEol(text);
      files.push({
        skill: skillName,
        rel: rest.join('/'),
        action: 'authored',
        applied,
        reason: applied.length ? `脱敏：${applied.join('、')}` : '本包自撰',
        bytes: Buffer.byteLength(normalized),
        origin,
        text: normalized,
      });
    }
  }
  const templates = TEMPLATES.map(([skill, rel, contents, note]) => ({ skill, rel, contents, note, action: 'template' }));

  // A dropped data file that a kept script still reads leaves that capability
  // half-deleted. Surface it instead of letting the reader discover it at run
  // time: either the snapshot is yours to regenerate, or the script needs an
  // input the package cannot ship.
  const droppedNames = [...new Set(files.filter((f) => f.action === 'drop')
    .map((f) => f.rel.split('/').pop())
    .filter((name) => name.length > 6 && name !== 'SKILL.md'))];
  const dangling = [];
  for (const file of files) {
    if (file.action === 'drop' || file.action === 'copy-binary') continue;
    for (const name of droppedNames) {
      if (file.text.includes(name)) dangling.push({ kept: `${file.skill}/${file.rel}`, dropped: name });
    }
  }
  return { files, templates, dangling, missing };
}

/** Print the plan as a per-skill summary plus every non-trivial action. */
function report({ files, templates, dangling, missing }) {
  const bySkill = new Map();
  for (const file of files) {
    if (!bySkill.has(file.skill)) bySkill.set(file.skill, []);
    bySkill.get(file.skill).push(file);
  }
  console.log(`source: ${SOURCE}`);
  console.log(`authored: ${AUTHORED}`);
  console.log(`target: ${TARGET}`);
  console.log('文本文件行尾统一为 LF（源在 Windows 上带 CRLF，不归一会让 tarball 随打包机器漂移）\n');
  let dropped = 0;
  let scrubbed = 0;
  let kept = 0;
  let authored = 0;
  const order = [...SKILLS.map((s) => ({ name: s.name, group: s.group }))];
  for (const skillName of bySkill.keys()) {
    if (!order.some((s) => s.name === skillName)) order.push({ name: skillName, group: '本包自撰' });
  }
  for (const skill of order) {
    const entries = bySkill.get(skill.name) || [];
    const drops = entries.filter((e) => e.action === 'drop');
    const scrubs = entries.filter((e) => e.action === 'scrub');
    const keeps = entries.filter((e) => e.action === 'copy' || e.action === 'copy-binary');
    const own = entries.filter((e) => e.action === 'authored');
    dropped += drops.length;
    scrubbed += scrubs.length;
    kept += keeps.length;
    authored += own.length;
    const state = entries.length === 0 ? 'MISSING'
      : `${keeps.length} 保留 / ${scrubs.length} 脱敏 / ${drops.length} 剔除${own.length ? ` / ${own.length} 自撰` : ''}`;
    console.log(`── ${skill.name}  [${skill.group}]  ${state}`);
    for (const entry of scrubs) console.log(`     改  ${entry.rel}  ←  ${entry.applied.join('、')}`);
    for (const entry of own) console.log(`     写  ${entry.rel}  ←  ${entry.reason}`);
    for (const entry of drops) console.log(`     删  ${entry.rel}  ←  ${entry.reason}`);
  }
  console.log(`\n模板（替代被剔除的真实数据）：`);
  for (const template of templates) {
    console.log(`     +  ${template.skill}/${template.rel}  ←  ${template.note}`);
  }
  if (dangling.length) {
    console.log(`\n⚠ 被剔除的输入仍被保留文件引用（${dangling.length} 处，需在 README 里说明要自备）：`);
    for (const item of dangling) console.log(`     !  ${item.kept}  仍读取  ${item.dropped}`);
  }
  console.log(`\n合计：保留 ${kept}，脱敏 ${scrubbed}，剔除 ${dropped}，自撰 ${authored}，模板 ${templates.length}`);
  if (missing.length) console.log(`缺失源 skill：${missing.join(', ')}`);
  return dropped + scrubbed + kept;
}

/** Write the plan into the package skills directory. */
function write({ files, templates }) {
  rmSync(TARGET, { recursive: true, force: true });
  mkdirSync(TARGET, { recursive: true });
  let written = 0;
  for (const file of files) {
    if (file.action === 'drop') continue;
    const destination = join(TARGET, file.skill, ...file.rel.split('/'));
    mkdirSync(dirname(destination), { recursive: true });
    if (file.action === 'copy-binary') {
      writeFileSync(destination, readFileSync(file.origin));
    } else {
      writeFileSync(destination, file.text);
    }
    written += 1;
  }
  for (const template of templates) {
    const destination = join(TARGET, template.skill, ...template.rel.split('/'));
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, template.contents);
    written += 1;
  }
  console.log(`\n写入 ${written} 个文件 → ${TARGET}`);
}

/** Extensions whose syntax can be mechanically checked after scrubbing. */
const JS_EXTENSIONS = new Set(['.mjs', '.js', '.cjs']);

/** Cache of interpreter availability probes, so a missing checker is not mistaken for bad code. */
const checkerCache = new Map();

/**
 * Return whether an interpreter can be spawned at all.
 * A missing interpreter must be reported as "not checked" — treating it as a
 * syntax failure would make the gate red on any machine without that runtime
 * (CI runners ship `python3`, not always `python`).
 * @param {string} command - interpreter executable.
 * @returns {boolean} whether it ran.
 */
function canRun(command) {
  if (checkerCache.has(command)) return checkerCache.get(command);
  let ok = false;
  try {
    execFileSync(command, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    ok = true;
  } catch {
    ok = false;
  }
  checkerCache.set(command, ok);
  return ok;
}

/**
 * Pick the checker for one extension.
 * @param {string} ext - lower-case extension.
 * @returns {{ cmd: string, args: (file: string) => string[] } | undefined} checker, or none available.
 */
function checkerFor(ext) {
  if (JS_EXTENSIONS.has(ext)) {
    return { cmd: process.execPath, args: (file) => ['--check', file] };
  }
  if (ext === '.py') {
    const candidates = [process.env.PYTHON, 'python3', 'python'].filter(Boolean);
    for (const candidate of candidates) {
      if (canRun(candidate)) {
        return {
          cmd: candidate,
          args: (file) => ['-c', 'import ast,sys;ast.parse(open(sys.argv[1],encoding="utf-8").read())', file],
        };
      }
    }
  }
  return undefined;
}

/**
 * Parse a script without executing it, so a scrub rule that rewrote code is
 * caught as damage rather than shipped.
 * @param {string} file - absolute path.
 * @param {string} ext - lower-case extension.
 * @returns {{ status: 'ok' | 'fail' | 'skipped', detail?: string }} result.
 */
function syntaxCheck(file, ext) {
  const checker = checkerFor(ext);
  if (!checker) return { status: 'skipped', detail: `${ext} 检查器不可用` };
  try {
    execFileSync(checker.cmd, checker.args(file), { stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 'ok' };
  } catch (error) {
    const detail = String(error.stderr || error.message || '').trim().split('\n').slice(0, 2).join(' / ');
    if (error.code === 'ENOENT') return { status: 'skipped', detail: `${ext} 检查器不可用` };
    return { status: 'fail', detail: detail || 'syntax check failed' };
  }
}

/** Scan the written package for residual credentials, identifiers and scrub damage. */
function verify() {
  if (!existsSync(TARGET)) {
    console.error(`没有可校验的目录：${TARGET}（先跑 --write）`);
    process.exit(1);
  }
  const findings = [];
  let scanned = 0;
  let checked = 0;
  const skipped = new Set();
  // Walk the whole target, not just the imported skill list: authored content
  // and template files must clear the same gate.
  const allFiles = walk(TARGET);
  for (const skill of SKILLS) {
    if (!existsSync(join(TARGET, skill.name))) {
      findings.push({ file: `${skill.name}/`, what: 'skill 目录缺失' });
    }
  }
  for (const rel of allFiles) {
    const full = join(TARGET, rel);
    scanned += 1;
    const ext = extname(rel).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const text = readFileSync(full, 'utf8');
    for (const what of residualFindings(text)) {
      findings.push({ file: rel, what });
    }
    if (JS_EXTENSIONS.has(ext) || ext === '.py') {
      const result = syntaxCheck(full, ext);
      if (result.status === 'ok') checked += 1;
      else if (result.status === 'skipped') skipped.add(result.detail);
      else findings.push({ file: rel, what: `语法解析失败（脱敏可能改坏代码）：${result.detail}` });
    }
  }
  const skippedNote = skipped.size ? `；跳过 ${[...skipped].join('、')}` : '';
  console.log(`校验 ${scanned} 个文件（${checked} 个脚本语法通过${skippedNote}）；残留 ${findings.length} 处`);
  for (const finding of findings) console.error(`  ✗ ${finding.file}  ←  ${finding.what}`);
  if (findings.length) {
    console.error('\n存在残留敏感内容或脱敏损伤，禁止发布。');
    process.exit(1);
  }
  console.log(`未发现密钥、账号标识、本机路径、内网地址残留，脚本语法可解析${skipped.size ? '（部分类型被跳过）' : '，全部通过'}。`);
}

if (mode === 'verify') {
  verify();
} else {
  const planResult = plan();
  report(planResult);
  if (mode === 'write') write(planResult);
  else console.log('\n（audit 模式，未写入。加 --write 执行）');
}

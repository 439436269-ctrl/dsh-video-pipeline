#!/usr/bin/env node
/**
 * Artifact check: pack the package, extract the tarball, and prove the thing
 * that would be published actually works.
 *
 * The source tree passing its tests says nothing about the tarball: a `files`
 * whitelist that misses a subdirectory, or a relative import whose target was
 * never listed, produces a package that installs and then throws at load time.
 * npm packages cannot be unpublished, so the check runs on the extracted
 * artifact — the imported provider, the bundled catalog, and every relative
 * import resolved inside the package.
 *
 *   node tools/verify-artifact.mjs           # pack, extract, verify, clean up
 *   node tools/verify-artifact.mjs --keep    # leave the extracted copy for inspection
 *
 * Exit code is non-zero on any failure.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SKILLS, isTextPath } from './scrub-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const KEEP = process.argv.includes('--keep');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const problems = [];
const ok = (message) => console.log(`  ✅ ${message}`);
const bad = (message) => { console.log(`  ❌ ${message}`); problems.push(message); };

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const expectedName = `${pkg.name}-${pkg.version}.tgz`;

console.log('\n一、打包');
const workDir = mkdtempSync(join(tmpdir(), 'dsh-artifact-'));
let packOutput;
try {
  // Node refuses to spawn a `.cmd` shim directly (CVE-2024-27980 hardening), so
  // the npm shim goes through a shell; the temp path is quoted for safety.
  packOutput = execFileSync(`${NPM} pack --pack-destination "${workDir}" --json`, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  console.error('npm pack 失败：', String(error.stderr || error.message).slice(0, 600));
  process.exit(1);
}
const packed = JSON.parse(packOutput)[0];
const tarball = join(workDir, packed.filename);
if (packed.filename !== expectedName) bad(`tarball 名不是 ${expectedName}，而是 ${packed.filename}`);
else ok(`tarball：${packed.filename}（${Math.round(packed.size / 1024)} KB，解包 ${Math.round(packed.unpackedSize / 1024)} KB）`);

console.log('\n二、包内清单');
const paths = packed.files.map((f) => f.path);

/** Files that must be present for the plugin to load at all. */
const required = ['package.json', 'cordis.patch.yml', 'README.md', 'LICENSE', 'CHANGELOG.md', 'THIRD-PARTY-NOTICES.md'];
for (const name of required) {
  if (!paths.includes(name)) bad(`缺文件：${name}`);
}
ok(`入口与文档齐备（${required.length} 项）`);

// Every relative import inside lib/ must resolve within the package.
const libFiles = paths.filter((p) => p.startsWith('lib/') && p.endsWith('.js'));
if (!libFiles.length) bad('包里没有 lib/*.js');
for (const rel of libFiles) {
  const source = readFileSync(join(ROOT, rel), 'utf8');
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const target = join(dirname(rel), match[1]).split('\\').join('/');
    if (!paths.includes(target)) bad(`${rel} import 的 ${match[1]} 不在包内（缺 ${target}）`);
  }
}
ok(`lib 内 ${libFiles.length} 个模块的相对 import 全部落在包内`);

// Every bundled skill must ship its SKILL.md.
const missingSkill = [];
for (const skill of SKILLS) {
  if (!paths.includes(`skills/${skill.name}/SKILL.md`)) missingSkill.push(skill.name);
}
// authored skills are discovered from the extracted package below
if (missingSkill.length) bad(`缺 SKILL.md：${missingSkill.join(', ')}`);
else ok(`${SKILLS.length} 个导入 skill 的 SKILL.md 全部在包内（另含自撰 skill）`);
if (paths.some((p) => p.startsWith('tools/') || p.startsWith('authored/') || p.startsWith('test/'))) {
  bad('开发目录（tools/ authored/ test/）不应进包');
}

console.log('\n三、解包并真实加载');
execFileSync('tar', ['-xzf', tarball, '-C', workDir], { stdio: ['ignore', 'pipe', 'pipe'] });
const extracted = join(workDir, 'package');
if (!existsSync(extracted)) {
  bad('解包后没有 package/ 目录');
} else {
  const skillsDir = join(extracted, 'skills');
  const skillDirs = readdirSync(skillsDir)
    .filter((name) => statSync(join(skillsDir, name)).isDirectory())
    .sort();
  ok(`解包得到 ${skillDirs.length} 个 skill 目录`);

  // Line endings must be LF in the artifact: CRLF in a shipped shell script
  // breaks on Linux and macOS, and mixed endings make the tarball depend on the
  // machine that packed it.
  const crlf = [];
  for (const rel of paths) {
    if (!isTextPath(rel)) continue;
    const body = readFileSync(join(extracted, rel), 'utf8');
    if (body.includes('\r\n')) crlf.push(rel);
  }
  if (crlf.length) bad(`包内有 ${crlf.length} 个文本文件是 CRLF 行尾（如 ${crlf[0]}）`);
  else ok('包内文本文件行尾统一为 LF');

  // 文档一致性：跟**最后一次提交**比，不是跟工作区比。
  // 打包本身就取自工作区，拿包内内容跟工作区比是同一份，断言永远不会失败
  // （这一版最初就是那么写的，实测改一个字节后它照样通过）。
  // 真正要防的是「改了文档却没提交就打包发布」—— 那样包里的文档与仓库里的提交不一致，
  // 别人看到的 npm 页面就等于一份没进版本库的内容。npm 渲染的正是这份 README。
  const committed = (name) => {
    try {
      return execFileSync('git', ['show', `HEAD:${name}`], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return undefined;
    }
  };
  let compared = 0;
  let mismatched = 0;
  for (const name of ['README.md', 'CHANGELOG.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md']) {
    if (!paths.includes(name)) continue;
    const head = committed(name);
    if (head === undefined) {
      info(`${name} 不在 git HEAD 里，跳过一致性比对`);
      continue;
    }
    const packed = readFileSync(join(extracted, name), 'utf8');
    if (packed !== head) {
      bad(`${name} 与最后一次提交不一致 —— 改了文档却没提交就打包（npm 页面会显示未进版本库的版本）`);
      mismatched += 1;
    } else {
      compared += 1;
    }
  }
  if (!mismatched && compared) ok(`包内 ${compared} 个文档与最后一次提交逐字节一致`);

  // Import the extracted module, not the source tree: this is the code that
  // would actually run on an installer's machine.
  const mod = await import(pathToFileURL(join(extracted, 'lib', 'index.js')).href);
  if (typeof mod.apply !== 'function' || typeof mod.name !== 'string') {
    bad('导出不符合 DSH 插件契约（缺 name / apply）');
  } else {
    ok(`插件入口导出正常：name=${mod.name}`);
  }

  let captured;
  const ctx = { inject: (deps, fn) => fn({ skills: { registerProvider: (create) => { captured = create({ signal: undefined, invalidate: () => {} }); } } }) };
  mod.apply(ctx, {});  if (!captured) {
    bad('apply() 没有注册 provider');
  } else {
    const listed = await captured.list({});
    if (listed.length !== skillDirs.length) {
      bad(`provider 报告 ${listed.length} 个 skill，目录里有 ${skillDirs.length} 个`);
    } else {
      ok(`provider 从解包目录报告了 ${listed.length} 个 skill`);
    }
    const sample = listed.find((s) => s.name === 'video-pipeline') || listed[0];
    const loaded = await captured.get(sample, {});
    if (!loaded || loaded.content.length < 200) bad(`${sample.name} 正文加载失败`);
    else ok(`正文加载正常：${sample.name}（${loaded.content.length} 字符，rank ${sample.rank}，source ${sample.source}）`);

    // With no config and no environment, every token must fall back to its
    // built-in default: a leftover `{{TOKEN}}` means the placeholder table and
    // the bundled bodies disagree.
    const unresolved = new Set();
    for (const candidate of listed) {
      const body = await captured.get(candidate, {});
      for (const match of (body?.content || '').matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)) unresolved.add(match[1]);
    }
    if (unresolved.size) bad(`正文里有未解析的占位符：${[...unresolved].join(', ')}`);
    else ok('全部占位符都能取到默认值，正文无残留 token');
  }
}

if (!KEEP) rmSync(workDir, { recursive: true, force: true });
else console.log(`\n保留解包副本：${workDir}`);

console.log(`\n${problems.length ? `发布物检查未通过：${problems.length} 个问题` : '发布物检查通过'}`);
process.exit(problems.length ? 1 : 0);

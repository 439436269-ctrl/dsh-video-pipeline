#!/usr/bin/env node
/**
 * Preflight for publishing: one read-only command that answers "can this be
 * released right now, and what is still missing".
 *
 *   node tools/preflight.mjs            # 完整自检（含远端名字占用与凭据探测）
 *   node tools/preflight.mjs --offline  # 只跑本地检查，不碰网络
 *
 * Writes nothing, pushes nothing, publishes nothing. Local failures exit
 * non-zero (they are things to fix); missing credentials are reported
 * separately, because they are an external condition rather than a defect —
 * the point of the command is to make the difference explicit instead of
 * discovering it halfway through a release.
 *
 * Not for CI: it probes the network, the local credential store and the local
 * git repo, none of which exist on a runner. CI runs the privacy gate and the
 * artifact check (see .github/workflows/ci.yml).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OFFLINE = process.argv.includes('--offline');

const OWNER = '439436269-ctrl';
const REPO = 'dsh-video-pipeline';

const failures = [];
const blockers = [];
const ok = (m) => console.log(`  ✅ ${m}`);
const fail = (m) => { console.log(`  ❌ ${m}`); failures.push(m); };
const external = (m) => { console.log(`  ⏳ ${m}`); blockers.push(m); };
const info = (m) => console.log(`  ·  ${m}`);

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/** Run a command, returning `{ ok, stdout, stderr }` instead of throwing. */
function run(command, args, options = {}) {
  try {
    const stdout = execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
    return { ok: true, stdout, stderr: '' };
  } catch (error) {
    return { ok: false, stdout: String(error.stdout || ''), stderr: String(error.stderr || error.message || '') };
  }
}

/** HTTP status for a URL, or `undefined` when the network refused. */
async function status(url) {
  try {
    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
    return response.status;
  } catch {
    return undefined;
  }
}

console.log('\n一、包清单（市场收录的硬性要求）');
if (pkg.dsh?.bundle?.patch) {
  const patch = join(ROOT, pkg.dsh.bundle.patch);
  if (existsSync(patch)) ok(`dsh.bundle.patch → ${pkg.dsh.bundle.patch} 存在`);
  else fail(`dsh.bundle.patch 指向 ${pkg.dsh.bundle.patch}，但文件不存在`);
} else {
  fail('package.json 没有 dsh.bundle.patch —— 只声明 dsh.client 的包无法安装，市场会打回');
}
if (pkg.author?.url?.includes('github.com')) ok(`署名与主页：${pkg.author.name} / ${pkg.author.url}`);
else fail('author.url 缺少 GitHub 主页');
if (pkg.repository?.url?.includes(`${OWNER}/${REPO}`)) ok(`repository 指回目标仓库（npm 与市场靠它关联）`);
else fail(`repository 未指向 ${OWNER}/${REPO} —— npm 包不会与市场条目关联`);
for (const entry of ['lib/**/*.js', 'skills/**']) {
  if (pkg.files?.includes(entry)) ok(`files 白名单含 ${entry}`);
  else fail(`files 白名单缺 ${entry}`);
}
if (pkg.files?.some((f) => /^lib\/\*\.js$/.test(f))) fail('files 用 lib/*.js 会漏子目录，应为 lib/**/*.js');

/** Fetch JSON, returning `undefined` when the network or the parse fails. */
async function json(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}

console.log('\n二、远端名字占用');
if (OFFLINE) {
  info('--offline：跳过');
} else {
  const npmStatus = await status(`https://registry.npmjs.org/${pkg.name}`);
  if (npmStatus === 404) {
    ok(`npm 名字空闲：${pkg.name}（首发）`);
  } else if (npmStatus === 200) {
    // A name being taken is normal once you own the package, so the check that
    // matters is whether *this* version is already out and whether the package
    // is ours. `maintainers` is public, so ownership is verifiable without a token.
    const packument = await json(`https://registry.npmjs.org/${pkg.name}`);
    const versions = Object.keys(packument?.versions ?? {});
    const maintainers = (packument?.maintainers ?? []).map((m) => m?.name).filter(Boolean);
    const latest = packument?.['dist-tags']?.latest;
    if (versions.includes(pkg.version)) {
      fail(`npm 上 ${pkg.name}@${pkg.version} 已经发布了（latest=${latest}）—— 要发新版本请先改 package.json 的 version`);
    } else {
      ok(`npm 名字已存在：${pkg.name}（maintainers: ${maintainers.join(', ') || '未公开'}，latest=${latest}）；待发版本 ${pkg.version} 尚未发布`);
      if (maintainers.length && pkg.author?.name && !maintainers.includes(pkg.author.name)) {
        fail(`该包的 maintainers（${maintainers.join(', ')}）不含 package.json 的 author.name（${pkg.author.name}）—— 确认这是你要发的包`);
      }
    }
  } else {
    info(`npm 查询返回 HTTP ${npmStatus}`);
  }

  const repoStatus = await status(`https://api.github.com/repos/${OWNER}/${REPO}`);
  if (repoStatus === 404) ok(`GitHub 仓库还没建：${OWNER}/${REPO}`);
  else if (repoStatus === 200) info(`GitHub 仓库已存在：${OWNER}/${REPO}（将更新）`);
  else info(`GitHub 查询返回 HTTP ${repoStatus}`);
}

console.log('\n三、git 状态');
const inRepo = run('git', ['rev-parse', '--is-inside-work-tree']).ok;
if (!inRepo) {
  fail('当前不是 git 仓库');
} else {
  const dirty = run('git', ['status', '--porcelain']).stdout.trim();
  if (dirty) fail(`工作区有未提交改动（${dirty.split('\n').length} 项）`);
  else ok('工作区干净');
  const commits = run('git', ['rev-list', '--count', 'HEAD']).stdout.trim();
  ok(`提交数：${commits}`);
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (branch === 'main') ok('分支：main');
  else info(`分支是 ${branch}（市场/CI 约定用 main）`);
  const remote = run('git', ['remote', 'get-url', 'origin']);
  if (remote.ok) info(`origin：${remote.stdout.trim()}`);
  else info('还没配 origin（发布时再加）');
}

console.log('\n四、本地门（发布前必须全绿）');
for (const [label, script] of [['隐私门', 'privacy-gate'], ['单测', 'test'], ['发布物检查', 'verify:artifact'], ['仓库元数据检查', 'verify:metadata']]) {
  const result = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script, '--silent'], { shell: process.platform === 'win32' });
  if (result.ok) ok(`${label}通过`);
  else fail(`${label}未通过：${(result.stderr || result.stdout).trim().split('\n').slice(-3).join(' / ')}`);
}

console.log('\n五、发布凭据（外部条件，不是包的问题）');
const secrets = join(process.env.USERPROFILE || process.env.HOME || '', '.secrets', 'keys.env');
const hasNpmToken = Boolean(process.env.NPM_AUTOMATION_TOKEN)
  || (existsSync(secrets) && /NPM_AUTOMATION_TOKEN\s*=/.test(readFileSync(secrets, 'utf8')));
if (hasNpmToken) ok('npm Automation token 可用');
else external(`npm token 缺失：放到 ${secrets} 一行 NPM_AUTOMATION_TOKEN=...（或设同名环境变量）`);

if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
  ok('GitHub token 可用（环境变量）');
} else {
  // 非交互探测：禁掉提示与 GCM 弹窗，否则这条命令会挂住等人工输入。
  const probe = run('git', ['-c', 'credential.interactive=false', 'credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 10000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
  });
  if (probe.ok && /^password=/m.test(probe.stdout)) ok('GitHub 凭据已存在（凭据管理器）');
  else external('GitHub 凭据未存：首次 git push 会弹凭据管理器窗口，或提供 GITHUB_TOKEN');
}

console.log('\n六、发布顺序');
console.log('  1. 建 GitHub 仓库并推送  —— README 顶部的编排图与 screenshots.json 都指向该仓库的 raw 地址；仓库公开后图才显示');
console.log('  2. npm publish            —— staged publishing：promote 窗口实测 2~12 分钟，窗口期内 latest 未更新或同版本 409 都非失败');
console.log('  3. 市场 PR                —— 仓库需创建满 1 天（CI 自动检查仓库年龄）；条目内容在 publish/market-entry.yml');
console.log('  坐标与命令：PUBLISH.md');

console.log('');
if (failures.length) {
  console.log(`自检未通过：${failures.length} 个问题需要修`);
  process.exit(1);
}
if (blockers.length) {
  console.log(`本地检查全绿；可以发布，还差 ${blockers.length} 个外部条件：`);
  for (const b of blockers) console.log(`  · ${b}`);
  process.exit(0);
}
console.log('自检全绿，外部条件齐备：可以按上面的顺序发布。');

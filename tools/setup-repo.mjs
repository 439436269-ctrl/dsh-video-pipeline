#!/usr/bin/env node
/**
 * Create the GitHub repository for this plugin and push `main`.
 *
 *   node tools/setup-repo.mjs --check     # 只自检：凭据、仓库状态、本地 git（不写任何东西）
 *   node tools/setup-repo.mjs             # 建仓（已存在则跳过）+ 设 topics + push + 核对远端 SHA
 *   node tools/setup-repo.mjs --no-push   # 只建仓与设 topics
 *
 * Why a script: the repository must be public with the `dsh-plugin` topic for
 * the plugin ecosystem to find it, the market entry links to it by exact URL,
 * and the README image points at its raw path — three places that silently
 * break if the remote is created by hand with a different name or visibility.
 * It is also the only irreversible step left, so it verifies the remote SHA
 * afterwards instead of trusting "the command did not error".
 *
 * Token resolution: `GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_PAT` from the
 * environment, else the same names in `~/.secrets/keys.env`. The token is never
 * printed and never written into `.git/config`: the push uses a token-bearing
 * URL once, then the remote is reset to the clean URL. Any captured output is
 * scrubbed of the token before it is shown, because git echoes the URL.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CHECK = process.argv.includes('--check');
const NO_PUSH = process.argv.includes('--no-push');
const BRANCH = 'main';

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const owner = (pkg.repository?.url?.match(/github\.com[/:]([^/]+)\//) ?? [])[1];
const repo = pkg.name;
if (!owner) {
  console.error('package.json 的 repository.url 里没有 GitHub owner');
  process.exit(1);
}

/** Topics must be lowercase ASCII; a non-ASCII one makes the whole PUT 422. */
const TOPICS = ['dsh', 'dsh-plugin', 'deepseek-harness', 'cordis', 'skill', 'video', 'ffmpeg'];
const DESCRIPTION = 'DSH 插件：把一条短视频生产流水线（19 个 skill：编排 + 原子）内置进 agent 技能目录';
const HOMEPAGE = `https://www.npmjs.com/package/${repo}`;

const problems = [];
const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m) => { console.log(`  ❌ ${m}`); problems.push(m); };
const info = (m) => console.log(`  ·  ${m}`);
const step = (m) => console.log(`\n${m}`);

/** Read a token without ever surfacing it. */
function readToken() {
  for (const name of ['GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_PAT']) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  const secrets = join(process.env.USERPROFILE || process.env.HOME || '', '.secrets', 'keys.env');
  if (existsSync(secrets)) {
    for (const name of ['GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_PAT']) {
      const match = readFileSync(secrets, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*(\\S+)`, 'm'));
      if (match) return match[1];
    }
  }
  return '';
}

const TOKEN = readToken();
/** Strip the token from anything we print — git echoes URLs that carry it. */
const scrub = (text) => (TOKEN ? String(text).split(TOKEN).join('<token>') : String(text));

function git(args, options = {}) {
  try {
    return {
      ok: true,
      stdout: execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }),
    };
  } catch (error) {
    return { ok: false, stdout: '', stderr: scrub(error.stderr || error.message || '') };
  }
}

async function api(method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      // 只在真的有 token 时才带这个头：空的 `Bearer ` 会让 GitHub 对公开仓库
      // 也回 401，把「仓库不存在」误报成「查询失败」。
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      'user-agent': 'dsh-video-pipeline-setup',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: scrub(text).slice(0, 300) }; }
  return { status: response.status, body: parsed };
}

step('一、本地 git 状态');
const inRepo = git(['rev-parse', '--is-inside-work-tree']).ok;
if (!inRepo) bad('当前不是 git 仓库');
else {
  const dirty = git(['status', '--porcelain']).stdout.trim();
  if (dirty) bad(`工作区有未提交改动（${dirty.split('\n').length} 项）—— 先提交再建仓`);
  else ok('工作区干净');
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (branch === BRANCH) ok(`分支：${BRANCH}`);
  else bad(`当前分支是 ${branch}，脚本按 ${BRANCH} 推送`);
}
const localHead = git(['rev-parse', 'HEAD']).stdout.trim();
if (localHead) ok(`本地 HEAD：${localHead.slice(0, 7)}`);

step('二、凭据');
if (TOKEN) ok('已找到 GitHub token（来源：环境变量或 ~/.secrets/keys.env）');
else bad('没有 GitHub token：设 GITHUB_TOKEN，或在 ~/.secrets/keys.env 里加一行');

let login;
let authOk = false;
if (TOKEN) {
  const who = await api('GET', '/user');
  if (who.status === 200 && who.body?.login) {
    login = who.body.login;
    authOk = true;
    ok(`token 账号：${login}`);
    if (login !== owner) bad(`token 属于 ${login}，但 repository.url 指向 ${owner} —— 推不到那个仓库`);
  } else {
    bad(`token 无效或权限不足（HTTP ${who.status}：${who.body?.message ?? ''}）`);
  }
}

step('三、目标仓库');
let repoExists = false;
if (TOKEN && !authOk) {
  // 凭据无效时这一项必然 401，那是上面那条的后果而不是独立发现 —— 报一次就够。
  info('跳过仓库查询：上面的凭据无效，先修那一条');
} else {
  const existing = await api('GET', `/repos/${owner}/${repo}`);
  if (existing.status === 200) {
    repoExists = true;
    ok(`已存在：${existing.body.full_name}（private=${existing.body.private}，默认分支 ${existing.body.default_branch}）`);
    if (existing.body.private) bad('仓库是 private —— 市场与 topic 检索都要求 public');
    const topics = existing.body.topics ?? [];
    if (topics.includes('dsh-plugin')) ok('topics 已含 dsh-plugin');
    else info(`topics 目前：${topics.join(', ') || '（空）'} —— 本次会补齐`);
  } else if (existing.status === 404) {
    info(`尚未创建：${owner}/${repo}（本次会创建为 public）`);
  } else {
    bad(`查询仓库失败：HTTP ${existing.status}`);
  }
}
info(`目标 topics：${TOPICS.join(', ')}`);
const badTopic = TOPICS.find((t) => !/^[a-z0-9-]+$/.test(t));
if (badTopic) bad(`topic "${badTopic}" 不是小写 ASCII —— PUT /topics 会整批 422`);

if (CHECK) {
  step(`自检结束：${problems.length ? `${problems.length} 个问题` : '一切就绪，去掉 --check 即可执行'}`);
  process.exit(problems.length ? 1 : 0);
}

if (problems.length) {
  console.error('\n自检没过，先修问题再执行。');
  process.exit(1);
}

step('四、建仓（幂等）');
if (!repoExists) {
  const created = await api('POST', '/user/repos', {
    name: repo,
    description: DESCRIPTION,
    homepage: HOMEPAGE,
    private: false,
    has_issues: true,
    has_wiki: false,
    has_projects: false,
    auto_init: false,
  });
  if (created.status === 201) ok(`已创建：${created.body.full_name}`);
  else {
    console.error(`建仓失败：HTTP ${created.status} ${JSON.stringify(created.body).slice(0, 300)}`);
    process.exit(1);
  }
} else {
  ok('仓库已存在，跳过创建');
}

const topicsResult = await api('PUT', `/repos/${owner}/${repo}/topics`, { names: TOPICS });
if (topicsResult.status === 200) ok(`topics 已设置：${(topicsResult.body.topics ?? []).join(', ')}`);
else info(`设置 topics 返回 HTTP ${topicsResult.status}（${topicsResult.body?.message ?? ''}）—— 可稍后重跑`);

if (NO_PUSH) {
  console.log(`\n--no-push：未推送。仓库：https://github.com/${owner}/${repo}`);
  process.exit(0);
}

step('五、推送');
if (!TOKEN) {
  console.error('推送需要 token。');
  process.exit(1);
}
const cleanUrl = `https://github.com/${owner}/${repo}.git`;
const tokenUrl = `https://x-access-token:${TOKEN}@github.com/${owner}/${repo}.git`;
git(['remote', 'remove', 'origin']);
git(['remote', 'add', 'origin', tokenUrl]);
const push = git(['push', '-u', 'origin', `${BRANCH}:${BRANCH}`]);
if (!push.ok) {
  console.error(`推送失败：${push.stderr}`);
  git(['remote', 'set-url', 'origin', cleanUrl]);
  process.exit(1);
}
// 已经到达远端后再把带 token 的 URL 换回干净地址，别把它留在 .git/config 里。
git(['remote', 'set-url', 'origin', cleanUrl]);
ok('已推送，remote 里的 token 已换成干净地址');

step('六、核对远端（不只看命令没报错）');
const lsRemote = git(['ls-remote', 'origin', `refs/heads/${BRANCH}`]);
const remoteSha = lsRemote.stdout.trim().split(/\s+/)[0] ?? '';
if (remoteSha && remoteSha === localHead) ok(`远端 ${BRANCH} == 本地 HEAD（${remoteSha.slice(0, 7)}）`);
else if (remoteSha) bad(`远端 ${BRANCH} 是 ${remoteSha.slice(0, 7)}，本地 HEAD 是 ${localHead.slice(0, 7)}`);
else bad('拿不到远端 HEAD');

const finalRepo = await api('GET', `/repos/${owner}/${repo}`);
if (finalRepo.status === 200) {
  ok(`仓库可访问：${finalRepo.body.html_url}  topics=${(finalRepo.body.topics ?? []).join(', ')}`);
  info(`创建时间 ${finalRepo.body.created_at} —— 市场 PR 要求仓库满 1 天`);
}

console.log(`\n下一步：仓库满 1 天后，把 publish/market-entry.yml 的内容写到 awesome-dsh-plugin 的 data/plugins/${owner}__${repo}.yml 并提 PR。`);
process.exit(problems.length ? 1 : 0);

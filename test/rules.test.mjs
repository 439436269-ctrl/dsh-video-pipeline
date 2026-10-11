/**
 * Regression tests for the import rules.
 *
 * Every case here corresponds to a defect that actually shipped into a draft of
 * this package and was caught by a gate rather than by review. The privacy gate
 * covers the rules end to end, but only as a whole: a rule that silently stops
 * matching (or starts over-matching) can still leave the gate green in a way
 * that is easy to misread. These tests pin the specific failures.
 *
 * Run: node --test test/rules.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOC_FIXES,
  RESIDUAL_PATTERNS,
  dropReason,
  fixText,
  isTextPath,
  residualFindings,
  scrubText,
} from '../tools/scrub-rules.mjs';

test('dropReason matches a credential file whose rule is anchored (skill prefix must not defeat it)', () => {
  // Regression: switching dropReason() to receive `<skill>/<path>` silently
  // broke every `^name$` rule, so the real ARK key file was copied into the
  // package. The residual scan caught it; this test pins the rule itself.
  assert.match(dropReason('ark-agent-plan-image/ARK_KEY.txt') ?? '', /API key/);
  assert.match(dropReason('xiaohongshu-skills/tmp/login_status_cache.json') ?? '', /.+/);
  assert.match(dropReason('chinese-tts/scripts/__pycache__/pinyin_fix.cpython-312.pyc') ?? '', /.+/);
});

test('dropReason matches data snapshots at any depth', () => {
  // Regression: `^map-.*\.json$` did not match `scripts/heji/map-dushi.json`,
  // so real collection maps were treated as files to keep.
  assert.match(dropReason('bilibili-upload/scripts/heji/map-dushi.json') ?? '', /合集映射/);
  assert.match(dropReason('bilibili-upload/scripts/heji/map-ep11-dushi.json') ?? '', /.+/);
  assert.match(dropReason('tangshi-data-review/scripts/bili-stats.json') ?? '', /播放数据/);
  assert.match(dropReason('tencent-upload/scripts/heji/posts.json') ?? '', /发布记录/);
});

test('dropReason keeps capability files that only look like history', () => {
  for (const keep of [
    'tencent-upload/scripts/heji/do.mjs',
    'tencent-upload/scripts/heji/list.mjs',
    'bilibili-upload/scripts/heji/bili_api.mjs',
    'xiaohongshu-skills/LICENSE',
    'xiaohongshu-skills/scripts/cdp_publish.py',
    'xiaohongshu-skills/requirements.txt',
    'douyin-publish/scripts/heji/dy_add.mjs',
  ]) {
    assert.equal(dropReason(keep), undefined, `${keep} should ship`);
  }
});

test('scrubText rewrites the parameter name in prose but never breaks parsing code', () => {
  // Regression: an over-broad `encfilekey=...` rule rewrote the JavaScript
  // regex `/encfilekey=([^&]*)/` into `/encfilekey=<签名>&]*)/`.
  const code = "const m = (url || '').match(/encfilekey=([^&]*)/);";
  const { text, applied } = scrubText(code);
  assert.equal(text, code);
  assert.deepEqual(applied, []);

  // A real signed value is still reported by the residual scan.
  const signed = `encfilekey=${'A'.repeat(60)}&token=x`;
  assert.ok(residualFindings(signed).includes('平台签名 URL'));
});

test('scrubText replaces real account identifiers by shape, not by a known sample', () => {
  // Regression: only the one known BV id was replaced, leaving the rest of an
  // embedded EP→BV map intact.
  const { text } = scrubText('EP01: BV1Aiaj6vEkw, EP02: BV1XraJ6ZEo6, EP03: BV1N7aJ6LEEu');
  assert.equal(text, 'EP01: BV0000000000, EP02: BV0000000000, EP03: BV0000000000');
  assert.deepEqual(residualFindings(text), [], 'replaced ids must not look real');

  const finder = scrubText(`id=${'v2_' + 'a1b2c3d4e5f6a7b8'.repeat(2)}@finder`);
  assert.match(finder.text, /<你的视频号 FINDER_ID>/);
});

test('scrubText keeps Python identifiers parseable when an id is used as a variable name', () => {
  // Regression: the Feishu table id appeared as a bare Python identifier; a
  // `{{TOKEN}}` substitution there produced a syntax error.
  const source = 'BT = "KOIrbt4YqaWl05sXdjwczIJ5nei"\nTB = tblWEJxknewXos0D = "tblWEJxknewXos0D"\n';
  const { text } = scrubText(source);
  assert.match(text, /^BT = "\{\{FEISHU_BASE_APP\}\}"$/m);
  assert.match(text, /^TB = FEISHU_TABLE_ID = "\{\{FEISHU_TABLE\}\}"$/m);
  assert.doesNotMatch(text, /\{\{FEISHU_TABLE\}\}\s*=/);
});

test('residualFindings flags each identifier class the gate must not let through', () => {
  const samples = {
    'ARK API key': 'ark-1234abcd-5678-90ef-1111-222233334444',
    '飞书 base app_token': 'KOIrbt4YqaWl05sXdjwczIJ5nei',
    'NAS 绝对路径': '/sata1/public/分组',
    '内网地址': '192.168.1.3',
    '本机用户目录': 'C:\\Users\\19592\\x',
    '本机工作区': 'D:\\lcj\\codes',
    '视频号 FINDER_ID': 'v2_060000231003b20fa1b2c3d4@finder',
    '抖音 aweme_id 形态': '7691526833661119787',
    'B 站账号 UID': '34078814',
    '本机作者的已发稿件号': 'BV1Aiaj6vEkw',
  };
  for (const [label, sample] of Object.entries(samples)) {
    assert.ok(residualFindings(sample).includes(label), `${label} not detected in ${sample}`);
  }
  assert.deepEqual(residualFindings('ffmpeg -vf crop=864:545 scale=1146:717'), []);
});

test('isTextPath treats extension-less and dot files as text', () => {
  // Regression: extname('LICENSE') and extname('.gitkeep') are both '', so
  // these were copied as binary — escaping both the residual scan and the
  // line-ending check, which is how a CRLF LICENSE survived into the package.
  assert.ok(isTextPath('LICENSE'));
  assert.ok(isTextPath('xiaohongshu-skills/LICENSE'));
  assert.ok(isTextPath('images/publish_temp/.gitkeep'));
  assert.ok(isTextPath('scripts/heji/do.mjs'));
  assert.equal(isTextPath('references/orchestration-flow.png'), false);
});

test('fixText marks out-of-bundle skill mentions as external', () => {
  const line = '用 biliup 把视频投稿到 B站；配套 paper-bilibili-uploader 做论文视频投稿。';
  const { text, applied } = fixText(line);
  assert.match(text, /本包未包含/);
  assert.deepEqual(applied, ['配套 skill 标明为外部']);
  assert.equal(fixText('无关内容').applied.length, 0);
  for (const [pattern] of DOC_FIXES) {
    assert.ok(pattern instanceof RegExp);
  }
});

test('every residual pattern is a RegExp with a non-empty description', () => {
  for (const entry of RESIDUAL_PATTERNS) {
    assert.ok(entry[0] instanceof RegExp);
    assert.ok(typeof entry[1] === 'string' && entry[1].length > 0);
  }
});

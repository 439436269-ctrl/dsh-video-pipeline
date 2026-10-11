/**
 * Provider tests.
 *
 * Two layers: fixtures exercise the discovery and parsing rules (including the
 * malformed cases that must be dropped rather than silently admitted), and a
 * final integration block runs the same provider over the real `skills/`
 * directory so a broken frontmatter edit in any bundled skill fails the suite
 * instead of silently shrinking the catalog.
 *
 * Run: node test/provider.test.mjs
 */

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { invocationPolicy, parseBoolean, parseFrontmatter } from '../lib/frontmatter.js';
import { applyPlaceholders, findPlaceholders, resolvePlaceholders } from '../lib/placeholders.js';
import { BUNDLED_SKILL_RANK, createBundledSkillProvider, PROVIDER_NAME, isSkillName } from '../lib/provider.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(HERE, '..', 'skills');

/** Build a fixture skills directory and return its path. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-video-pipeline-'));
  mkdirSync(join(root, 'bundle-skill'), { recursive: true });
  writeFileSync(join(root, 'bundle-skill', 'SKILL.md'), [
    '---',
    'name: bundle-skill',
    'description: |',
    '  第一行描述。',
    '  Second line of the description.',
    'metadata:',
    '  trigger: 测试触发',
    '---',
    '',
    '# Body',
    '',
    '工作区在 {{WORKSPACE}}，home 在 {{USER_HOME}}。',
    '未知占位符 {{NOT_A_REAL_TOKEN}} 保持原样。',
    '',
  ].join('\n'));
  writeFileSync(join(root, 'flat-skill.md'), [
    '---',
    'name: flat-skill',
    'description: >',
    '  A flat skill whose description',
    '  is folded onto one line.',
    'disable-model-invocation: yes',
    '---',
    '',
    'flat body',
  ].join('\n'));
  writeFileSync(join(root, 'user-only.md'), '---\nname: user-only\ndescription: hidden from the model\nuser-invocable: true\ndisable-model-invocation: 1\n---\n\nbody\n');
  writeFileSync(join(root, 'Bad_Name.md'), '---\nname: Bad_Name\ndescription: not kebab-case\n---\n\nbody\n');
  writeFileSync(join(root, 'no-description.md'), '---\nname: no-description\n---\n\nbody\n');
  writeFileSync(join(root, 'bad-boolean.md'), '---\nname: bad-boolean\ndescription: has an unusable boolean\nuser-invocable: sometimes\n---\n\nbody\n');
  writeFileSync(join(root, 'no-frontmatter.md'), '# no frontmatter here\n');
  mkdirSync(join(root, 'empty-dir'));
  return root;
}

test('parseFrontmatter reads inline scalars, block scalars and nested maps', () => {
  const literal = parseFrontmatter('---\nname: a-b\ndescription: |\n  one\n  two\n---\nbody\n');
  assert.equal(literal.attrs.name, 'a-b');
  assert.equal(literal.attrs.description, 'one\ntwo');
  assert.equal(literal.body, 'body\n');

  const folded = parseFrontmatter('---\nname: a-b\ndescription: >\n  one\n  two\n---\n');
  assert.equal(folded.attrs.description, 'one two');

  const nested = parseFrontmatter('---\nname: a-b\ndescription: d\nmetadata:\n  trigger: t\n  source: s\n---\n');
  assert.deepEqual(nested.attrs.metadata, { trigger: 't', source: 's' });
});

test('parseFrontmatter rejects files without a delimited block', () => {
  assert.throws(() => parseFrontmatter('# heading only\n'), /frontmatter/);
  assert.throws(() => parseFrontmatter('---\nname: a-b\n'), /frontmatter/);
});

test('parseBoolean accepts the documented spellings and rejects the rest', () => {
  for (const word of ['true', 'TRUE', 'yes', 'on', '1', true]) assert.equal(parseBoolean(word), true);
  for (const word of ['false', 'No', 'off', '0', false]) assert.equal(parseBoolean(word), false);
  for (const word of ['sometimes', '', 3, null]) assert.equal(parseBoolean(word), undefined);
});

test('invocationPolicy maps the two frontmatter switches', () => {
  assert.deepEqual(invocationPolicy({}).policy, { modelInvocable: true, userInvocable: true });
  assert.deepEqual(invocationPolicy({ 'disable-model-invocation': true }).policy, { modelInvocable: false, userInvocable: true });
  assert.deepEqual(invocationPolicy({ 'user-invocable': false }).policy, { modelInvocable: true, userInvocable: false });
  assert.ok(invocationPolicy({ 'user-invocable': 'sometimes' }).error);
});

test('isSkillName enforces kebab-case', () => {
  assert.ok(isSkillName('video-compose'));
  assert.ok(isSkillName('a1-b2'));
  for (const bad of ['Video_Compose', 'video compose', '-leading', 'trailing-', '']) assert.ok(!isSkillName(bad));
});

test('resolvePlaceholders prefers config over environment over defaults', () => {
  const map = resolvePlaceholders({ WORKSPACE: 'C:\\from-config' }, { WORKSPACE: 'C:\\from-env', ARK_API_KEY: 'ark-xyz' });
  assert.equal(map.WORKSPACE, 'C:\\from-config');
  assert.equal(map.ARK_API_KEY, 'ark-xyz');
  assert.match(map.FEISHU_BASE_APP, /^</);
  assert.equal(resolvePlaceholders({}, {}).NAS_HOST, '<NAS 主机>');
});

test('applyPlaceholders substitutes known tokens and preserves unknown ones', () => {
  const text = applyPlaceholders('a {{WORKSPACE}} b {{NOPE}} c', { WORKSPACE: 'W' });
  assert.equal(text, 'a W b {{NOPE}} c');
  assert.deepEqual(findPlaceholders('{{A}} {{B}} {{A}}'), ['A', 'B']);
});

test('provider discovers bundles and flat skills, dropping malformed entries', async () => {
  const root = fixture();
  try {
    const warnings = [];
    const provider = createBundledSkillProvider({ skillsDir: root, onWarn: (m) => warnings.push(m) });
    const listed = await provider.list({});
    assert.equal(provider.name, PROVIDER_NAME);
    assert.deepEqual(listed.map((s) => s.name), ['bundle-skill', 'flat-skill', 'user-only']);
    for (const candidate of listed) {
      assert.equal(candidate.rank, BUNDLED_SKILL_RANK);
      assert.equal(candidate.source, 'bundled');
      assert.equal(candidate.provider, PROVIDER_NAME);
      assert.equal(candidate.resourceBase.kind, 'directory');
    }
    assert.equal(warnings.filter((w) => w.includes('Bad_Name')).length, 1);
    assert.ok(warnings.some((w) => w.includes('no-description')));
    assert.ok(warnings.some((w) => w.includes('bad-boolean')));
    assert.ok(warnings.some((w) => w.includes('no-frontmatter')));
    assert.ok(warnings.some((w) => w.includes('empty-dir')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('provider resolves placeholders in bodies and descriptions, and honors enabledSkills', async () => {
  const root = fixture();
  try {
    const provider = createBundledSkillProvider({
      skillsDir: root,
      placeholderMap: { WORKSPACE: 'C:\\work', USER_HOME: 'C:\\Users\\someone' },
    });
    const bundle = (await provider.list({})).find((s) => s.name === 'bundle-skill');
    const loaded = await provider.get(bundle, {});
    assert.match(loaded.content, /工作区在 C:\\work/);
    assert.match(loaded.content, /home 在 C:\\Users\\someone/);
    assert.match(loaded.content, /\{\{NOT_A_REAL_TOKEN\}\}/);
    assert.equal(loaded.resourceBase.path, join(root, 'bundle-skill'));

    const flat = (await provider.list({})).find((s) => s.name === 'flat-skill');
    assert.equal(flat.invocation.modelInvocable, false);
    assert.match((await provider.get(flat, {})).description, /folded onto one line/);

    const filtered = createBundledSkillProvider({ skillsDir: root, enabledSkills: ['flat-skill'] });
    assert.deepEqual((await filtered.list({})).map((s) => s.name), ['flat-skill']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('provider reports an unreadable skills directory instead of throwing', async () => {
  const warnings = [];
  const provider = createBundledSkillProvider({ skillsDir: join(HERE, 'does-not-exist'), onWarn: (m) => warnings.push(m) });
  assert.deepEqual(await provider.list({}), []);
  assert.equal(warnings.length, 1);
});

test('every bundled skill parses, is kebab-case, and carries a description', async () => {
  const warnings = [];
  const provider = createBundledSkillProvider({ skillsDir: SKILLS_DIR, onWarn: (m) => warnings.push(m) });
  const listed = await provider.list({});
  assert.ok(listed.length >= 15, `expected the bundled catalog, got ${listed.length} skills`);
  for (const candidate of listed) {
    assert.ok(isSkillName(candidate.name), `${candidate.name} is not kebab-case`);
    assert.ok(candidate.description.length > 20, `${candidate.name} description is too short`);
    const loaded = await provider.get(candidate, {});
    assert.ok(loaded && loaded.content.length > 100, `${candidate.name} body is unexpectedly short`);
    assert.ok(!loaded.content.includes('{{NOT_A_REAL_TOKEN}}'));
  }
  assert.deepEqual(warnings, [], `bundled skills produced warnings:\n${warnings.join('\n')}`);
});

test('bundled skill bodies carry no unresolved placeholder outside the known token set', async () => {
  const known = new Set(Object.keys(resolvePlaceholders({}, {})));
  const provider = createBundledSkillProvider({ skillsDir: SKILLS_DIR, placeholderMap: {} });
  for (const candidate of await provider.list({})) {
    const raw = (await provider.get(candidate, {})).content;
    for (const token of findPlaceholders(raw)) {
      assert.ok(known.has(token), `${candidate.name} uses unknown placeholder {{${token}}}`);
    }
  }
});

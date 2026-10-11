import fs from 'node:fs';
const t = JSON.parse(fs.readFileSync(new URL('./tables.json', import.meta.url), 'utf8'));
const f = (n) => (typeof n === 'number' ? n.toFixed(1) : 'N/A');

console.log('## 分组汇总（播放 / 均值 / 平均发布时长h）');
for (const [g, ps] of Object.entries(t.summary)) {
  for (const [p, v] of Object.entries(ps)) {
    console.log(`${g} | ${p} | n=${v.n} play=${v.play} avgPlay=${f(v.avgPlay)} avgH=${f(v.avgHours)} durs=[${(v.durs || []).join(',')}]`);
  }
}

console.log('\n## A vs B');
for (const [g, ps] of Object.entries(t.avb)) {
  for (const [p, v] of Object.entries(ps)) {
    const A = v.A, B = v.B;
    console.log(
      `${g} | ${p} | A n=${A.n} play=${A.play} avg=${f(A.avgPlay)} perDay=${f(A.perDayAvg)} || B n=${B.n} play=${B.play} avg=${f(B.avgPlay)} perDay=${f(B.perDayAvg)} || B/A=${A.play ? (B.play / A.play).toFixed(2) : 'N/A'}`
    );
  }
}

console.log('\n## 长短（<40s 短 vs >=40s 长）');
for (const [g, ps] of Object.entries(t.durSplit)) {
  for (const [p, v] of Object.entries(ps)) {
    console.log(
      `${g} | ${p} | short n=${v.short.n} play=${v.short.play} avg=${f(v.short.avgPlay)} perDay=${f(v.short.perDayAvg)} || long n=${v.long.n} play=${v.long.play} avg=${f(v.long.avgPlay)} perDay=${f(v.long.perDayAvg)}`
    );
  }
}

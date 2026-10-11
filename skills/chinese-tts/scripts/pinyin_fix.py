#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pinyin_fix — 中文 TTS 读音校正（原子：文本进，TTS 安全文本出）。

原理：多音字在默认语言模型下常被念错（朝→cháo、还→hái…），TTS 的 context
风格指令纠不了读音。对**已确认的词组**做同音字替换，发音必然正确；字幕/SRT
仍用原文。未覆盖的高危字只告警不擅改，交人裁决。

  fix   应用已知替换 → stdout 输出安全文本；--json 同时输出 applied/warnings
  check 只诊断，不改写（exit code: 0=干净 1=有高危未覆盖）

规则表内置 + `--table extra.json` 追加（格式 [{"phrase","repl","pinyin","why"}]）。
"""
import argparse
import json
import re
import sys

# 词组级替换（只在确认安全的语境下替换；按长词优先匹配）
RULES = [
    # 朝 zhāo（默认常被念成 cháo）
    {"phrase": "朝辞", "repl": "招辞", "pinyin": "zhāo cí", "why": "早发白帝城"},
    {"phrase": "朝如青丝", "repl": "招如青丝", "pinyin": "zhāo rú", "why": "将进酒·朝如青丝暮成雪（收窄至青丝防「六朝如梦」误命中）"},
    {"phrase": "朝雨", "repl": "招雨", "pinyin": "zhāo yǔ", "why": "渭城曲·朝雨"},
    {"phrase": "朝露", "repl": "招露", "pinyin": "zhāo lù", "why": "白露朝露"},
    {"phrase": "朝辞白帝", "repl": "招辞白帝", "pinyin": "zhāo", "why": "早发白帝城"},
    # 还 huán（默认常被念成 hái）
    {"phrase": "一日还", "repl": "一日环", "pinyin": "yī rì huán", "why": "早发白帝城"},
    {"phrase": "还给", "repl": "环给", "pinyin": "huán gěi", "why": "归还义"},
    {"phrase": "还了", "repl": "环了", "pinyin": "huán le", "why": "归还义"},
    {"phrase": "还乡", "repl": "环乡", "pinyin": "huán xiāng", "why": "还乡义"},
    {"phrase": "还家", "repl": "环家", "pinyin": "huán jiā", "why": "还家义"},
    {"phrase": "归还", "repl": "归环", "pinyin": "guī huán", "why": "归还义"},
    {"phrase": "还回", "repl": "环回", "pinyin": "huán huí", "why": "归还义"},
    # 重 chóng（默认常被念成 zhòng）
    {"phrase": "万重山", "repl": "万虫山", "pinyin": "wàn chóng shān", "why": "早发白帝城"},
    {"phrase": "千重", "repl": "千虫", "pinyin": "qiān chóng", "why": "层叠义"},
    {"phrase": "万重", "repl": "万虫", "pinyin": "wàn chóng", "why": "秋思·欲作家书意万重（层叠义避 zhòng）"},
    {"phrase": "九重", "repl": "九虫", "pinyin": "jiǔ chóng", "why": "层叠义"},
    {"phrase": "重山", "repl": "虫山", "pinyin": "chóng shān", "why": "层叠义"},
    # 骑 jì（名词·一人一马；默认常被念成 qí）
    {"phrase": "一骑", "repl": "一计", "pinyin": "yī jì", "why": "过华清宫·一骑红尘"},
    {"phrase": "单骑", "repl": "单计", "pinyin": "dān jì", "why": "名词义"},
    {"phrase": "铁骑", "repl": "铁计", "pinyin": "tiě jì", "why": "名词义"},
    # 教 jiào（使令义；默认常被念成 jiāo）
    {"phrase": "悔教", "repl": "悔叫", "pinyin": "huǐ jiào", "why": "闺怨·悔教夫婿"},
    {"phrase": "教得", "repl": "叫得", "pinyin": "jiào de", "why": "使令义"},
    # 少 shào（少小离家）
    {"phrase": "少小", "repl": "哨小", "pinyin": "shào xiǎo", "why": "回乡偶书·少小"},
    # 斜 xiá（古音保留，仅限石径斜）
    {"phrase": "石径斜", "repl": "石径瑕", "pinyin": "shí jìng xiá", "why": "山行·古音"},
    # 见 xiàn（通「现」）
    {"phrase": "见牛羊", "repl": "现牛羊", "pinyin": "xiàn niú yáng", "why": "敕勒歌·风吹草低"},
    {"phrase": "风吹草低见", "repl": "风吹草低现", "pinyin": "xiàn", "why": "敕勒歌"},
    # 燕 yān（地名/山名）
    {"phrase": "燕山", "repl": "烟山", "pinyin": "yān shān", "why": "燕山月似钩"},
    {"phrase": "燕国", "repl": "烟国", "pinyin": "yān guó", "why": "国名"},
    # 少数民族称谓等固定读音
    {"phrase": "单于", "repl": "缠于", "pinyin": "chán yú", "why": "匈奴称号"},
    {"phrase": "可汗", "repl": "克寒", "pinyin": "kè hán", "why": "突厥称号"},
    {"phrase": "吐谷浑", "repl": "吐玉浑", "pinyin": "tǔ yù hún", "why": "部族名"},
    # 幽咽 yè（咽 默认常被念成 yān/yàn）
    {"phrase": "幽咽", "repl": "幽夜", "pinyin": "yè", "why": "石壕吏·泣幽咽"},
    {"phrase": "呜咽", "repl": "呜夜", "pinyin": "yè", "why": "哭声义"},
    # 老妪 yù
    {"phrase": "老妪", "repl": "老玉", "pinyin": "yù", "why": "石壕吏·老妪力虽衰"},
    # 室中更无人 gèng（语义等价替换，非同音：更无=再无；字幕保留「更」）
    {"phrase": "室中更无", "repl": "室中再无", "pinyin": "gèng→zài", "why": "石壕吏·语义等价，避 gēng/gèng"},
    # 急应（应征义 yìng，易被念成 yīng）
    {"phrase": "急应", "repl": "急映", "pinyin": "yìng", "why": "石壕吏·急应河阳役"},
    {"phrase": "应征", "repl": "映征", "pinyin": "yìng zhēng", "why": "应召义"},
    # 千载 zǎi（同音铁律 2026-10-01：禁换词「千年」丢音，正解千宰）
    {"phrase": "千载", "repl": "千宰", "pinyin": "zǎi", "why": "黄鹤楼·听感保 zǎi（同音铁律正例）"},
    {"phrase": "万载", "repl": "万宰", "pinyin": "zǎi", "why": "年岁义同音保 zǎi"},
    {"phrase": "斗十千", "repl": "抖十千", "pinyin": "dǒu", "why": "行路难·金樽清酒斗十千（避 dòu）"},
    {"phrase": "冰塞", "repl": "冰色", "pinyin": "sè", "why": "行路难·欲渡黄河冰塞川（避 sāi/sài）"},
    {"phrase": "太行", "repl": "太航", "pinyin": "háng", "why": "行路难·将登太行雪满山（避 xíng）"},
    {"phrase": "放还", "repl": "放环", "pinyin": "huán", "why": "行路难B·赐金放还（避 hái）"},
    # 岑参 shēn（人名，避 cān/cēn）
    {"phrase": "岑参", "repl": "岑申", "pinyin": "shēn", "why": "白雪歌·作者名（避 cān）"},
    # 铁衣冷难着 zhuó（穿义，避 zhe/zháo）
    {"phrase": "难着", "repl": "难卓", "pinyin": "zhuó", "why": "白雪歌·都护铁衣冷难着（避 zhe/zháo）"},
    # 都护 dū（官名，引擎误读 dōu）
    {"phrase": "都护", "repl": "督护", "pinyin": "dū", "why": "白雪歌·都护铁衣（避 dōu）"},
    {"phrase": "满皇都", "repl": "满皇督", "pinyin": "dū", "why": "早春·绝胜烟柳满皇都（地名避 dōu）"},
    # 泊秦淮：笼 lǒng（引擎误 lóng）、泊 bó（引擎误 pō）
    {"phrase": "烟笼", "repl": "烟拢", "pinyin": "lǒng", "why": "泊秦淮·烟笼寒水（避 lóng）"},
    {"phrase": "月笼", "repl": "月拢", "pinyin": "lǒng", "why": "泊秦淮·月笼沙（避 lóng）"},
    {"phrase": "泊秦淮", "repl": "博秦淮", "pinyin": "bó", "why": "泊秦淮·诗题（避 pō）"},
    {"phrase": "夜泊", "repl": "夜博", "pinyin": "bó", "why": "泊秦淮·夜泊秦淮（避 pō）"},
    # 出塞：还 huán、飞将 jiàng、塞 sài（引擎分别误 hái/jiāng，题卡锁 sài）
    {"phrase": "人未还", "repl": "人未环", "pinyin": "huán", "why": "出塞·万里长征人未还（避 hái）"},
    {"phrase": "终不还", "repl": "终不环", "pinyin": "huán", "why": "从军行·不破楼兰终不还（NCC实测避 hái）"},
    {"phrase": "匹马还", "repl": "匹马环", "pinyin": "huán", "why": "塞下曲·不遣胡儿匹马还（避 hái）"},
    {"phrase": "飞将", "repl": "飞匠", "pinyin": "jiàng", "why": "出塞·龙城飞将在（避 jiāng）"},
    {"phrase": "出塞", "repl": "出赛", "pinyin": "sài", "why": "出塞·诗题（避 sè/sāi）"},
    # 茅屋为秋风所破歌
    {"phrase": "三重", "repl": "三虫", "pinyin": "chóng", "why": "茅屋·卷我屋上三重茅（避 zhòng）"},
    {"phrase": "挂罥", "repl": "挂绢", "pinyin": "juàn", "why": "茅屋·高者挂罥长林梢（生僻字锁音）"},
    {"phrase": "广厦", "repl": "广霎", "pinyin": "shà", "why": "茅屋·安得广厦千万间（避 xià）"},
    {"phrase": "见此屋", "repl": "现此屋", "pinyin": "xiàn", "why": "茅屋·突兀见此屋（通现 xiàn）"},
    # 将进酒
    {"phrase": "将进酒", "repl": "枪进酒", "pinyin": "qiāng", "why": "将进酒·诗题与原句（避 jiāng）"},
    {"phrase": "还复来", "repl": "环复来", "pinyin": "huán", "why": "将进酒·千金散尽还复来（避 hái）"},
    {"phrase": "斗酒", "repl": "抖酒", "pinyin": "dǒu", "why": "将进酒·斗酒十千（避 dòu）"},
    # 别董大：曛 生僻字锁音（引擎读 xūn 正确，保险替换）
    {"phrase": "日曛", "repl": "日熏", "pinyin": "xūn", "why": "别董大·白日曛（生僻字锁音）"},
    # 第三批 EP21-30 新增（2026-10-02 实测）
    # 受降 xiáng（边塞地名，避 jiàng）——夜上受降城闻笛
    {"phrase": "受降", "repl": "受详", "pinyin": "xiáng", "why": "受降城·回乐峰前（避 jiàng）"},
    # 鬓毛衰 cuī（古音，避 shuāi）——回乡偶书
    {"phrase": "鬓毛衰", "repl": "鬓毛催", "pinyin": "cuī", "why": "回乡偶书·乡音无改鬓毛衰（避 shuāi）"},
    # 夕阳斜 xiá（押麻韵古音 花/斜/家，避 xié）——乌衣巷
    {"phrase": "夕阳斜", "repl": "夕阳霞", "pinyin": "xiá", "why": "乌衣巷·乌衣巷口夕阳斜（押韵古音，避 xié）"},
    {"phrase": "日渐斜", "repl": "日渐瑕", "pinyin": "xiá", "why": "菊花·遍绕篱边日渐斜（押麻韵，避 xié）"},
    {"phrase": "御柳斜", "repl": "御柳霞", "pinyin": "xiá", "why": "寒食·寒食东风御柳斜（押麻韵 花/斜/家，避 xié）"},
    # 客舍 shè（避 shě）——送元二使安西
    {"phrase": "客舍", "repl": "客社", "pinyin": "shè", "why": "渭城曲·客舍青青（避 shě）"},
    # 尽 jìn（全部义，pypinyin 语境常误 jǐn）
    {"phrase": "尽望乡", "repl": "近望乡", "pinyin": "jìn", "why": "受降城·一夜征人尽望乡（避 jǐn）"},
    {"phrase": "更尽", "repl": "更近", "pinyin": "jìn", "why": "渭城曲·劝君更尽一杯酒（避 jǐn；尾钩同句复用）"},
    # 还寝 huán（归还义，避 hái）——望月怀远
    {"phrase": "还寝", "repl": "环寝", "pinyin": "huán", "why": "望月怀远·还寝梦佳期（避 hái）"},
    # 泊烟渚 bó（避 pō）——宿建德江
    {"phrase": "泊烟渚", "repl": "博烟渚", "pinyin": "bó", "why": "宿建德江·移舟泊烟渚（避 pō）"},
    # 第四批 EP31 新增（2026-10-02 实测）
    {"phrase": "轻骑", "repl": "轻计", "pinyin": "jì", "why": "塞下曲·欲将轻骑逐（名词避 qí）"},
    {"phrase": "塞下曲", "repl": "赛下取", "pinyin": "sài qǔ", "why": "塞下曲·诗题（避 sāi/qū）"},
    {"phrase": "西塞山", "repl": "西赛山", "pinyin": "sài", "why": "渔歌子·西塞山前白鹭飞（山名避 sāi）"},
    {"phrase": "铺水中", "repl": "扑水中", "pinyin": "pū", "why": "暮江吟·一道残阳铺水中（避 pù）"},
    # 第八批 EP75 新增（2026-10-07 实测）
    {"phrase": "属秋夜", "repl": "嘱秋夜", "pinyin": "zhǔ", "why": "秋夜寄邱员外·怀君属秋夜（适值义避 shǔ）"},
    {"phrase": "韦应物", "repl": "韦映物", "pinyin": "yìng", "why": "作者名（避 yīng）"},
    # 第九批 EP84/87 新增（2026-10-08 分镜预审）
    {"phrase": "没在石棱", "repl": "默在石棱", "pinyin": "mò", "why": "塞下曲·没在石棱中（隐没义避 méi）"},
    {"phrase": "大如斗", "repl": "大如抖", "pinyin": "dǒu", "why": "官仓鼠·大如斗（避 dòu）"},
    {"phrase": "像斗一样", "repl": "像抖一样", "pinyin": "dǒu", "why": "官仓鼠·量器义（避 dòu）"},
    {"phrase": "朝朝", "repl": "招招", "pinyin": "zhāo", "why": "官仓鼠·谁遣朝朝入君口（清晨义避 cháo）"},
    {"phrase": "飞得", "repl": "飞的", "pinyin": "de", "why": "塞下曲B·雁阵飞得（助词读音）"},
    # 第五批 EP45 新增（2026-10-03 实测）
    {"phrase": "更深", "repl": "耕深", "pinyin": "gēng", "why": "月夜·更深月色（避 gèng）"},
    {"phrase": "阑干", "repl": "阑竿", "pinyin": "lán gān", "why": "月夜·北斗阑干（锁音）"},
    {"phrase": "南斗", "repl": "南抖", "pinyin": "dǒu", "why": "月夜·南斗斜（星名避 dòu）"},
]

# 高危字：出现即提示人工确认（词组表未覆盖时不擅改）
RISK = {
    "朝": "zhāo/cháo — 看词义：朝霞/朝辞=zhāo，朝代/朝见=cháo",
    "还": "huán/hái — 归还义=huán，还有义=hái",
    "重": "chóng/zhòng — 层叠=chóng，分量=zhòng",
    "骑": "jì/qí — 一人一马（名词）=jì，骑乘（动词）=qí",
    "教": "jiào/jiāo — 使令义=jiào，教学义=jiāo",
    "少": "shào/shǎo — 年少=shào，多少=shǎo",
    "燕": "yān/yàn — 燕山/燕国=yān，燕子=yàn",
    "斜": "xiá/xié — 「石径斜」「夕阳斜」（乌衣巷押韵古音）=xiá（规则覆盖：夕阳霞），其余=xié",
    "泊": "bó/pō — 停泊/夜泊/泊烟渚=bó（规则覆盖：博），湖泊=pō",
    "著": "zhuó/zhù — 着衣义=zhuó，著作义=zhù",
    "衰": "cuī/shuāi — 「鬓毛衰」古音=cuī（规则覆盖：鬓毛催），衰落=shuāi",
    "舍": "shè/shě — 客舍/屋舍=shè（规则覆盖：客社），舍弃=shě",
    "尽": "jìn/jǐn — 全部义（尽望乡/更尽）=jìn（规则覆盖：近），尽量=jǐn",
    "降": "xiáng/jiàng — 受降城=xiáng（规则覆盖：受详），降落=jiàng",
    "中": "zhòng/zhōng — 中计/中伤=zhòng，中间=zhōng",
    "咽": "yè/yān/yàn — 幽咽/呜咽=yè，咽喉=yān，吞咽=yàn",
    "妪": "yù/ōu — 老妪=yù（已知规则覆盖），其余读法罕见",
    "更": "gèng/gēng — 更无/更加=gèng，更换/更夫=gēng",
    "戍": "shù — 守边义；勿与戌(xū)/戊(wù)混（TTS 通常正确，仅提示）",
    "应": "yìng/yīng — 应征/回应=yìng，应该=yīng",
    "载": "zǎi/zài — 千载/年岁=zǎi（规则覆盖：千宰），装载/记载=zài",
    "斗": "dǒu/dòu — 酒器/量词（斗十千）=dǒu（规则覆盖：抖），战斗=dòu",
    "塞": "sè/sāi/sài — 阻塞文读=sè（规则覆盖：冰色），塞子=sāi，边塞=sài",
    "行": "háng/xíng — 太行/行列=háng（规则覆盖：太航），行走=xíng",
    "参": "shēn/cān/cēn — 人名岑参=shēn（规则覆盖：岑申），参加=cān，参差=cēn",
    "着": "zhuó/zhe/zháo — 穿义（难着）=zhuó（规则覆盖：难卓），着落/睡着=zhe/zháo",
    "折": "zhé/shé — 风折断文读=zhé（人工确认即可），口语折了=shé",
    "饮": "yǐn/yìn — 宴饮/饮归客=yǐn，饮马（使动）=yìn",
    "笼": "lǒng/lóng — 笼罩义（烟笼/月笼）=lǒng（规则覆盖：烟拢/月拢），灯笼=lóng",
}


def build_rules(extra=None):
    rules = list(RULES)
    if extra:
        with open(extra, encoding="utf-8") as f:
            rules += json.load(f)
    # 长词优先
    rules.sort(key=lambda r: len(r["phrase"]), reverse=True)
    return rules


def apply_rules(text, rules):
    applied = []
    for r in rules:
        if r["phrase"] in text:
            n = text.count(r["phrase"])
            text = text.replace(r["phrase"], r["repl"])
            applied.append({**r, "count": n})
    return text, applied


def find_risks(text, applied):
    fixed_phrases = " ".join(a["phrase"] for a in applied)
    out = []
    for ch, hint in RISK.items():
        if ch in text:
            # 该字是否已落在某个已应用词组里
            if all(ch not in p for p in [a["phrase"] for a in applied]):
                out.append({"char": ch, "hint": hint, "count": text.count(ch)})
    return out


def cmd_pinyin(text):
    """逐字读音全量校验：整句语境读音 + 多音字逐字标 ⚠（附 RISK 提示）。"""
    from pypinyin import pinyin as py, Style
    n_risk = 0
    for para in text.split("\n"):
        para = para.strip()
        if not para:
            continue
        # 整句语境读音（词粒度；标点/拉丁字符 pypinyin 默认原样返回）
        sent = " ".join(
            " ".join(x) for x in py(para, style=Style.TONE)
            if isinstance(x, (list, tuple))
        )
        print(f"◆ {para}")
        print(f"  读音: {sent}")
        # 逐字多音扫描
        flags = []
        for c in para:
            if not ("一" <= c <= "鿿"):
                continue
            h = py(c, style=Style.TONE, heteronym=True)
            reads = h[0] if h else []
            if len(reads) > 1:
                hint = RISK.get(c, "")
                flags.append(f"⚠{c}={'/'.join(reads)}" + (f"（{hint}）" if hint else ""))
        if flags:
            n_risk += len(flags)
            print("  多音: " + "；".join(flags))
        else:
            print("  多音: 无")
    return n_risk


def main():
    ap = argparse.ArgumentParser(description="TTS 多音字读音校正")
    ap.add_argument("mode", choices=["fix", "check", "pinyin"])
    ap.add_argument("--text", help="直接给文本")
    ap.add_argument("--file", help="从文件读文本（UTF-8）")
    ap.add_argument("--table", help="追加规则 JSON")
    ap.add_argument("--json", action="store_true", help="机器可读输出")
    a = ap.parse_args()

    if a.text:
        src = a.text
    elif a.file:
        with open(a.file, encoding="utf-8") as f:
            src = f.read()
    else:
        src = sys.stdin.read()
    src = src.strip()
    if not src:
        sys.exit("空文本")

    rules = build_rules(a.table)

    if a.mode == "pinyin":
        n = cmd_pinyin(src)
        sys.exit(1 if n else 0)

    fixed, applied = apply_rules(src, rules)
    warnings = find_risks(fixed, applied)

    if a.mode == "fix":
        if a.json:
            print(json.dumps({"input": src, "output": fixed,
                              "applied": applied, "warnings": warnings},
                             ensure_ascii=False, indent=1))
        else:
            print(fixed)
            for x in applied:
                print(f"  [apply] {x['phrase']}→{x['repl']} ({x['pinyin']}) ×{x['count']}",
                      file=sys.stderr)
            for w in warnings:
                print(f"  [WARN] {w['char']} 未覆盖：{w['hint']}", file=sys.stderr)
    else:
        if a.json:
            print(json.dumps({"applied_would": applied, "warnings": warnings},
                             ensure_ascii=False, indent=1))
        else:
            for x in applied:
                print(f"  [rule] {x['phrase']} → {x['repl']} ({x['pinyin']})")
            for w in warnings:
                print(f"  [WARN] {w['char']}：{w['hint']}")
            print("clean" if not (applied or warnings) else f"{len(applied)} rule(s), {len(warnings)} warn(s)")
    sys.exit(1 if (a.mode == "check" and warnings) else 0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""受控实验：飞书「所处阶段」到底能不能被 API 写入（2026-10-11 用过一次）。

结论（当次）：**不能**。CLI upsert、裸 api PUT、连创建时预设 —— 三种路径都 ok:true 但值不变；
同一次实验里同类型的 `阶段(AI)` 用同样的调用能写进去（对照组），所以不是调用方式的问题，
是「所处阶段」这个字段类型在服务端被限制为 UI 写入。

平台若改行为，重跑本脚本即可复验（它会自建两条测试记录、逐步回读、最后按名字清理干净）。
BT/TB 硬编码为「开发项目」表，换表请改常量。


用同表同类型的 阶段(AI) 作对照组（已知可写），逐条试不同写法并每步回读。
测完删除自建的测试记录。
"""
import json
import pathlib
import subprocess
import time

LARK = str(pathlib.Path.home() / ".tools/larksuite-cli/node_modules/@larksuite/cli/bin/lark-cli")
BT = "{{FEISHU_BASE_APP}}"
TB = FEISHU_TABLE_ID = "{{FEISHU_TABLE}}"
OWNER = "ou_915ded8a9628d5786372589a9caa08bb"
STAMP = time.strftime("%H%M%S")


def run(args, stdin=None):
    return subprocess.run([LARK, *args], capture_output=True, text=True, input=stdin)


def parse(out: str) -> dict:
    raw = out[out.index("{"):] if "{" in out else "{}"
    try:
        return json.JSONDecoder().raw_decode(raw)[0]
    except Exception:
        return {"_raw": out[:300]}


def write_json(path: str, payload: dict) -> str:
    pathlib.Path(path).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return f"@{path}"


def upsert(payload: dict, record_id=None):
    args = ["base", "+record-upsert", "--base-token", BT, "--table-id", TB, "--as", "user",
            "--json", write_json(f"/tmp/stage-{STAMP}.json", payload)]
    if record_id:
        args += ["--record-id", record_id]
    out = run(args)
    return parse(out.stdout + out.stderr)


def raw_put(record_id: str, payload: dict):
    out = run(["api", "PUT", f"/open-apis/bitable/v1/apps/{BT}/tables/{TB}/records/{record_id}",
               "--data", write_json(f"/tmp/stage-raw-{STAMP}.json", payload), "--as", "user", "--json"])
    return parse(out.stdout + out.stderr)


def read_record(record_id: str) -> dict:
    for _ in range(3):
        out = run(["base", "+record-get", "--base-token", BT, "--table-id", TB, "--record-id", record_id,
                   "--as", "user", "--format", "json"])
        obj = parse(out.stdout + out.stderr)
        data = obj.get("data") or {}
        cols = data.get("fields") or []
        rows = data.get("data") or []
        if rows:
            return dict(zip(cols, rows[0]))
        time.sleep(3)
    return {}


def list_records():
    out = run(["base", "+record-list", "--base-token", BT, "--table-id", TB, "--as", "user", "--format", "json"])
    obj = parse(out.stdout + out.stderr)
    data = obj.get("data") or {}
    cols = data.get("fields") or []
    rows = data.get("data") or []
    ids = data.get("record_id_list") or []
    return [dict(zip(cols, row)) | {"_id": ids[i] if i < len(ids) else None} for i, row in enumerate(rows)]


def find_id(name: str):
    for rec in list_records():
        if rec.get("项目名称") == name:
            return rec["_id"]
    return None


results = []


def step(label, action, expect_field, record_id, value_shape):
    resp = action()
    ignored = (resp.get("data") or {}).get("ignored_fields")
    time.sleep(3.5)
    rec = read_record(record_id)
    got = rec.get(expect_field)
    ok = got == value_shape
    results.append((label, resp.get("ok"), ignored, got, ok))
    print(f"  [{ '写入生效' if ok else '未生效' }] {label}: 请求 ok={resp.get('ok')} ignored={ignored} → 回读 {expect_field}={got}")


print("== 建两条测试记录（一条空白，一条创建时就预设 所处阶段） ==")
created = upsert({
    "项目名称": f"【API测试·可删】所处阶段可写性 {STAMP}",
    "项目类型": ["其他"],
    "负责人": [{"id": OWNER}],
    "备注": "自动化可写性测试，测完即删。",
})
print("  创建响应形状（供以后参考）:", json.dumps(created, ensure_ascii=False)[:400])
rid = find_id(f"【API测试·可删】所处阶段可写性 {STAMP}")
print("  测试记录 A:", rid, "| 创建响应 ok:", created.get("ok"))

created2 = upsert({
    "项目名称": f"【API测试·可删】创建时预设阶段 {STAMP}",
    "项目类型": ["其他"],
    "负责人": [{"id": OWNER}],
    "所处阶段": ["测试中"],
    "阶段(AI)": ["测试中"],
    "备注": "自动化可写性测试，测完即删。",
})
rid2 = find_id(f"【API测试·可删】创建时预设阶段 {STAMP}")
print("  测试记录 B:", rid2, "| 创建响应 ok:", created2.get("ok"))

if not rid:
    raise SystemExit("没拿到测试记录 A 的 record_id，实验终止（未做任何写入）")

base = read_record(rid)
print(f"  A 初始：所处阶段={base.get('所处阶段')} | 阶段(AI)={base.get('阶段(AI)')}")

print("\n== 逐条尝试 ==")
step("① CLI upsert 写 所处阶段=设计中", lambda: upsert({"所处阶段": ["设计中"]}, rid), "所处阶段", rid, ["设计中"])
step("② 对照组：CLI upsert 写 阶段(AI)=设计中", lambda: upsert({"阶段(AI)": ["设计中"]}, rid), "阶段(AI)", rid, ["设计中"])
step("③ 裸 api PUT 写 所处阶段=开发中", lambda: raw_put(rid, {"fields": {"所处阶段": ["开发中"]}}), "所处阶段", rid, ["开发中"])
step("④ 裸 api PUT 写 阶段(AI)=开发中", lambda: raw_put(rid, {"fields": {"阶段(AI)": ["开发中"]}}), "阶段(AI)", rid, ["开发中"])
if rid2:
    time.sleep(3)
    rec_b = read_record(rid2)
    b1, b2 = rec_b.get("所处阶段"), rec_b.get("阶段(AI)")
    results.append(("⑤ 创建时预设（新建记录）", created2.get("ok"), None, f"所处阶段={b1} / 阶段(AI)={b2}", b1 == ["测试中"]))
    print(f"  [{'写入生效' if b1 == ['测试中'] else '未生效'}] ⑤ 创建时同时预设两列 → 回读 所处阶段={b1} | 阶段(AI)={b2}")

print("\n== 结论 ==")
control = [r for r in results if "阶段(AI)" in r[0]]
target = [r for r in results if "所处阶段" in r[0]]
print(f"  对照列 阶段(AI)：{sum(1 for r in control if r[4])}/{len(control)} 次写入生效")
print(f"  目标列 所处阶段：{sum(1 for r in target if r[4])}/{len(target)} 次写入生效")
print("  → 答案：" + ("所处阶段【可以】被 API 写入" if any(r[4] for r in target) else "所处阶段【不能】被 API 写入（服务端静默忽略），只有网页端能改"))

print("\n== 清理全部测试记录 ==")
for rec in list_records():
    name = rec.get("项目名称")
    if isinstance(name, str) and "API测试" in name:
        out = run(["base", "+record-delete", "--base-token", BT, "--table-id", TB, "--as", "user",
                   "--record-id", rec["_id"], "--yes"])
        print(f"  删除 {name} ({rec['_id']}): ok={parse(out.stdout + out.stderr).get('ok')}")
time.sleep(3)
left = [r.get("项目名称") for r in list_records() if isinstance(r.get("项目名称"), str) and "API测试" in r["项目名称"]]
print(f"  回读：剩余测试记录 {len(left)} 条（应为 0）：{left}")

pathlib.Path("/tmp/stage-test-result.json").write_text(
    json.dumps({"results": results, "conclusion": "writable" if any(r[4] for r in target) else "readonly"},
               ensure_ascii=False, indent=2), encoding="utf-8")
print("  实验数据已存 /tmp/stage-test-result.json")

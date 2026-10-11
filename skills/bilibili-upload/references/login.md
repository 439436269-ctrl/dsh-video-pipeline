# B站凭据重登流程（免手动扫码）

适用：`biliup` 报 `credential validation failed with Bilibili code -400`，
或 `{{USER_HOME}}\.bilibili\cookies.json` 过期/缺失。全程约 1 分钟，**不需要手机扫码**
（biliup 内部用 bili_jct 自动确认二维码）。

## 第 0 步：拿到 SESSDATA 和 bili_jct（二选一）

### 方式 A：从浏览器复制（免扫码，推荐）

1. Chrome 登录 bilibili.com → DevTools → Application → Cookies → `https://www.bilibili.com`
2. 复制 `SESSDATA` 和 `bili_jct` 两个值（只要值，不要 `name=` 前缀）

### 方式 B：网页二维码接口（需扫一次）

```python
# 1) 生成二维码图片给用户扫
import requests, qrcode, json
h = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"}
d = requests.get("https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
                 headers=h, timeout=15).json()["data"]
qrcode.make(d["url"]).save("bili-login-qr.png")   # 展示给用户，码约 135~180 秒有效
key = d["qrcode_key"]

# 2) 轮询（用户扫完点确认）
import time, urllib.parse
while True:
    data = requests.get("https://passport.bilibili.com/x/passport-login/web/qrcode/poll",
                        params={"qrcode_key": key}, headers=h, timeout=10).json()["data"]
    if data["code"] == 0:
        break                      # 86101=未扫 86090=已扫待确认 86038=过期(重新生成)
    time.sleep(3)

# 3) 跟随 crossDomain 链接换 cookie
s = requests.Session(); s.headers.update(h)
s.get(data["url"], allow_redirects=True, timeout=20)
auth = {c.name: c.value for c in s.cookies}        # 含 SESSDATA / bili_jct 等
# 确认有效性：
nav = requests.get("https://api.bilibili.com/x/web-interface/nav",
                   cookies=auth, headers=h, timeout=15).json()
assert nav["code"] == 0 and nav["data"]["isLogin"]
```

## 第 1 步：预建路径（否则报 `os error 3 路径找不到`）

```powershell
$env:PYTHONUTF8 = "1"
$py = "{{USER_HOME}}\.config\mimocode\skills\.venvs\publish\Scripts\python.exe"
& $py -c "import os; [os.makedirs(p, exist_ok=True) for p in [r'{{USER_HOME}}\.biliup', os.path.join(os.getcwd(), '.biliup')]]; open(os.path.join(os.getcwd(), 'qrcode.png'), 'ab').close()"
```

## 第 2 步：pywinpty 驱动 biliup 登录菜单

把下面脚本存为临时 `.py`（**用 here-string/Write 写入，勿用 PS Get-Content 回读**，
PS 5.1 会按 ANSI 解码毁掉中文正则），填入第 0 步拿到的两个值后执行：

```python
import time, threading, json, re, os
from winpty import PtyProcess as PP

SESSDATA = "第0步的SESSDATA值"
BILI_JCT = "第0步的bili_jct值"
auth = {"SESSDATA": SESSDATA, "bili_jct": BILI_JCT}

py = r"{{USER_HOME}}\.config\mimocode\skills\.venvs\publish\Scripts\python.exe"
target = r"{{USER_HOME}}\.bilibili\cookies.json"
if os.path.exists(target):
    os.remove(target)

p = PP.spawn(py + " -m biliup -u " + target + " login")   # 参数不能带引号！
buf, lock = [], threading.Lock()

def reader():                       # p.read() 会阻塞，必须放线程
    while True:
        try:
            c = p.read()
            if c:
                with lock: buf.append(c)
            elif p.closed:
                break
        except Exception:
            break
threading.Thread(target=reader, daemon=True).start()

time.sleep(2.5)
p.write("\x1b[B\x1b[B\x1b[B\r")     # 下×3：跳过 账号密码/短信/扫码/浏览器 → 网页Cookie登录1

answered = set()
t_end = time.time() + 50
while time.time() < t_end:
    time.sleep(0.5)
    with lock: raw = "".join(buf)
    plain = re.sub(r"\x1b\[[0-9;?]*[a-zA-Z]", "", raw)
    for pr in re.findall(r"请输入([A-Za-z0-9_]+)", plain):
        if pr in answered:
            continue
        p.write(auth.get(pr, "") + "\r")     # 依次应答 SESSDATA、bili_jct
        answered.add(pr)
        time.sleep(0.4)
    if p.closed:
        break
time.sleep(3)
try:
    if not p.closed: p.close()
except Exception: pass

print("file:", os.path.exists(target), os.path.getsize(target) if os.path.exists(target) else 0)
```

**预期输出尾部**（成功标志）：

```text
INFO credential.rs: 获取二维码
INFO credential.rs: 自动确认二维码
INFO uploader.rs: 登录成功，凭据已保存到 {{USER_HOME}}\.bilibili\cookies.json
file: True 1358
```

## 第 3 步：验证

```powershell
$env:PYTHONUTF8 = "1"
& $py -m biliup -u "{{USER_HOME}}\.bilibili\cookies.json" list
```

能列出账号稿件（exit=0）即恢复；仍报 -400 则回到第 0 步换新 cookie 重来。

## 已知坑

| 现象 | 根因 | 对策 |
|------|------|------|
| `os error 3 系统找不到指定的路径` | 缺 `~/.biliup/`、cwd 的 `.biliup/` 或 `qrcode.png` | 第 1 步预建 |
| `PtyProcess.spawn` 报 FileNotFound | 路径带了引号 | 参数不加引号（venv 路径无空格） |
| 脚本卡死无输出 | `p.read()` 阻塞主线程 | 读取放 daemon 线程 |
| 正则报 unbalanced parenthesis | PS 5.1 回读 UTF-8 脚本毁中文 | 脚本用 here-string 一次写入 |
| 手拼 cookie 文件报 -400 | 缺真 access_token（oauth2/info 校验） | 必须走本流程由 biliup 自己生成 |

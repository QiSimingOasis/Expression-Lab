# 🚀 表达研究所 · 线上部署指南（Vercel + 科大讯飞 + DeepSeek）

> **目标**：把你的项目部署到公网，用户打开 URL 后 → 录音 → 科大讯飞转写 → DeepSeek AI 评分 → 反馈页展示。
> **本地 python server vs Vercel 对比**：
> - `python -m http.server 3000` → 纯静态，API 走 _fallbackAnalyze（规则评分 + 占位转写），不消耗 token
> - `vercel deploy` → 真·云上，调用 `/api/transcribe`（讯飞）+ `/api/analyze`（DeepSeek），真实 AI 打分

---

## 步骤 1：开通两个 API Key（花 5-10 分钟）

### 1.1 科大讯飞 · 语音转写

```
开通地址：https://xinghuo.xfyun.cn/iflyos?channel=xuanyuanx
API 文档：https://www.xfyun.cn/doc/asr/ifasr_new/API.html
```

操作：
1. 注册讯飞账号，进入「控制台」
2. 进入「语音识别（转写）· 极速版 / 会议转写版」，开通服务
3. 拿到 3 个值：
   - `APPID` → 填入 `XUNFEI_APPID`
   - `APIKey` → 填入 `XUNFEI_APIKEY`
   - `APISecret` → 填入 `XUNFEI_APISECRET`

> 💡 讯飞一般有免费额度（新用户 3-10 小时不等），足够秋招 demo 用。

### 1.2 DeepSeek · AI 表达分析

```
开通地址：https://platform.deepseek.com/
API 文档：https://platform.deepseek.com/api-docs/
```

操作：
1. 注册 DeepSeek 账号，进入「API Key 管理」
2. 创建新 Key，复制 sk-xxxx
3. 填入 `DEEPSEEK_API_KEY`

> 💡 DeepSeek 新用户送 ¥10-20 额度（大概可调用几千次分析），单条分析成本 < ￥0.01。

---

## 步骤 2：安装 Vercel CLI

```bash
# 如果你没装过 Node.js ≥ 18：先去 https://nodejs.org 下载 LTS
node -v      # 需要 ≥ 18.x
npm -v

# 全局安装 Vercel CLI（只需装一次）
npm install -g vercel

# 登录（首次会弹出浏览器，授权 GitHub 邮箱即可）
vercel login
```

---

## 步骤 3：配置环境变量（两种方法选其一）

### 方法 A：写本地 .env.local（推荐，可立刻用 vercel dev 测）

```bash
# 进入项目根 biaoda-lab/
cd biaoda-lab

# 复制模板
cp .env.example .env.local

# 用 VS Code / Notepad++ 编辑 .env.local，填入真实 Key
code .env.local
```

填入：
```
XUNFEI_APPID=xxxxxx
XUNFEI_APIKEY=xxxxxxxxxxxxxxxxxxxx
XUNFEI_APISECRET=xxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxx
```

然后本地启动 Vercel dev server 测：

```bash
cd biaoda-lab
vercel dev
# 首次会问：
#   Set up and deploy? → Y
#   Which scope?       → 选你自己的账号
#   Link to existing?  → N
#   Project name?      → expression-lab / biaoda-lab
#   Directory?         → ./
#   Framework?         → Other
#   Build command?     → 留空
#   Output dir?        → ./

# 启动后会看到：Ready! http://localhost:3001
# 打开 http://localhost:3001 (不是 3000!) → 这就是真实调用 API 的环境
```

Chrome 下录一段 30 秒音，观察网络面板（F12 → Network）：
- `/api/transcribe` → 200，响应 `{transcript:"..."}` ✅ 讯飞 OK
- `/api/analyze` → 200，响应 `{status:"success", dimensions:[...], ...}` ✅ DeepSeek OK
- 不出现 `[占位文本]`，就是成功。

### 方法 B：Vercel 后台填（线上部署用，推荐也做）

```bash
cd biaoda-lab
vercel env add XUNFEI_APPID      # 粘贴值
vercel env add XUNFEI_APIKEY
vercel env add XUNFEI_APISECRET
vercel env add DEEPSEEK_API_KEY

# 或去网页后台 → Project Settings → Environment Variables 粘贴
# 注意 "Production + Preview + Development" 三个环境都勾上
```

---

## 步骤 4：正式部署上线

```bash
cd biaoda-lab

# 首次部署（测试域名）
vercel deploy
# 完成后会给你一个 URL：https://biaoda-lab-xxxx.vercel.app
# 打开就能用，这是 Preview 环境，已经调用真实 API。

# 觉得没问题 → 部署到生产
vercel deploy --prod
# 得到最终生产域名，可贴进简历 / 作品集
```

> 💡 Vercel 免费版额度：每月 100 GB 带宽 + 10000 Serverless Function 调用，足够几十个人连续用。

---

## 步骤 5：把部署域名绑定到自定义域名（可选，加分）

如果你有自己的域名（例如 `expression-lab.cn`）：
1. Vercel 后台 → Project → Settings → Domains
2. 添加你的域名，按提示去域名服务商加 2 条 DNS 记录
3. 等待 5 分钟，HTTPS 自动签发

---

## 🛠️ 排错速查表

| 现象 | 原因 | 解决 |
|------|------|------|
| `/api/analyze` 返回 500 `DeepSeek API Key 未配置` | 环境变量没写 | Vercel 后台加 `DEEPSEEK_API_KEY` 并 **重新部署**（改了 env 必须重部署） |
| `/api/analyze` 返回 500 `契约校验重试仍失败` | 模型温度/输出漂移 | 重试一次；或检查 `PROMPT_VERSION` 是否已写入契约 |
| `/api/transcribe` 返回 500 `讯飞接口无响应: 401` | 讯飞凭证错误 | 核对 AppID/Key/Secret，确认 APPID 与密钥是同「应用」的 |
| `/api/transcribe` 一直转圈到 60s 超时 | 上传成功但轮询未完成 | 录制时长不要超过 5 分钟；讯飞轮询最大 50s |
| 转写结果为空字符串 | 录音格式 webm 讯飞未识别 | 用 Chrome + 英文系统 locale，用 `.opus` 扩展名 |
| 本地 vercel dev 404 API | 项目路径错了 | Vercel 项目 root 必须是 `biaoda-lab/`，不是外层 `Expression Lab/` |
| 线上 Vercel 点任何按钮返回首页空白 | 路由 cleanUrls 没生效 | 确认 vercel.json 已上传 `cleanUrls: true` |

---

## 📌 最终交付检查清单

- [x] 打开线上域名可以看到首页漂亮 UI
- [x] 点击随便聊聊 → 开始录音 → 30 秒后停止 → 提交分析
- [x] Network 面板：`/api/transcribe` 200 + `/api/analyze` 200
- [x] 结果页：五维评分 + 雷达图 + 改写建议，**不出现 [占位文本]**
- [x] 个人中心：记录保存，统计概览数字增加
- [x] 非 Chrome 用户：看到「⚠ 当前浏览器不支持实时语音转写」的橙色提示，但也能正常拿到讯飞后端转写

恭喜你，已经拿到一个**可以贴在秋招简历上的真实可运行 Web App 作品集项目**🎉

# 表达研究所 MVP · 产品需求文档（PRD）
**版本：** `V3.0`（方案定稿 · 2026-08-05，作者：齐思铭）
**文档定位：** 秋招作品集 · 产品设计正本。所有开发工作以此文档为最高优先级规格。
**落地映射：** 见 [docs/README.md → 规格-代码落地索引](./README.md#规格---代码落地索引)

---

> ⚠️ 说明：本页是 PRD V3.0 的**章节骨架 + 关键硬约束锚点**（用于作品集评审快速查阅 + 代码对齐）。
> 完整 12 章正文细节已全部硬编码进 [verify-frontend-v3.js](../biaoda-lab/test/verify-frontend-v3.js) 的 80 条契约断言中，并作为回归入口强制执行。

---

## 📑 章节骨架

| 章号 | 章节名 | 核心锚点（作品集必看） |
|---|---|---|
| §1 | 产品背景与痛点 | 目标用户：大学生 / 职场新人 0-3 年；痛点："开口怕、不会说、练不动、看不到进步" |
| §2 | 愿景与目标 | 愿景：「陪你从敢说，到会说」；MVP 北极星指标：次周 7 日留存 ≥ 25% |
| §3 | 用户旅程 | 发现 → 首页 Tab → 练习 → 反馈 → 个人中心复盘 → 再练习（闭环） |
| §4 | 功能总览 | 4 大练习模式（A/B/C/D）× 5 大页面（home/practice/result/profile） |
| §5 | 全局交互规范 | 移动端优先；375px 设计稿；桌面最大宽度 480px 居中；配色 4 档 L1-L4 |
| §6 | 数据契约与质量保障 | **硬规格区：评分 / 水平判定 / Module B 阈值 / JSON schema** ← 强约束 |
| §7 | 本地存储与历史记录 | `localStorage` 为唯一事实来源；§7.2 完整字段 schema + 旧兼容 |
| §8 | 非功能需求 | 脱 Vercel 也能跑（0 后端依赖）；失败兜底；容量超限清理策略 |
| §9 | 静态题库 | A随便聊聊 / C演讲 / D面试；B自言自语无题库 |
| §10 | 验收口径 | §10.1 四条数据用例 + §10.2 交互用例（回归 80 断言覆盖） |
| §11 | V2/V3 远期路线 | V2 分享；V3 社交化 / 真人陪练；均不进入 MVP 阻塞 |
| §12 | 设计亮点 3 条 | 跨场景成长曲线可比 / 低-高压练习双通道 / 评分-反馈-改写三解耦 |

---

## 🔴 §6 · 关键硬规格区（代码必须 1:1 对齐）

### §6.1 模式编码
- `scene ∈ {A, B, C, D}` × `level_segment ∈ {1, 2, 3}` = 共 **12 种 mode_code（A1-D3）**

### §6.2 水平档位判定（强规则）
1. **硬门槛**：历史有效记录（不含本次）< 5 次 → 一律 **level_segment = "1"（新手）**，防样本不足跳档
2. 历史 ≥ 5：取最近最多 5 条（含本次）的 5 维均分：
   - 均分 > 3.5 → **"3" 进阶**
   - 2.5 ≤ 均分 ≤ 3.5 → **"2" 成长中**
   - 其它 → **"1" 新手**

### §6.3 等级映射（强断言）
```
L1: 1.0 ≤ score < 2.0
L2: 2.0 ≤ score < 3.0
L3: 3.0 ≤ score < 4.0
L4: score ≥ 4.0   ← 4.0 必须映射 L4（4.0=L4 验收断言）
```

### §6.4 两阶段分数锁定（Prompt §1.2 关键顺序）
- Phase 1：Layer 1 基准评分（**不看 scene/level**）→ 拿到 5 维 scores
- Phase 2：scores + 历史记录 → 计算真实 level_segment → 写 mode_code
- **禁止**：先知道 level_segment 再反过来给不同分数（循环偏差防锁）

### §6.5 输出 JSON Schema（前端渲染与 Storage 写入口径）
```jsonc
{
  "id": "xxx",
  "created_at": "2026-08-26T09:30:00.000Z",
  "scene": "A",
  "level_segment": "1",
  "mode_code": "A1",
  "topic_id": "A001",
  "topic_text": "...",
  "duration_sec": 90,
  "audio_ref": "blob:...(可null)",
  "transcript": "...",
  "insufficient_sample": false,
  "scores": {
    "structure": 3.4,     // 原 logic，新 schema 统一命名 structure
    "clarity": 2.8,
    "fluency": 3.0,
    "completeness": 2.5,
    "conciseness": 3.2
  },
  "dimensions": [
    {"key":"structure","name":"逻辑结构","score":3.4,"level":3,"label":"结构清晰",
     "comment":"...","suggestion":"...","evidence":[]},
    // ... 其余 4 项，固定 5 项顺序
  ],
  "summary": "不超过20字，先肯定后改进",
  "improvements": [
    {"dimension":"","original":"...","improved":"...","reason":""}
  ]
}
```
- **键名双向兼容**：旧记录里 `dimensions.logic` → 读时自动映射为 `scores.structure`（见 [storage.js §7.2 兼容层](../biaoda-lab/js/storage.js)），**绝不丢历史**

---

## 🔴 §7.2 · Storage 记录完整字段（必含）
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 唯一记录 ID |
| `created_at` | ISO string | UTC 创建时间 |
| `scene` | "A" \| "B" \| "C" \| "D" | 场景编码 |
| `level_segment` | "1" \| "2" \| "3" | 水平档位 |
| `mode_code` | 正则 `^[A-D][1-3]$` | 12 种组合 |
| `topic_id` / `topic_text` | string | 题目 ID 与正文 |
| `duration_sec` | number | 录音秒数 |
| `audio_ref` | string \| null | blob URL 引用（P2：容量超限时从最旧开始 null 化） |
| `transcript` | string | ASR 转写文本 |
| `insufficient_sample` | boolean | true=样本不足，不计入成长统计，不生成低分与改写 |
| `scores` | object | 5 键 structure/clarity/fluency/completeness/conciseness，值 1.0-5.0 一位小数 |
| `dimensions` | array[5] | 固定 5 项顺序同上，每项含 key/name/score/level/label/comment/suggestion/evidence[] |
| `summary` | string | ≤20 Unicode 字 |
| `improvements` | array[0-3] | 每项 dimension/original/improved/reason，original 必须是 transcript 连续子串 |

---

## 🔴 §10.1 · 数据验收 4 条用例（回归脚本 80 断言覆盖）
| 用例 | 场景×水平 | 断言要点 |
|---|---|---|
| ① A1 话题聊天新手 | A × 1 | 低压，summary 温柔语气，Module B 仅维度<3.0 才触发改写 |
| ② B1 自言自语 | B × 1 | 内容完整性按"开头-结束"标准，低压保护开口积极性 |
| ③ C2 演讲倒计时 3min | C × 2 | 倒计时归零自动 stop，Module B 阈值<4.0（高压严格） |
| ④ D3 面试水平3 | D × 3 | improvements.reason 引用 STAR/PREP/Grice 等理论标签，语气专业严格 |
| ⑤ 样本不足 <50 字 | 任意 | insufficient_sample=true，improvements=[]，不写成长曲线 |

---

## 📚 变更记录（Changelog · 按 832304 经验分散+集中双写）

| 日期 | 版本 | 更新点摘要 | 触发原因 |
|---|---|---|---|
| 2026-08-26 | V3.0（定稿） | PRD 12 章规格全文锁定；与 Prompt 工程/话题库形成"双规格交集"硬约束 | 用户 VERBATIM 提供 PRD V3.0 正本 |
| 2026-08-26 | V3.0-patch1 | §6.3 等级映射补"4.0 必 L4"硬断言；§7.2 增加 logic→structure 兼容策略 | 回归 verify-frontend-v3.js 80/80 需求 |
| 2026-08-26 | V3.0-patch2 | §10.1 数据用例 4+1 条显式列出；对应断言入口写回文档 | 知识库整理与作品集评审可读性优化 |

> **集中总日志**请查看 [docs/README.md → 知识库集中变更总日志](./README.md#知识库集中变更总日志-changelog)

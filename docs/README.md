# 📚 表达研究所 · 知识库文档中心
> 秋招作品集评审入口：**规格正本 × 工程落地 × 变更记录 × 质量断言** 一键导航

## 🗂 文件编排总览

知识库目录采用「**三份规格正本 + 一份总导航索引 + 集中变更日志**」的标准结构，完全对齐「文档维护指南」与 832304 经验：
- **集中式 + 分散式双写变更记录**：每份文档末尾有自己的变更记录表（分散）；本页底部维护一份**集中式总日志**（便于快速追踪全局）
- **规格正本与代码落地强映射**：每一条规格下面给出「→ 对应代码文件 + 行范围 + 验证入口」，评审打开任意一份规格都能一键跳到证据

```
Expression Lab/
├── docs/                                ← 本目录（独立文档库，与代码解耦维护）
│   ├── README.md                        ← 本页：导航 + 规格→代码映射 + 集中变更日志
│   ├── PRD-V3.0.md                      ← 规格正本 ①：产品需求文档 V3.0（12 章硬约束）
│   ├── Prompt-Engineering-v1.0.md       ← 规格正本 ②：Prompt 工程设计（三层架构/8模块/12编码）
│   └── Topic-Library-v1.0.md            ← 规格正本 ③：话题库 85 题 + 附录 Schema
│
└── biaoda-lab/                          ← 代码实现区（原生 HTML/CSS/JS）
    ├── index.html / practice.html / result.html / profile.html
    ├── css/style.css
    ├── js/
    │   ├── app.js        # 5 大页面 init 主逻辑
    │   ├── api.js        # ★ Prompt 工程前端兜底（三层 + 8模块 + Module C/B/A）
    │   ├── recorder.js   # 录音 + Web Speech 实时转写
    │   ├── storage.js    # ★ localStorage §7.2 schema + 旧数据双向兼容
    │   └── topics.js     # ★ 话题库 85 题（附录新 schema × 运行期兼容 双写）
    ├── api/
    │   ├── analyze.js    # ★ Prompt 工程后端代理（8模块拼接 + temp=0.2 + 契约校验）
    │   └── transcribe.js # 讯飞 ASR 代理（Vercel/脱 Vercel 降级可选）
    └── test/
        └── verify-frontend-v3.js  # ★ 回归脚本：80 条规格断言 = 作品质量证据
```

---

## 🔗 规格 → 代码落地映射索引（作品集评审必看）
> 点击任意「代码参考」链接可直接跳转至实现位置

### 📄 规格正本 ①：[PRD V3.0](./PRD-V3.0.md)
| PRD 章节 | 硬约束锚点 | 代码参考 | 验证入口 |
|---|---|---|---|
| §4 全局结构 | 首页 Tab：随便聊聊 chat / 场景练习 scene / 右上 #profile-entry | [app.js initHome](../biaoda-lab/js/app.js) · [index.html](../biaoda-lab/index.html) | 手动真机：localhost:3000 |
| §6.1 模式编码 | A/B/C/D × 1/2/3 = 12 种 A1-D3 | [api.js computeLevelSegment](../biaoda-lab/js/api.js) | 回归脚本 §「水平判定<5→1」80 断言 |
| §6.2 水平硬门槛 | 历史<5 一律 level=1，防样本不足跳档 | [api.js L648-649](../biaoda-lab/js/api.js#L648-L649) | verify-frontend-v3.js 第 6 组断言 |
| §6.3 4.0=L4 硬断言 | s≥4.0 必须 L4 | [api.js score→level 映射](../biaoda-lab/js/api.js) · [analyze.js scoreToLevel()](../biaoda-lab/api/analyze.js#L230-L237) | 回归脚本「4.0→L4」断言 |
| §6.5 JSON schema | 5 维固定顺序 / scores.structure 新键 / dimensions | [storage.js §7.2 + 旧兼容 _normalizeRecord](../biaoda-lab/js/storage.js) | 回归脚本「旧 logic→新 structure=3.4」断言 |
| §7.2 Storage 双向兼容 | 旧记录 dimensions.logic → 新 scores.structure | [storage.js _normalizeRecord](../biaoda-lab/js/storage.js) | 回归脚本第 7 组断言 |
| §8 脱 Vercel 0 后端全链路 | 前端兜底 _fallbackAnalyze + Web Speech + localStorage | [api.js _fallbackAnalyze()](../biaoda-lab/js/api.js#L333-L411) · [recorder.js](../biaoda-lab/js/recorder.js) | 所有 80 条断言均在 0 后端环境下跑通 |
| §10.1 数据验收 4+1 用例 | A1 / B1 / C2 / D3 / 样本不足 | [verify-frontend-v3.js 第 1-5 组](../biaoda-lab/test/verify-frontend-v3.js) | **`cd biaoda-lab && node test/verify-frontend-v3.js` → 80/80 PASS** |

---

### 🧠 规格正本 ②：[Prompt 工程 pe-eval-v1.0.0](./Prompt-Engineering-v1.0.md)
| Prompt 章节 | 8 模块 / 阈值 / 契约 | 前端兜底参考 | 后端代理参考 |
|---|---|---|---|
| §1.1 三层不变量拆分 | L1固定 / L2补丁 / L3独立 | [api.js 伪三层分块注释](../biaoda-lab/js/api.js) | [analyze.js 顶部 10 行注释](../biaoda-lab/api/analyze.js#L1-L12) |
| §3.3 Layer 1 Base Prompt | 5 维 L1-L4 锚定标准全文 | `PromptBuilder.LAYER1_BASE` | `PROMPT_BUILDER.LAYER1_BASE` |
| §4.3 4 场景补丁 | SCENE_PATCH[A/B/C/D] 决定"看什么" | `PromptBuilder.SCENE_PATCH` | `PROMPT_BUILDER.SCENE_PATCH` |
| §4.4 3 水平补丁 | LEVEL_PATCH[1/2/3] 决定"怎么说" | `PromptBuilder.LEVEL_PATCH` | `PROMPT_BUILDER.LEVEL_PATCH` |
| §5.2 Module B 阈值矩阵 | A/B<3.0 / C/D<4.0，高于阈值不生成 | [ModuleB() 首行阈值过滤](../biaoda-lab/js/api.js) | `validateContract` 后 improvements≤3 |
| §5.3 Module C 判定顺序 | **空→too_short<50→乱码**，红线顺序 | [PromptBuilder.moduleC()](../biaoda-lab/js/api.js#L218-L242) | [moduleCCheck()](../biaoda-lab/api/analyze.js#L184-L216) |
| §6 JSON 契约校验 | 5 项固定顺序 / 三重 score-level-label 锁定 / summary≤20 / original 连续子串 | [api.js _normalizeBackendResult()](../biaoda-lab/js/api.js#L303-L331) | [validateContract() 9 规则](../biaoda-lab/api/analyze.js#L244-L310) + 失败重试一次 |
| §8 已决策 | 一次 API 调用 / temperature=0.2 / json_object | （前端兜底走规则，温度概念不适用） | [callDeepSeekOnce() 参数写入](../biaoda-lab/api/analyze.js#L363-L379) |

---

### 📖 规格正本 ③：[话题库 85 题 topic-lib-v1.0.0](./Topic-Library-v1.0.md)
| 话题库模块 | 内容规模 | 代码参考 | 数量验证 |
|---|---|---|---|
| 模块一 随便聊聊 A | 5 分类 × 8 = 40 题 | [topics.js A 数组](../biaoda-lab/js/topics.js#L13-L383) | `TOPIC_LIBRARY.A.length === 40` ✅ |
| 模块二 演讲 C | 初级 10 + 进阶 10 = 20 题 | [topics.js C 数组](../biaoda-lab/js/topics.js#L388-L572) | `TOPIC_LIBRARY.C.length === 20` ✅ |
| 模块三 面试 D | 4 组 5+8+7+5 = 25 题 | [topics.js D 数组](../biaoda-lab/js/topics.js#L575-L808) | `TOPIC_LIBRARY.D.length === 25` ✅ |
| 自言自语 B | 无题库，B_HINT 低压引导 | [topics.js B_HINT](../biaoda-lab/js/topics.js#L810-L814) | - |
| 附录 Schema 双写 | 新字段(mode/category/difficulty_str/content/guidance/time_limit/suggested_duration) + 兼容旧字段(scene/title/hint/suggested_minutes/difficulty数字) | 每题同时包含两套字段 | 脚本题量校验 85/85 + 分类全匹配 ✅ |

---

## ✅ 质量证据入口
作品集评审中最有说服力的两条"落地铁证"：
1. **命令行运行：**
   ```bash
   cd biaoda-lab
   node test/verify-frontend-v3.js
   # → 期望输出：===== 汇总：PASS 80 / FAIL 0 =====
   ```
2. **手动真机体验（0 后端，Python 一行起服务）：**
   ```bash
   cd biaoda-lab
   python -m http.server 3000
   # 浏览器打开 http://localhost:3000/index.html
   ```

---

## 📅 知识库集中变更总日志（Changelog · 集中式）
> 本日志为 832304 经验要求的「集中式日志」；每份规格正本末尾另含「分散式变更记录」详细到单文档更新点。

| 日期 | 版本 | 全局更新点摘要 | 关联文档 | 触发原因 / 任务 |
|---|---|---|---|---|
| 2026-08-26 | **知识库 v1.0（初始化）** | 🎉 创建 docs/ 目录 + 4 份文档编排；三份规格正本（PRD/Prompt/话题库）全部落盘；每份文档末尾建分散式变更记录表；本 README 建立规格→代码 30+ 条落地映射索引；3 份核心代码（topics.js / api.js / analyze.js）头注释升级为文档章节软引用 | `PRD-V3.0.md` · `Prompt-Engineering-v1.0.md` · `Topic-Library-v1.0.md` · `README.md` | 用户 VERBATIM 提交三份正本后要求："用独立的文档维护知识库和提示词，该怎么进行文件编排？请帮我执行" |
| 2026-08-26 | Prompt pe-eval-v1.0.0 / PRD V3.0-patch1-2 | 前端 api.js 全量重写（三层架构 + PromptBuilder 8模块 + Module C 50字判定顺序 + computeLevelSegment 硬门槛）；后端 analyze.js 同步升级（8模块拼接 + temp=0.2 + validateContract 9条规则 + 失败重试）；回归 80/80；GetDiagnostics 0 error | `Prompt-Engineering-v1.0.md §1-8` · `PRD-V3.0.md §6` | 用户提交《Prompt 工程专项》文档正本；上一轮执行已完成 |
| 2026-08-26 | 话题库 topic-lib-v1.0.0 | topics.js 对齐 85 题新规格；A40(5×8)/C20(10+10)/D25(4组)；附录 Schema × 运行期兼容字段双写策略；分类计数脚本 85/85 全匹配 | `Topic-Library-v1.0.md 全文` | 用户提交《话题库 85 题》正本；上一轮执行已完成 |
| 2026-08-26 | (历史) V3 前端重构 | 8 个核心文件重写（topics / storage / app / api / 4 HTML / 120+ 新 CSS class + 回归脚本 80 断言）；脱 Vercel 化全链路跑通 | 全部代码文件 | 早期 PRD V3.0 定稿 + Vercel CLI 环境阻塞（用户："这方面我完全不懂，需要你主导"） |

---

## 🛠 文档维护操作指南（知识库后续更新 SOP）
按 832304 成功经验总结的 4 步 SOP，下次更新知识库时请严格遵守：

1. **定范围 → 先读本 README + 对应文档末尾的分散式变更记录**，确定是「更新现有文档」还是「新增独立文档」（能改现有就不新建）
2. **改内容 → 在对应文档内修改正文**，章节结构保持稳定，仅增补/修订局部
3. **落变更记录（双写，必做）：**
   - ✅ 在**被修改文档末尾的「变更记录（Changelog · 分散式）」**表格内追加一行（日期 / 版本 / 更新点摘要 / 触发原因）
   - ✅ 在**本 README「集中变更总日志」**表格内同步追加一行
   - ❌ 严禁只改正文不改变更记录（832304 踩坑项，用户会反馈"原地踏步"）
4. **跑回归 → 无论改文档还是改代码，最后都跑** `node test/verify-frontend-v3.js`，确保数据契约 80/80 仍然通过

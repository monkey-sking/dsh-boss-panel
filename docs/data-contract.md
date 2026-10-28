# 面板数据契约（2026-10-28）

先回答三个问题：**界面有人看吗、有设计吗、数据格式有人定吗。**

- 有人看：a11y、数据口径、求职者 UX、安全、前端工程质量五轮只读评审都出过问题清单，改完有测试。
- 有设计：交互按「今天要办什么」组织（等我回 → 待发 → 已发 → 面试），不是按数据表组织。
- 有契约：就是这份文件。**字段只有三种状态：采集到了 / 明确标记「未采集」/ 不允许为空。**

## 1. 一张审批条目长什么样

`boss_approvals.json` → `items[]`，一条候选一个对象。

| 字段 | 来源 | 写入时机 | 发送前必须 | 空值语义 |
|---|---|---|---|---|
| `id` | `日期-公司-encryptJobId` | add | 是 | 不允许为空（坏了整条丢弃） |
| `company` | BOSS 列表接口 | add | 是 | 同上 |
| `jobTitle` / `salary` / `city` | 列表接口 `jobName/salaryDesc/cityName` | add | 是 | 未采集 |
| `jobId` | 列表接口 `encryptJobId` | add | **是**（首触要打开 JD 页点「立即沟通」） | 未采集 |
| `jdText` | JD 详情页 `.job-detail-section` 的 innerText | 读 JD 时 | **是** | 未采集 |
| `recruiter` / `recruiterTitle` | 列表 `bossName`；首触后从会话表 join | add / 展示时 | 否 | 未采集（首触前正常） |
| `tier` | 人工/启发式分档 A/B+ | add | 否 | 未采集（≠B 档，UI 显示「未评级」） |
| `evidence` / `gap` | 筛选时的 JD 证据与缺口 | add | 否 | 未采集 |
| `draft` / `draftHash` | 首触文案 + sha1 前 16 位 | add（自动算 hash） | **是** | 缺 hash 一律不发 |
| `status` | pending/approved/sent/skipped/failed | 面板 / runner | — | 缺省 pending |
| `approvedAt` / `approvedDraftHash` | 面板点「发送」时写 | 决策 | **是**（30 分钟 TTL + 文案绑定） | — |
| `sendResult` / `sentAt` | runner 回写 | 发送后 | — | — |

### 公司详情为什么只有三行

`company_meta.json` 的字段就是 `industry / stage / city` 三个，来自早前抓取；**没有规模、简介、融资额**。
所以弹窗里「规模/简介」显示「未采集」是事实，不是渲染 bug。要补得回到公司页抓，属于采集侧新增，不在面板里编。

### 聊天记录为什么有的空

`boss_thread_history.json` 只覆盖**抓过的线程**（当前 35 条）。首触刚发出、对方还没回、
或 watcher 还没轮到的公司，弹窗里就是空态「首次沟通，还没有往来消息」——
这是「没有消息」，不是「加载失败」。

## 2. UI 的硬规则

1. **固定字段、固定行数**：弹窗里 11 行 kv 永远在，空值写「未采集」。不允许这家少一行、那家多一行。
2. **齐全度可读**：弹窗顶部「资料 5/6 · 缺：对接人」；队列行只在缺 JD（会阻塞发送）时提示。
3. **没有 0 条空区块**：等我回、待发、面试、近期首触，没数据就整块不渲染（或显示一句空态）。
4. **状态色只有一种含义**：绿=已发/已通过，红=失败，灰=不发/已结束；同一状态不在两处用两种颜色。

## 3. 投递前的硬门槛自检

招聘方评审的结论是：11 条首触里 5 条撞硬门槛（卡牌/放置卡牌实战、异地、薪资倒挂），
文案再改也回不来。所以 JD 里出现「必须有…」「硬性要求」「至少 N 年…同品类」这类表述时，
面板会在候选行上标 **JD 硬门槛**，并把原文摆出来 —— 先自己判断够不够，再决定发不发。

`boss_approvals.py audit` 里同样的命中会以 `GATE` 行输出（例如 9665游戏 → `必须有放置卡牌实战经验`）。

## 4. 体检命令

```bash
python3 ~/.local/share/dsh-runtime/scripts/boss_approvals.py audit
```

- `WARN`：非阻塞字段缺失（如首触前的对接人、未评级）。
- `BLOCK`：pending/approved 缺 `jdText` / `jobId` / `draft` —— 这种条目**发不出去**，带 `exit 1`。


## 4.5 已发出的条目怎么读（2026-10-29）

`boss_approvals.json` 里的 `status='sent'` 只证明发送端把消息发进了 BOSS 的输入框并点了发送，
**不证明对方会话里出现了这条消息**。面板用两个信号区分：

| 信号 | 来源 | 面板表现 |
| --- | --- | --- |
| `threadState`（等对方 / 待你决定 / 已结束…） | `boss_threads_all.json` 按公司 join | 「最近发送」行显示相对时间 + 状态徽章 |
| `threadState` 缺失 | 该公司还没出现在会话列表里 | 行尾加「会话未建立」徽章；统计行写「未进会话 N」 |

「会话未建立」不等于发送失败：常见原因是对方还没点开、消息被折叠、或会话列表还没刷新。
真失败会是 `status='failed'` + `sendResult` 带原因，两者别混。

`sentAt` 取发送端结果行里的 `at`（ISO，UTC），面板按本地时区显示；同一批发送不再共用同一个时间戳。

## 5. 首触文案规则（2026-10-28 招聘方视角评审后定）

评审实测：11 条首触里 9 条以「想确认…硬门槛吗」开场、5 条首句自曝「未上线/项目终止」、
0 条给下一步动作，同城 HR 一眼能看出模板。规则落成 `boss_approvals.py lint`：

```bash
python3 ~/.local/share/dsh-runtime/scripts/boss_approvals.py lint
```

会提示四类硬伤 + 字数超 110 + 问号超过 2 个 + 同批开头撞车：

| code | 含义 | 为什么 |
|---|---|---|
| `self_doubt` | 首句「项目终止/未上线/团队解散」 | 招聘方读到的第一个事实变成「不行」 |
| `ask_qualify` | 「想确认…硬门槛/硬线吗」 | 等于让对方先做一轮筛选 |
| `no_next_step` | 没有「发您/作品/拆解/示例/截图/试算」 | 首触不推进，对方没有回复的抓手 |
| `weak_close` | 「还缺人吗/在招吗」收尾 | 无效提问 |
| `too_long` | 超过 110 字 | 手机端折叠，重点看不见 |
| 模板撞车 | 同批 ≥2 条前 10 字相同 | 群发感 |

可用模板（≤110 字，研发期表述，不编造上线状态）：

- 敌人 AI／战斗 AI：`您好。这个岗的怪物/BOSS 战斗 AI 正是我最熟的一段：研发期 3A TPS 里做过 3 种性格化敌人 AI、行为树分支、AI 对话与动作同步。我可以把这段拆解和配置示例发您，看完再判断合不合。`
- UE 技术策划：`您好。我在研发期 3A TPS 里做策划侧工具：UE 蓝图调试工具、把配置错误自动定位到具体条目，也接过 LLM 中文语音＋动作同步的对话链路。工具截图和提效前后数据我可以发您过目。`
- 卡牌／数值：`您好。战斗数值我跟制作人定过一版完整的：伤害、暴击、技能倍率到强度分档，Excel 建模、Python 批量验证。卡牌品类我没做过，但公式与克制结构是通的，可按你们现有框架试算一版给您看。`

## 6. 备份与恢复

`boss_approvals.json` 是「发过什么、谁点了什么」的唯一记录，聊天记录在 BOSS 侧还能找，
草稿和决策找不回来。因此两侧写盘前都会留一份日备份：

| 写入方 | 触发点 | 位置 | 保留 |
|---|---|---|---|
| 面板（index.js `backupApprovalsDaily`） | 每次 `approval_decide` 落盘前，当天第一次才拷 | `<数据目录>/backups/boss_approvals-YYYY-MM-DD.json` | 最近 7 份 |
| 脚本（`boss_approvals.py` `backup_daily`） | 每次 `save()` 前，当天第一次才拷 | 同上 | 最近 7 份 |

权限 0600、目录 0700。恢复方式：停掉 `boss-approval-send`，把对应日期的备份覆盖回
`boss_approvals.json`，`python3 boss_approvals.py stats` 核对条数后再启用任务。

不会备份的：发送结果为空的中间态、已过期（30 分钟）的 approved 记录——它们本来就不该发。

## 7. 防重复与冲突（2026-10-29 QA 评审后补）

| 场景 | 之前会怎样 | 现在的约束 |
| --- | --- | --- |
| 派出去了但没拿到结果（浏览器崩/登录过期） | 条目留在 approved，下一轮原样重派；真实事故里同一 id 被派 3 次 | `boss_approval_runner.py` 记 `~/.hermes/state/boss_approvals_dispatch.json`，同一 id 30 分钟内不再派（`BOSS_REDISPATCH_MIN`），打 `GUARD` + 审计 `redispatch_skip` |
| 面板决策与 runner 结算同时发生 | 面板整文件写回，把刚写好的 `sent` 覆盖回 `pending/approved`，下一轮再发一次 | 写前比对文件 mtime，变了抛 `conflict`，面板提示「刚被后台更新过，刷新再看」 |
| 审批文件损坏 | runner 当「本轮跳过」exit 0，调度全绿，用户以为今天没待发 | 先把现场备份到 `~/.hermes/state/boss_approvals.corrupt-<时间>.json`，再 exit 2 |
| 两个 runner 实例 | 锁在 `$TMPDIR`，不同 TMPDIR 各拿一把锁，审计出现同一秒两个实例 | 锁固定在 `~/.hermes/state/boss-approval-runner.lock` |
| 发送失败后想重试 | 面板只有「收回」，后端不允许 `failed → pending`，点了必报错 | 面板与 CLI 都允许 `failed → pending`（`sent` 仍不可回退） |
| 文案改过但指纹没重算 | 体检全绿，点发送才被拦 | `audit` 比对 `draftHash` 与文案、`approvedDraftHash` 与当前文案，不一致算 BLOCK |
| 结果行缺 `at` | 用结算时刻冒充发送时刻，整批同一秒 | 写 `sentAtSource: "settle_fallback"`，不再假装是真实发送时间 |

## 8. 重复投递可见（2026-10-29）

面板在候选行显示「N 天前投过」（`item.contactedDays`，来源 `contacted.json` 里该公司的最近一次
`date`）。≤7 天是 warning 色并附说明：同一家 7 天内重发首触不加曝光，还会把第二条压在同一条
未读下面。这只是提示，不阻止发送——是否值得再发由人判断。

## 9. 数据新鲜度（2026-10-29）

快照带 `dataQuality.dataAgeMin`（当前时间 − `boss_threads.json` 的 `ts`，分钟）。超过 90 分钟，
面板顶部直接显示「数据已经 N 小时没更新 —— 后台采集可能没在跑，下面的数字不是今天的」。

起因：2026-10-28 用户看到「今天发出 0 / 全部 810 条会话」，实际是没重启的旧宿主 + 旧数据。
面板可以旧，但不能假装新。

## 10. 草稿怎么进面板（2026-10-29）

定时任务写的是 `DRAFT_<YYYYMMDD>_<HHMM>.md`（给人看），面板读的是 `boss_approvals.json`。
桥是 `~/.local/share/dsh-runtime/scripts/boss_drafts_import.py`，每 20 分钟跑一次（noagent 任务
`boss-drafts-import`，`--apply --quiet`）。

解析契约（写草稿时遵守，否则该条不会出现在面板）：
- 二级标题 `## N. 公司（城市）· 岗位 薪资 · X 档`；
- 紧跟的列表里要有 `` - encryptJobId: `...` ``；
- 草稿用引用块：`草稿（过闸）：` 下一行以 `>` 开头，可多行。

行为：只**新增**不存在的 id，绝不覆盖已有条目的事实字段；jdText 从同轮 `r<日期>_<时段>_jd.json`
按 jobId 取；解析不到公司/岗位/草稿/jobId 的整条跳过并打印原因。

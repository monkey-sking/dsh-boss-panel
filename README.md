# dsh-boss-panel

在 DSH 侧边栏「新会话」下方加一个**招聘**入口，点开是 BOSS 直聘求职面板。

> 截图不入库：面板展示的是本机真实的求职数据（公司名、对接人、状态统计），
> 公开仓库里不放。要看效果自己装一次就有了。

## 位置

侧边栏顺序变成：

```
deepseek HARNESS
＋ 新会话
👜 招聘        ← 新增，order = -10
◇ 插件
▦ 插件市场
...
工作区
```

实现方式是注册到 `sidebar.panellist` 并给 `order: -10`——这是宿主 ui-sidebar
硬编码的「全局面板行」，负数排到最前，因此落在「新会话」按钮下面、「插件」上面。
中央面板注册到 `main` 槽，`key` 必须等于侧边栏条目 id（`boss-panel`）。

## 界面设计（0.4.0，2026-10-28 重排）

面板是**待办页**，不是数据看板：打开后 30 秒内能知道「谁在等我回、今天该发谁、发出去的有没有回」。
视觉走 `--dsw-alias-*` 主题 token（深浅色自动跟随系统）。

顶部固定标题区（标题 / 说明 / 更新时间 / 刷新按钮），下面只有两个 Tab：

| Tab | 内容 |
| --- | --- |
| **今天** | 一行数字（今天发出 / 等我回 / 面试）→ **等我回**（对方最后一句 + 「去回」）→ **待发首触**（行内「发送 / 不发」）→ **发出去了，等回复**（默认折叠成一行，点开才展开最近 8 条）→ 近期面试（无则整块消失） |
| **全部会话** | 状态分布条 + 最近 14 天柱 + 搜索框 + 状态多选 chips + 5 列会话表 |

**为什么砍成这样**（历史踩坑，别再改回去）：

- 原来 3 个 Tab + 7 张统计卡 + 810 条状态分布 + 14 天图全堆在首屏，1400px 里真正要回的消息在折叠线以下；
  「面试」Tab 恒空（快照只取未来日程）。
- 原来「需要行动」只筛 `待你决定`，**真正等他回的「待回复」一条都不显示** → 用户原话「那些等着回复的呢？？？」。
  现在「等我回」= `lastFrom === '对方'` 且状态是 `待回复`/`待你决定`，排在首屏第一块。
- 原来 4 条「待你决定」里有 3 条是用户自己刚发出的草稿，只因草稿带问号被判成待办 → 用户原话「待我的拍板，我拍板什么？」。
  根因在宿主 `index.js` 的 ONLYFRESH 分支缺 `lastFrom === '对方'` 守卫，已修并加了回归用例。
- 0 条的区块整块不渲染（不出现「近期面试 · 0」这种噪声）。

**首触审批不单开 Tab**：待发首触是一组行，每行左边是判断依据（档位 + 公司·岗位 + 薪资·城市 + 对方状态），
右边直接给「发送 / 不发」，**不点开也能决策**；点整行才开详情弹窗 —— 状态徽标、岗位/公司 kv、
证据与缺口、首触文案、**完整聊天记录**、**JD 全文**（带原链接），底部按状态给「发送 / 不发」或「撤回」。
详情按 `id+draftHash` 缓存，第二次打开是秒开。

同一家公司不会同时出现在待发首触和「等我回」里；会话表、最近发送、近期面试的任意一行点开，
同一家公司永远是同一个弹窗（有审批条目 → 审批弹窗，没有 → 公司详情弹窗）。

## 面板内容（0.2.0 之前的单页版）

| 区域 | 内容 |
| --- | --- |
| 统计卡 | 待回复 / 面试 / 对方最后发言 / 会话线程 / 已沟通 |
| 最近 14 天 | 每天新沟通的条数 |
| 待回复 | 对方最后发言且还没回的会话，含公司、对接人、最后一句话 |
| 面试日程 | `interview_schedule.json` 的全部条目 |
| 最近沟通 | `contacted.json` 最近 80 条，倒序 |
| 全部线程 | `boss_threads.json` 前 200 条，可按公司/对接人搜索 |

## 数据来源

默认目录 `~/.local/share/dsh-data/workstreams/job-search`，可用 `dataDir` 配置覆盖：

- `boss_threads.json` — 探针最新快照（200 条线程，每 2 分钟）
- `boss_threads_all.json` — 深扫全量 800 条（含 owed 判定；也是聊天正文抓取的目标源）
- `interview_schedule.json` — 面试日程
- `contacted.json` — 已沟通记录
- `boss_jev_state.json` — 公司级状态判定

面板**只写两处状态**，其余求职数据只读、不调模型、不触发探针：

- `boss_pending_decisions.json` — 概览「待你拍板」区块的 已发/忽略（`op=pending_mark`，2026-10-25 起）
- `boss_approvals.json` — 概览里待审批行的 通过/跳过/撤回（`op=approval_decide`，2026-10-28 起）

文件按 mtime 缓存，只有变了才重读。
面板打开期间每 15 秒轮询一次；关掉面板即停表。

## 结构

- `index.js` — 宿主半。`ctx.connection.fetch.register` 注册 `/api/boss-panel.rpc`
  （Connection 的 `/api` 前缀已做 Host/Origin 围栏与签名 Cookie 鉴权）。
- `client.js` — 浏览器半。`window.__ModuleLoader__.load`，两个槽位，样式全走
  `--dsw-alias-*` 主题 token。
- `cordis.patch.yml` — `insert` 一条 `boss-panel`。

## 安装

```bash
# 从工作区目录安装（已是 link 依赖）
plugin_manager install_bundle target=<你的插件目录>/dsh-boss-panel
```

改完 `client.js` 后刷新页面即可；改 `index.js` 需要重载插件（宿主半在启动时加载）。

## 配置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 关掉后宿主半直接返回，不注册路由 |
| `dataDir` | `~/.local/share/dsh-data/workstreams/job-search` | 快照目录 |

## 功能（0.3.0；本插件是分类规则的唯一权威实现）

> 2026-10-27：离线看板 `boss-chat-status.html` 与 `boss_dashboard_render.py` 已停用留档，
> 探针不再重渲 HTML。规则只留这一处，回归护栏见 `node test/classify_test.mjs`。

- 8 状态分类引擎：待你决定 / 待回复 / 已约面试 / 已面试 / 等对方 / 可静默 / 已结束
  （「已读不回」桶 2026-10-27 已删除，`readNoReply` 现在返回 null 而不是 0——0 会被外部脚本当真实业务值）
  （优先级：AUDIT 人工复核 → OVR 人工覆盖 → 外包黑名单 → 硬规则正则（拒信/门槛/收尾 CLOSER/系统面试邀请 SYSTEM_INVITE）
  → 占位符 PLACEHOLDER_OWED → ACKPASS → JEV（「待回复」让位于 owed 硬证据）→ 面试表 → 未验证 → owed → 探针新行）
- 今日简报：待你决定 N 个（列公司）、今日首触 N 条（A/B）
- 面试口径（2026-10-28 数据审计后定死）：KPI 只算**有明确日期且未取消**的场次；
  另分「待定（日期未定）/ 已取消 / 已完成」三个桶在空态旁如实交代，四桶相加必须等于日程总数——
  之前只留 `dayDiff>=0`，把「待对方给时间」这条活着的面试直接吞了，用户看到「面试 0」以为没进展。
- 首触口径：`contacted.json`（送达）∪ `boss_approvals.json`（sent）按**本地日历日 + 公司**去重。
  禁止对 UTC 的 ISO 串做 `slice(0,10)`——凌晨 0–8 点发出的会被算到前一天，且永不补回。
- 会话计数写「N 条会话行 / M 家公司」：同公司多行（如海马云 3 行）不能当 3 个沟通对象；
  公司名为空的行不渲染、不计数。
- 会话表：状态 / 公司+对接人 / 岗位+薪资 / 最后一条（谁·时间·送达）/ 下一步建议
- 详情弹窗：岗位/薪资/城市/行业/规模/融资/对接人/首触/渠道/A-B/备注/建议 + 最近 12 条聊天正文
- 状态多选筛选 + 搜索；最近 14 天沟通柱状

## 数据

只读 `~/.local/share/dsh-data/workstreams/job-search/` 下 8 个 JSON：
`boss_threads.json`、`boss_threads_all.json`、`interview_schedule.json`、`contacted.json`、
`boss_jev_state.json`、`boss_thread_history.json`、`company_meta.json`、`outsourcing_blacklist.json`、`boss_pending_decisions.json`。

探针 cron（`boss-chat-watch`，每 120s）写盘后，面板最多 15s 自动看到新数据；无需手动刷新。

## 测试

```
node test/render_test.mjs     # 有状态渲染测试：驱动 今天/全部会话 两个 Tab 切换，16 项断言
node test/approval_test.mjs   # 审批流：合成快照 3 条 → 概览队列行、点行开弹窗、点通过真的 POST approval_decide
node test/detail_test.mjs     # detail op 字段与聊天记录
```

`render_test.mjs` 用可变 `useState` 的 React 桩，模拟点击 Tab 按钮后重建组件树，
断言「今天」只有待办区块、「全部会话」有表头和筛选 chips，且 14 天趋势和 7 张统计卡不再占首屏。

## 已知边界

- **聊天正文抓取**（`~/.hermes/scripts/boss_thread_history.js`）读 `boss_threads_all.json` 选目标，
  只覆盖「owed=true」和探针判不了的状态；已收尾的会话不抓正文，详情弹窗里会是空的。
- 面板读的 `index.js` 是宿主半，**改完需重载插件**（`plugin_manager set_plugin target="include:boss-panel" enabled=false` 再 `enabled=true`）；`client.js` 改完刷新页面即可。
- 数据目录默认 `~/.local/share/dsh-data/workstreams/job-search`，与 `~/.hermes/workstreams/job-search`
  是同一个目录（符号链接/硬链），写任一处两处都会变。

## 待你拍板队列（2026-10-25）

- 数据源 `boss_pending_decisions.json`，字段 `{items:[{id,company,name,job,reason,conf,draft,addedAt,status,decidedAt}]}`，
  `status` ∈ pending/sent/dismissed，面板只显示 pending。
- 写入：CLI `~/.hermes/scripts/boss_pending_add.py --company X --name Y --job "岗位|薪资|城市" --conf N --reason R --draft D`
  （发送流程里 jev 判 review 时调用，把不敢自动发的草稿排队）；`--list` 看队列，`--mark KEY --status sent|dismissed` 回写。
- 面板回写：概览页「待你拍板」区块的 已发/忽略 按钮走 `op=pending_mark` RPC。
- 为什么有它：jev 阈值 0.90 很严（本批 22 条草稿 conf 全在 0.48-0.94），多数落 review →
  以前只能靠人当场拍、落不了盘就静默丢了。现在排队，人回头在面板里点一下即可。

## 审批与自动发送（2026-10-28）

用户口径：**「我切换状态，你检测到能发就发」**——授权动作从「在对话里点名」搬到面板点击。

三段链路，缺一段都不发：

1. **agent 写候选** → `boss_approvals.py add --json items.json`
   条目：`{id,date,company,jobTitle,salary,city,jobId,tier,evidence,gap,draft,draftHash,jdText,status}`
   `id` 形如 `20261028-<公司>-<encryptJobId>`，`draftHash` 自动算（sha1 前 16 位）。
2. **用户在「今天」的待发行上点「发送」（或点开弹窗后点「发送」）** → `op=approval_decide` 把 `status` 改成 `approved` 并写 `approvedAt`；
   点「跳过」写 `skipped`；已决策的卡可「撤回」回 `pending`。`sent/failed` 只能由发送侧写，面板无权。
3. **`boss_approval_runner.py` 每 10 分钟扫一次**（noagent 任务 `boss-approval-send`）：
   只挑 `approved` 且 `draftHash` 仍与草稿一致的条目 → 生成发件箱队列 → `BOSS_OUTBOX_CONFIRMED=1`
   `boss_outbox.sh start` → 轮询结果 → `settle` 回写 `sent|failed`（失败原因存 `sendResult`）。
   没有 approved 时**直接 IDLE 退出，不碰浏览器**。

授权语义：`approved + approvedAt + approvedDraftHash` 这条记录本身就是当次用户授权，脚本据此才设置
`BOSS_OUTBOX_CONFIRMED=1`；模型不再手写这个环境变量。三道约束缺一不发（2026-10-28 安全评审后加）：

- **授权有寿命**：`approvedAt` 超过 `BOSS_APPROVAL_TTL`（默认 1800 秒）自动退回 `pending`，
  并在 `note` 记 `approval_expired`。凌晨点过、第二天开机才发的情况不会发生。
- **授权绑定文案**：决策请求带 `draftHash`，与当前条目不一致直接拒（`stale_draft`）；
  面板同时保存 `approvedDraftHash`，出队时要求「批准的 hash == 当前 hash == 当前文案 hash」。
- **单向状态机**：`approved` 只能从 `pending`/`failed` 进，`sent` 不回退；面板侧写审计
  `~/.hermes/state/boss_approval_panel_audit.jsonl`（谁、何时、从什么状态改成什么、hash）。

## 数据契约

字段来源、必填时机、空值语义（「未采集」而不是空白）见 [docs/data-contract.md](docs/data-contract.md)。
体检：`python3 ~/.local/share/dsh-runtime/scripts/boss_approvals.py audit`（待发缺 JD/职位号 → `BLOCK` + exit 1）。

## 安全边界（2026-10-28 只读安全评审的实测结论）

- **RPC 不是裸路由**：`/api/boss-panel.rpc` 由宿主 `ctx.connection.fetch` 承载，无凭据 `401`、
  异源 Origin（含 `null`）`403`、GET `401`、`text/plain` 简单请求 `401`；插件自身不做鉴权，
  完全依赖宿主的 Origin 白名单 + Cookie。持 token 的本地进程仍可改状态 —— 所以加了上面的单向状态机与审计。
- **插件不 spawn 进程**：`index.js` 无 `child_process`，面板只写两个状态文件；真正发送在
  `boss_approval_runner.py`（noagent 定时任务），且有 `pgrep` 串行闸门。
- **无 XSS 面**：`client.js` 没有 `innerHTML`/`dangerouslySetInnerHTML`，招聘方消息正文按文本渲染。
- **落盘权限**：数据目录 `0700`、`boss_approvals.json`/`boss_thread_history.json`/`boss_threads_all.json`
  与 `~/.hermes/state/boss_*.json` 为 `0600`；面板与脚本写入都走「临时文件 + rename」并用 `0600`。
  队列/结果文件 `approval_queue_*.json` / `approval_result_*.json` 保留 7 天后自动清。
- **盲发拦截**：行内「发送」必须先打开过一次该条详情（看过 JD/草稿/对话），否则自动打开弹窗并提示；
  弹窗里常驻「10 分钟内后台发出；发出后不能撤回」。

发送前仍过两道闸：`boss_fact_gate.py`（事实越界 → `fact_blocked`，**不可覆盖**）与
`boss_shortlist_gate.py`（首触缺 `job`/`jd` 直接拒发）。首触且无历史会话时，
`boss_outbox_send.js` 会先用 `item.jobId` 打开 JD 页点「立即沟通」再发。

档位闸门的例外：审批队列的条目都是用户在面板上逐条看过 JD 与草稿后点的「通过并发送」，
所以队列里带 `shortlistOverride: true`，`boss_shortlist_gate.py` 判 REVIEW 时降级为
`FIT_WARN`（记进结果 `tail` 与审计），不再拦发。事实闸门没有这个例外 —— 文案里
碰到年限/上线状态等硬事实仍然直接 `fact_blocked`，只能改文案后让用户重新点。

### 发送链的坑（2026-10-28 实测，改之前先看）

`ego-browser` 是**常驻 daemon**，`ego_run.sh nodejs` 的脚本跑在 daemon 进程里，因此：

- **调用方的环境变量传不进去**（`BOSS_OUTBOX_CONFIRMED=1` 在脚本里是 `undefined`，daemon 里还可能残留很久以前的 `BOSS_OUTBOX_FILE`）；
- `ego_run.sh` 会把 `--xxx` 参数当自己的选项 `shift` 掉，后面的值反被当成脚本路径（报 `脚本不存在: /tmp/xxx.json`）。

所以确认信息只能走文件：

- `~/.hermes/state/boss_outbox_current.json` — `boss_outbox.sh start` 写的 `{queue,result,log,at}`，脚本**优先**读它（env/argv 只作手工直跑兜底）；
- `~/.hermes/state/boss_outbox_confirm.json` — 一次性令牌 `{queue,sha256,at,expires}`，读后即删，校验队列路径、内容指纹、10 分钟时效；
- `start` 前有 `pgrep -f boss_outbox_send.js` 串行闸门，另一个发送进程在跑就直接 `OUTBOX_BUSY` exit 3。

CLI 速查：

```
python3 boss_approvals.py add --json items.json   # 并入候选（已决策条目只更新事实字段）
python3 boss_approvals.py list [--status approved]
python3 boss_approvals.py stats
python3 boss_approvals.py queue --out /tmp/q.json [--dry]
python3 boss_approvals.py mark --id X --status pending|approved|skipped|sent|failed
python3 boss_approval_runner.py [--dry-run] [--quiet] [--notify]
```

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

## 界面设计（0.3.0）

面板改成 **概览仪表盘 + Tab 分区**，视觉完全走 `--dsw-alias-*` 主题 token（深浅色自动跟随系统）。

顶部固定标题区（标题 / 说明 / 更新时间 / 刷新按钮），下面是三个 Tab：

| Tab | 内容 |
| --- | --- |
| **审批**（2026-10-28） | 待发送的首触候选卡：证据／缺口／草稿 → 展开看 JD 全文、公司详情、完整聊天记录 → 「通过并发送 / 跳过」 |
| **概览** | 今日简报 → 6 张统计卡 → 状态分布条（8 状态按占比铺色带 + 图例）→ 双栏（需要行动 / 近期面试）→ 最近 14 天沟通柱 |
| **面试** | 面试日程表（7 列 + 天差 chip） |
| **会话** | 搜索框 + 状态多选 chips + 5 列会话表 |

「需要行动」只列 `待你决定` / `已读不回`，最多 6 条；点任一行打开详情弹窗。

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
- `boss_approvals.json` — 审批 Tab 的 通过/跳过/撤回（`op=approval_decide`，2026-10-28 起）

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

- 8 状态分类引擎：待你决定 / 已读不回 / 待回复 / 已约面试 / 已面试 / 等对方 / 可静默 / 已结束
  （优先级：AUDIT 人工复核 → OVR 人工覆盖 → 外包黑名单 → 硬规则正则（拒信/门槛/收尾 CLOSER/系统面试邀请 SYSTEM_INVITE）
  → 占位符 PLACEHOLDER_OWED → ACKPASS → JEV（「待回复」让位于 owed 硬证据）→ 面试表 → 未验证 → owed → 探针新行）
- 今日简报：待你决定 N 个（列公司）、已读不回 N 个、今日首触 N 条（A/B）
- 6 张统计卡：会话数 / 待你决定 / 已读不回 / 已约+已面 / 今日首触 / 今日 A/B
- 面试日程表：7 列 + 天差 chip（今天 / 明天 / N 天后 / 已过 N 天 / 待定）
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
node test/render_test.mjs     # 有状态渲染测试：驱动三个 Tab 切换，15 项断言
node test/approval_test.mjs   # 审批 Tab：12 张卡、通过/跳过按钮、点通过真的 POST approval_decide
node test/detail_test.mjs     # detail op 字段与聊天记录
```

`render_test.mjs` 用可变 `useState` 的 React 桩，模拟点击 Tab 按钮后重建组件树，
断言概览/面试/会话三个分区各自的区块、表头与筛选 chips 都在。

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
2. **用户在审批 Tab 点「通过并发送」** → `op=approval_decide` 把 `status` 改成 `approved` 并写 `approvedAt`；
   点「跳过」写 `skipped`；已决策的卡可「撤回」回 `pending`。`sent/failed` 只能由发送侧写，面板无权。
3. **`boss_approval_runner.py` 每 10 分钟扫一次**（noagent 任务 `boss-approval-send`）：
   只挑 `approved` 且 `draftHash` 仍与草稿一致的条目 → 生成发件箱队列 → `BOSS_OUTBOX_CONFIRMED=1`
   `boss_outbox.sh start` → 轮询结果 → `settle` 回写 `sent|failed`（失败原因存 `sendResult`）。
   没有 approved 时**直接 IDLE 退出，不碰浏览器**。

授权语义：`approved + approvedAt` 这条记录本身就是当次用户授权，脚本据此才设置
`BOSS_OUTBOX_CONFIRMED=1`；模型不再手写这个环境变量。审计流水：
`~/.hermes/state/boss_approval_audit.jsonl`（dispatch / blocked / settled / no_result）。

发送前仍过两道闸：`boss_fact_gate.py`（事实越界 → `fact_blocked`）与
`boss_shortlist_gate.py`（首触缺 `job`/`jd` 直接拒发）。首触且无历史会话时，
`boss_outbox_send.js` 会先用 `item.jobId` 打开 JD 页点「立即沟通」再发。

CLI 速查：

```
python3 boss_approvals.py add --json items.json   # 并入候选（已决策条目只更新事实字段）
python3 boss_approvals.py list [--status approved]
python3 boss_approvals.py stats
python3 boss_approvals.py queue --out /tmp/q.json [--dry]
python3 boss_approvals.py mark --id X --status pending|approved|skipped|sent|failed
python3 boss_approval_runner.py [--dry-run] [--quiet] [--notify]
```

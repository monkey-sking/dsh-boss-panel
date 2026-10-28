/**
 * dsh-boss-panel — BOSS 直聘求职面板（宿主半）
 *
 * 只读：把 job-search 工作流里的快照 JSON 汇总成一个视图，交给侧边栏面板渲染。
 * 不写任何求职数据、不调用模型、不触发探针。
 *
 * ⚠️ 2026-10-27 起，本文件是分类规则的**唯一权威实现**。
 * 原离线看板 boss-chat-status.html 及其渲染器 boss_dashboard_render.py 已停用
 * （重命名为 *.dormant-20261027 留档），探针脚本不再调用它——同一套规则维护两遍
 * 导致反复分叉，是那天面板状态错乱的主因。回归护栏见 test/classify_test.mjs。
 *
 * 数据文件（默认目录 ~/.local/share/dsh-data/workstreams/job-search）：
 *   boss_threads_all.json    深扫全量快照（2125 条，主表）
 *   boss_threads.json        探针最新快照（200 条，按 公司+对接人 覆盖主表）
 *   boss_jev_state.json      公司级状态判定
 *   interview_schedule.json  面试日程
 *   contacted.json           已沟通记录（含岗位/薪资/渠道/A-B tag）
 *   boss_thread_history.json 真实聊天正文（每 10 分钟补抓）
 *   company_meta.json        公司元信息（行业/规模/融资/城市）
 *   outsourcing_blacklist.json 外包黑名单
 *
 * 客户端走 ctx.connection.fetch 注册的精确路由 /api/boss-panel.rpc，
 * Connection 的 /api 前缀处理器已做 Host/Origin 围栏与签名 Cookie 鉴权。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

export const name = 'dsh-boss-panel'

/** 客户端读取面板数据的唯一 HTTP 入口。 */
export const RPC_PATH = '/api/boss-panel.rpc'

const DEFAULT_DATA_DIR = path.join(
  os.homedir(),
  '.local/share/dsh-data/workstreams/job-search',
)

const messageOf = (error) => (error instanceof Error ? error.message : String(error))

const operationError = (code, message) => Object.assign(new Error(message), { code })

// ---------------------------------------------------------------------------
// 分类引擎常量（唯一权威实现；改这里跑 node test/classify_test.mjs）
// ---------------------------------------------------------------------------

/**
 * 状态展示顺序。
 * 状态模型见 docs/state-model.md：八个状态归四类（要我做/等对方/不用管/需核对）。
 * 「已读不回」2026-10-27 已删除：48h 内归「等对方」，超 48h 归「已结束」。
 */
export const ORDER = [
  '待你决定',
  '待回复',
  '已约面试',
  '已面试',
  '未验证',
  '等对方',
  '可静默',
  '已结束',
]

/**
 * 人工复核表 / 人工覆盖（AUDIT、OVR）不写在代码里——那两张表装的是真实公司名和
 * 逐个会话的求职结论，属于个人数据，仓库是公开的。
 * 现在从数据目录的 boss-panel-overrides.json 读，格式：
 *   { "audit":    { "<公司>": ["<状态>", "<理由>"] },
 *     "override": { "<公司>": ["<状态>", "<建议>"] } }
 * 文件不存在就两张表都当空——分类引擎退回纯规则判定（正确行为，不是降级）。
 * 重新生成本机数据见 README「人工复核表」一节。
 */
let AUDIT = {}
let OVR = {}

/** 从数据目录装载 overrides；buildSnapshot/buildDetail 每次入口调一次。 */
async function loadOverrides(dataDir) {
  const doc = await readJson(path.join(dataDir, 'boss-panel-overrides.json'), {})
  const norm = (table) => {
    const out = {}
    if (!table || typeof table !== 'object') return out
    for (const [company, pair] of Object.entries(table)) {
      if (!Array.isArray(pair) || typeof pair[0] !== 'string') continue
      out[company] = [pair[0], typeof pair[1] === 'string' ? pair[1] : '']
    }
    return out
  }
  AUDIT = norm(doc.audit)
  OVR = norm(doc.override)
}

const REJ =
  /没有特别适合|没有合适|暂时没有|后续有机会|不太符合|不太匹配|与本阶段|招聘需求不太|不合适|不太合适|不适合|不太适合|不符合|不匹配|不够匹配|不匹配度|匹配度不高|抱歉|对不起|报歉|希望以后|希望未来|未来有|有更合适|有合适的机会|祝您|祝你在BOSS|祝一切顺利|祝求职|祝顺利|暂不|校招|已招满|岗位已|不是特别|暂未匹配|与岗位需求|与我们的需求|和岗位需求|需求不太匹配|申请人数|进入筛选|五个工作日|内部同步|同步给业务|评估中|有消息会|会尽快通知|已收到|简历已收到|收到您的|很遗憾|遗憾地通知|略有偏差|有些偏差|少许偏差|不会推进|暂缓推进|人才储备|储备库|不合适本岗位/

// Unicode word characters keep Chinese acknowledgements from being swallowed as punctuation.
const ACKFILTER =
  /^[^\p{L}\p{N}_]{0,4}(嗯+|哦+|好的?|行|收到|了解|明白|可以|ok|OK|谢谢|感谢|辛苦了|[\[［].{0,8}[\]］]|嗯+\s*理解|打扰啦|谢谢您|好)[^\p{L}\p{N}_]{0,4}$/u

const PAS =
  /^\s*(好的|好嘞|OK|ok|收到|行|嗯|了解了)|我整理一下|我先|我这边先|推荐给|反馈给|有后续|再联系|进入(了)?哈|发给(负责人|业务|面试官)/

const BARR = /(需要|要求|必须|需有|要有|最好有|得是).{0,10}背景/

const IRRELEVANT =
  /快递员|骑手|送餐|外卖员|配送员|司机|网约车|D本|C本|招生顾问|电话销售|保险代理/

/** ACKPASS 2026-10-27：流程告知（我先把简历给用人部门/有反馈再联系你），不是提问，无需回。 */
const ACKPASS =
  /(分享|转交|转发|递|推).{0,8}(用人部门|业务部门|业务|部门|面试官)|有(那边)?(的)?反馈.{0,6}(联系|通知)|尽快联系(你|您)|我们(会)?(尽快)?(审核|看看|跟进)/

const BOSS_PLACEHOLDER = /您正在与Boss.{0,12}沟通/

/**
 * CLOSER 2026-10-27（对方一句「好的呀，感谢关注呢」被挂「待回复」）：
 * 对方在收尾，不是在提问。ACKFILTER 只认整句客套，这类「客套 + 语气助词」的
 * 短收尾会漏过来，最后掉进 owed 兜底变「待回复」。
 *
 * 实现用「词表 + 尾缀」而不是一条巨长正则：中文收尾词组合太多，正则里任意
 * [^\p{L}]{0,3} 的缝隙在有 \p{L} 时容易咬错边界（实测「好的呀，感谢关注」会失配）。
 * 判定 = 短（≤CLOSER_MAX）+ 不含问询 + 去掉首尾标点后，全部由收尾词/尾缀拼成。
 */
const CLOSER_HEADS = [
  '好的呀', '好的', '好嘞', '好滴', '行吧', '行的', '收到', '明白', '了解', '理解',
  '谢谢', '感谢', '多谢', '打扰啦', '打扰了', '辛苦了', '辛苦您', '辛苦你',
  '客气', '不客气', '没问题', '可以', '嗯', '哦', 'OK', 'ok',
]
const CLOSER_TAILS = [
  '感谢关注', '感谢支持', '感谢您的关注', '感谢你的关注', '感谢', '谢谢',
  '祝顺利', '祝您好运', '祝你好运', '顺利', '好运', '早日找到', '找到满意的工作',
  '合作', '联系', '期待', '等候', '辛苦', '呢', '呀', '哈', '啦', '哦', '的',
  '您的回复', '你的回复', '沟通', '有时间',
]

/** 短消息长度上限：超过这个长度不算「一句客套收尾」。 */
const CLOSER_MAX = 20

/** 收尾判定：短 + 不含问询 + 由收尾词/尾缀拼成。 */
function isCloser(text) {
  let t = String(text ?? '').trim().replace(/^[^\p{L}\p{N}_]+|[^\p{L}\p{N}_]+$/gu, '')
  if (!t || t.length > CLOSER_MAX) return false
  if (/吗|？|\?|请问|能否|是否|方便|多少|如何|怎么|什么|哪个/.test(t)) return false
  // 去掉一个前导收尾词；剩余部分必须整体由一个尾缀词表条目拼完。
  let hit = false
  for (const head of CLOSER_HEADS) {
    if (t.startsWith(head)) { t = t.slice(head.length); hit = true; break }
  }
  if (!hit) return false
  t = t.replace(/^[^\p{L}\p{N}_]+/u, '')
  while (t.length) {
    const tail = CLOSER_TAILS.find((x) => t.startsWith(x))
    if (!tail) return false
    t = t.slice(tail.length).replace(/^[^\p{L}\p{N}_]+/u, '')
  }
  return true
}

/**
 * SYSTEM_INVITE 2026-10-27（一条系统面试邀请卡片被混在「待回复」）：
 * BOSS 官方面试邀请/确认接受卡片是**要我点操作**，不是要我打字回复。
 * 归「待你决定」，让面板把它顶到最上面等人处理。
 */
const SYSTEM_INVITE =
  /邀请您(现场|视频|电话)?面试|前往查看.{0,6}确认是否接受|确认是否接受|面试邀请/

/** contacted.json 里标记「点了但没送达」的 status；不计入今日首触。 */
const SEND_FAILED = /未成功|未送达|未建立会话|发送失败|失败/

// ---------------------------------------------------------------------------
// 通用小工具
// ---------------------------------------------------------------------------

/** 读 JSON；文件不存在或坏了都返回 fallback，不让面板整页报错。 */
async function readJson(file, fallback) {
  try {
    const text = await fs.readFile(file, 'utf8')
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

/** 严格读：区分「文件不存在」和「文件坏了」。审批状态不能把损坏当成空池。 */
async function readJsonStrict(file, fallback) {
  let text
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw operationError('read_failed', `读不到审批文件：${error?.message || error}`)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw operationError('corrupt_file', `审批文件不是合法 JSON（${error?.message || error}），先别改状态`)
  }
}

/**
 * 原子写：先写同目录临时文件（0600）再 rename。
 * 面板和 runner 会同时读写这份文件，直接 writeFile 会把 runner 刚写的 sent 覆盖回 approved。
 */
async function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, JSON.stringify(value, null, 1), { mode: 0o600 })
  await fs.rename(tmp, file)
}

/**
 * 每天一次改前备份（保留 7 天）。审批文件是「发过什么、谁点了什么」的唯一记录，
 * 原子写只能防半截文件，防不了逻辑写坏或人工误改，所以每天第一次写盘前留一份。
 */
async function backupApprovalsDaily(file) {
  try {
    const dir = path.join(path.dirname(file), 'backups')
    await fs.mkdir(dir, { recursive: true, mode: 0o700 })
    const day = new Date().toISOString().slice(0, 10)
    const dest = path.join(dir, `boss_approvals-${day}.json`)
    try {
      await fs.stat(dest)
      return
    } catch {
      /* 今天还没有备份，往下走 */
    }
    await fs.copyFile(file, dest, fs.constants.COPYFILE_EXCL)
    const names = (await fs.readdir(dir)).filter((name) => /^boss_approvals-\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort()
    for (const name of names.slice(0, Math.max(0, names.length - 7))) {
      await fs.unlink(path.join(dir, name)).catch(() => {})
    }
  } catch {
    /* 备份失败不拦用户操作 */
  }
}

/** 每次面板决策落一行审计：出了事能回答「谁在什么时候把哪一条改成了什么」。 */
async function appendApprovalAudit(entry, options = {}) {
  const dataDir = options.dataDir || DEFAULT_DATA_DIR
  const dir = path.join(dataDir, '..', '..', 'state')
  const file = path.join(dir, 'boss_approval_panel_audit.jsonl')
  try {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 })
    await fs.appendFile(file, `${JSON.stringify(entry)}\n`, { mode: 0o600 })
  } catch {
    /* 审计写不进去不能挡住用户的决策，但也不静默改状态以外的东西 */
  }
}

/** 把时间戳统一成 ISO 字符串，容忍秒/毫秒/无时区。 */
function toIso(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return new Date(value).toISOString()
  const text = String(value)
  const parsed = Date.parse(text)
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
  return null
}

const pad2 = (n) => String(n).padStart(2, '0')

/** 本地日期 YYYY-MM-DD。 */
function localDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/**
 * 距今天数。移植自 python days_since()：
 *   "10:23" → 0（今天）；"昨天" → 1；"前天" → 2；"10-23" → 按当年算，未来则退回上一年。
 */
function daysSince(text, today) {
  const value = String(text ?? '').trim()
  if (!value) return null
  if (/^\d{1,2}:\d{2}$/.test(value)) return 0
  if (value.startsWith('昨天')) return 1
  if (value.startsWith('前天')) return 2
  // 2026-10-28：BOSS 旧行常写成「10月23日」，原正则只认「10-23」，
  // 导致这些行 days=null，48h / 7 天 / 久未跟进等时间规则全部失效（未验证行永远卡住）。
  const cnm = /^(\d{1,2})月(\d{1,2})日/.exec(value)
  if (cnm) {
    let when = new Date(today.getFullYear(), Number(cnm[1]) - 1, Number(cnm[2]))
    if (Number.isNaN(when.getTime())) return null
    if (when > today) when = new Date(when.getFullYear() - 1, when.getMonth(), when.getDate())
    return Math.round((today.getTime() - when.getTime()) / 86400000)
  }
  const match = /^(\d{1,2})-(\d{1,2})/.exec(value)
  if (!match) return null
  let when = new Date(today.getFullYear(), Number(match[1]) - 1, Number(match[2]))
  if (Number.isNaN(when.getTime())) return null
  if (when > today) {
    when = new Date(when.getFullYear() - 1, when.getMonth(), when.getDate())
  }
  return Math.round((today.getTime() - when.getTime()) / 86400000)
}

/** 每行「下一步」建议。移植自 python nextstep()。 */
function nextStep(state, days, lastFrom) {
  if (state === '待你决定') return '等你拍板'
  if (state === '已约面试') return '确认时间地点'
  if (state === '已面试') return '等结果'
  if (state === '未验证') return '待下一轮深扫确认'
  if (state === '待回复') {
    return days !== null && days <= 1 ? '今天回' : '该跟一句'
  }
  if (state === '等对方') {
    if (days !== null && days >= 3 && days <= 5) return '可轻推一次'
    if (days !== null && days > 5) return '不必再等'
    return ''
  }
  return ''
}

/** 面试日期天差；不是合法 YYYY-MM-DD 返回 null。 */
function interviewDayDiff(dateText, today) {
  const value = String(dateText ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const when = new Date(y, m - 1, d)
  if (Number.isNaN(when.getTime())) return null
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((when.getTime() - base.getTime()) / 86400000)
}

/** 面试日程自洽检查：when 里的日期/星期必须与 date 字段一致。 */
export function interviewDateWarning(whenText, dateText) {
  const when = String(whenText ?? '').trim()
  const date = String(dateText ?? '').trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return '日期格式无法核实'
  const [year, month, day] = match.slice(1).map(Number)
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return '日期字段无效'

  const issues = []
  for (const hit of when.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    if (hit[0] !== date) issues.push(`when 写 ${hit[0]}，date 写 ${date}`)
  }
  const weekday = /(?:周|星期|礼拜)([一二三四五六日天])/.exec(when)
  if (weekday) {
    const names = '一二三四五六日'
    const wanted = names.indexOf(weekday[1] === '天' ? '日' : weekday[1])
    const actual = parsed.getDay() === 0 ? 6 : parsed.getDay() - 1
    if (wanted !== actual) {
      issues.push(`${date} 实际是周${names[actual]}，日程写周${weekday[1]}`)
    }
  }
  return [...new Set(issues)].join('；')
}

/**
 * 按岗位名给轨道线索。这里没有 JD 正文，所以 AI 产品只标「待核实」，不能定级。
 */
export function roleTrack(job) {
  const text = String(job ?? '').trim()
  if (!text) return { code: 'UNVERIFIED', label: '待核实', evidence: '缺岗位名和 JD' }
  if (/敌人.{0,8}(?:AI|行为|战斗)|(?:战斗|NPC)\s*AI|行为树|StateTree|MassAI/i.test(text)) {
    return { code: 'GAME_AI', label: '游戏AI', evidence: '岗位名命中敌人AI/战斗AI/行为/UE技术' }
  }
  if (
    /(?:技术策划|工具策划).{0,12}(?:工具|研发效能|工具链|编辑器|管线|工作流)/.test(text)
    || /(?:工具|研发效能|工具链|编辑器|管线|工作流).{0,12}(?:技术策划|工具策划)/.test(text)
  ) {
    return { code: 'GAME_DEV_TOOL', label: '研发工具', evidence: '岗位名命中技术策划/工具/管线' }
  }
  if (/小游戏|休闲|消除|换皮|IAA/.test(text) && !/AI|敌人|行为|技术策划/.test(text)) {
    return { code: 'MISMATCH', label: '错配风险', evidence: '普通小游戏/休闲岗位，未见 AI 或行为职责' }
  }
  if (/AI|大模型|Agent|智能体|AIGC/i.test(text) && /产品|策划|产品工程/.test(text)) {
    return {
      code: 'AI_PRODUCT_VERIFY',
      label: 'AI产品·待核实',
      evidence: '岗位名有 AI 产品线索，仍需 JD 证明需求/原型/验收职责',
    }
  }
  if (/战斗策划|UE技术策划|技术策划/.test(text)) {
    return {
      code: 'NEEDS_JD',
      label: '待核实',
      evidence: '岗位名只说明战斗/技术方向，需 JD 证明敌人 AI 与行为职责',
    }
  }
  if (/策划|设计/.test(text)) {
    return { code: 'NEEDS_JD', label: '待核实', evidence: '岗位名不足以判断轨道，需读 JD' }
  }
  return { code: 'UNVERIFIED', label: '待核实', evidence: '未命中已登记轨道' }
}

/**
 * 求职代理护栏汇总。这里只展示可验证的本地状态：闸门文件是否存在、哪些
 * 简历版本被阻断、哪些岗位待核实/错配，以及日程冲突数量；不推断发送权限。
 */
export function buildAgentAudit({
  threads = [],
  interviews = [],
  resumeVersions = {},
  factGateInstalled = false,
  resumeGateInstalled = false,
} = {}) {
  const trackCounts = {
    GAME_AI: 0,
    GAME_DEV_TOOL: 0,
    AI_PRODUCT_VERIFY: 0,
    MISMATCH: 0,
    UNVERIFIED: 0,
  }
  const mismatchCompanies = []
  const unverifiedCompanies = []

  for (const thread of Array.isArray(threads) ? threads : []) {
    const code = thread?.track?.code
    if (code === 'MISMATCH') {
      trackCounts.MISMATCH += 1
      if (thread.company) mismatchCompanies.push(thread.company)
      continue
    }
    if (code === 'NEEDS_JD' || code === 'UNVERIFIED' || !code) {
      trackCounts.UNVERIFIED += 1
      if (thread?.company) unverifiedCompanies.push(thread.company)
      continue
    }
    if (code in trackCounts) trackCounts[code] += 1
  }

  const resumes =
    resumeVersions?.resumes && typeof resumeVersions.resumes === 'object'
      ? resumeVersions.resumes
      : {}
  const blockedResumes = Object.entries(resumes)
    .filter(([, entry]) => !entry || entry.approved_for_send !== true)
    .map(([name, entry]) => ({
      name,
      track: String(entry?.track ?? ''),
      reason: String(entry?.review_required_reason ?? '尚未复核'),
    }))

  const scheduleConflicts = (Array.isArray(interviews) ? interviews : [])
    .filter((item) => item?.dateWarning)
    .map((item) => ({
      company: String(item.company ?? ''),
      when: String(item.when ?? item.date ?? ''),
      warning: String(item.dateWarning),
    }))

  return {
    factGateInstalled: factGateInstalled === true,
    resumeGateInstalled: resumeGateInstalled === true,
    blockedResumes,
    scheduleConflicts,
    trackCounts,
    mismatchCompanies: [...new Set(mismatchCompanies)].slice(0, 8),
    unverifiedCompanies: [...new Set(unverifiedCompanies)].slice(0, 8),
  }
}

// ---------------------------------------------------------------------------
// 归一化
// ---------------------------------------------------------------------------

function normalizeThread(row) {
  if (!row || typeof row !== 'object') return null
  const company = String(row.company ?? '').trim()
  const who = String(row.name ?? '').trim()
  if (!company && !who) return null
  return {
    company,
    who,
    state: String(row.state ?? '').trim(),
    time: String(row.time ?? '').trim(),
    delivery: String(row.delivery ?? '').trim(),
    last: String(row.last ?? '').trim(),
    lastFrom: String(row.lastFrom ?? '').trim(),
    owed: row.owed === true,
    full: String(row.full ?? '').trim(),
    preview: String(row.preview ?? '').trim(),
    fresh: row.__fresh === true,
    unverified: row.__unverified === true,
    // BOSS 的系统卡（「我想要一份您的附件简历，是否同意」）不是普通消息：
    // 末条是它时，「等对方」其实是「等你点同意」，行内不提示就会以为已经处理完。
    consent: /是否同意|想要一份您的附件简历|发送简历/.test(String(row.last ?? '')),
  }
}

function normalizeContact(row) {
  if (!row || typeof row !== 'object') return null
  const company = String(row.company ?? '').trim()
  if (!company) return null
  return {
    date: String(row.date ?? '').trim(),
    company,
    job: String(row.job ?? '').trim(),
    recruiter: String(row.recruiter ?? '').trim(),
    salary: String(row.salary ?? '').trim(),
    city: String(row.city ?? '').trim(),
    status: String(row.status ?? '').trim(),
    tag: String(row.tag ?? '').trim(),
    channel: String(row.channel ?? '').trim(),
    note: String(row.note ?? '').trim(),
  }
}

// ---------------------------------------------------------------------------
// 快照构建
// ---------------------------------------------------------------------------

/** 文件级 mtime 缓存：只在 mtime 变化后重读，避免每次请求解析几 MB JSON。 */
const cache = new Map()

async function readCached(file, fallback) {
  let stat = null
  try {
    stat = await fs.stat(file)
  } catch {
    return { value: fallback, mtime: 0, missing: true }
  }
  const entry = cache.get(file)
  if (entry && entry.mtime === stat.mtimeMs) return entry
  const value = await readJson(file, fallback)
  const next = { value, mtime: stat.mtimeMs, missing: false }
  cache.set(file, next)
  return next
}

function fileSet(dataDir) {
  return {
    threads: path.join(dataDir, 'boss_threads.json'),
    all: path.join(dataDir, 'boss_threads_all.json'),
    interview: path.join(dataDir, 'interview_schedule.json'),
    contacted: path.join(dataDir, 'contacted.json'),
    jev: path.join(dataDir, 'boss_jev_state.json'),
    history: path.join(dataDir, 'boss_thread_history.json'),
    handled: path.join(dataDir, 'boss_handled.json'),
    meta: path.join(dataDir, 'company_meta.json'),
    blacklist: path.join(dataDir, 'outsourcing_blacklist.json'),
    pending: path.join(dataDir, 'boss_pending_decisions.json'),
    approvals: path.join(dataDir, 'boss_approvals.json'),
    resumeVersions: path.join(dataDir, 'resume_versions.json'),
    factGate: path.join(os.homedir(), '.hermes/scripts/boss_fact_gate.py'),
    resumeGate: path.join(os.homedir(), '.hermes/scripts/boss_resume_gate.py'),
  }
}

/** 黑名单展平成 Set（verified / known_outsourcing_style / companies / names 四个字段）。 */
function flattenBlacklist(doc) {
  const out = new Set()
  if (!doc || typeof doc !== 'object') return out
  for (const key of ['verified', 'known_outsourcing_style', 'companies', 'names']) {
    const list = doc[key]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (typeof item === 'string' && item) out.add(item)
      else if (item && typeof item === 'object' && item.name) out.add(String(item.name))
    }
  }
  return out
}

/**
 * 「待你拍板」队列：jev 判 review 的草稿不再静默丢弃，落盘排队等人在面板里拍。
 * 文件格式 {items:[{id,key,company,name,job,reason,conf,draft,addedAt,status,sentAt}]}；
 * status: pending（待拍）/ sent（已发）/ dismissed（已忽略）。面板只显示 pending。
 */
function normalizePending(doc) {
  const items = Array.isArray(doc?.items) ? doc.items : []
  const out = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const company = String(item.company ?? '').trim()
    if (!company) continue
    const status = String(item.status ?? 'pending')
    if (status !== 'pending') continue
    const draft = String(item.draft ?? '').trim()
    if (!draft) continue
    const name = String(item.name ?? '').trim()
    out.push({
      id: String(item.id ?? `${name}|${company}`),
      key: `${name}|${company}`,
      company,
      name,
      job: String(item.job ?? '').trim(),
      reason: String(item.reason ?? '').trim(),
      conf: Number.isFinite(Number(item.conf)) ? Number(item.conf) : null,
      draft,
      addedAt: toIso(item.addedAt),
    })
  }
  out.sort((a, b) => String(b.addedAt ?? '').localeCompare(String(a.addedAt ?? '')))
  return out.slice(0, 40)
}

/**
 * 按 公司+对接人 把探针最新行覆盖到深扫主表上，并给命中的行打 fresh 标记。
 * 未命中探针的旧行清掉 owed，并标记未验证，避免把未覆盖的会话静默藏起来。
 */
function mergeFresh(allDoc, freshDoc) {
  const rows = Array.isArray(allDoc?.rows) ? allDoc.rows.map((r) => ({ ...r })) : []
  const freshRows = Array.isArray(freshDoc?.rows) ? freshDoc.rows : []
  const keyOf = (r) => `${String(r.company ?? '').trim()}|${String(r.name ?? '').trim()}`
  const freshMap = new Map(freshRows.map((r) => [keyOf(r), r]))

  for (const row of rows) {
    const fresh = freshMap.get(keyOf(row))
    if (!fresh) {
      row.owed = false
      row.__unverified = true
      continue
    }
    row.__fresh = true
    for (const field of ['last', 'lastFrom', 'delivery', 'owed', 'time', 'full']) {
      const value = fresh[field]
      if (value !== undefined && value !== null && value !== '') row[field] = value
    }
  }

  // MERGE_PROBE：主表里没有的公司，用探针行补到最前面。
  const byCompany = new Map(freshRows.map((r) => [String(r.company ?? ''), r]))
  const known = new Set(rows.map((r) => String(r.company ?? '')))
  for (const row of rows) {
    const fresh = byCompany.get(String(row.company ?? ''))
    if (!fresh) continue
    for (const field of ['last', 'lastFrom', 'delivery', 'time']) {
      if (fresh[field]) row[field] = fresh[field]
    }
  }
  for (const [company, fresh] of byCompany) {
    if (!known.has(company)) rows.unshift({ ...fresh, __fresh: true })
  }

  return { rows, ts: freshDoc?.ts ?? allDoc?.ts ?? null }
}

/** 公司元信息：先精确匹配，再双向模糊匹配（FUZZMETA）。 */
function makeMetaLookup(meta) {
  const table = meta && typeof meta === 'object' ? meta : {}
  return (company) => {
    let entry = table[company]
    if (entry) return entry
    for (const [key, value] of Object.entries(table)) {
      if (!key) continue
      if (String(company).includes(key) || key.includes(String(company))) return value
    }
    return {}
  }
}

/** 沟通记录索引：公司+对接人 → 最新一条；公司 → 最新一条。 */
function buildContactIndex(contacts) {
  const byPair = new Map()
  const byCompany = new Map()
  const firstByCompany = new Map()
  for (const item of contacts) {
    const company = item.company
    const recruiter = item.recruiter.split('\u00b7')[0].trim()
    if (!firstByCompany.has(company)) firstByCompany.set(company, item)
    if (!item.job) continue
    if (recruiter) {
      const key = `${company}\u0000${recruiter}`
      const prev = byPair.get(key)
      if (!prev || item.date >= prev.date) byPair.set(key, item)
    }
    const prevCompany = byCompany.get(company)
    if (!prevCompany || item.date >= prevCompany.date) byCompany.set(company, item)
  }
  return { byPair, byCompany, firstByCompany }
}

/**
 * 构建面板快照。
 *
 * @param {{dataDir?: string}} options
 * @returns {Promise<object>}
 */
export async function buildSnapshot(options = {}) {
  const dataDir = options.dataDir || DEFAULT_DATA_DIR
  await loadOverrides(dataDir)
  const files = fileSet(dataDir)
  const today = options.today instanceof Date ? options.today : new Date()
  const todayKey = localDateKey(today)

  const [
    allDoc,
    freshDoc,
    interviewDoc,
    contactedDoc,
    jevDoc,
    historyDoc,
    metaDoc,
    blacklistDoc,
    pendingDoc,
    approvalsDoc,
    apptDoc,
    handledDoc,
    resumeVersionsDoc,
    factGateInstalled,
    resumeGateInstalled,
  ] = await Promise.all([
      readCached(files.all, { rows: [] }),
      readCached(files.threads, { rows: [] }),
      readCached(files.interview, { items: [] }),
      readCached(files.contacted, { entries: [] }),
      readCached(files.jev, {}),
      readCached(files.history, { threads: {} }),
      readCached(files.meta, {}),
      readCached(files.blacklist, {}),
      readCached(files.pending, { items: [] }),
      readCached(files.approvals, { items: [] }),
      readCached(path.join(dataDir, 'appointments.json'), { items: [] }),
      readCached(files.handled, {}),
      readCached(files.resumeVersions, { resumes: {} }),
      fs.stat(files.factGate).then(() => true).catch(() => false),
      fs.stat(files.resumeGate).then(() => true).catch(() => false),
    ])

  const version = [
    allDoc.mtime,
    freshDoc.mtime,
    interviewDoc.mtime,
    contactedDoc.mtime,
    jevDoc.mtime,
    historyDoc.mtime,
    metaDoc.mtime,
    blacklistDoc.mtime,
    pendingDoc.mtime,
    approvalsDoc.mtime,
    apptDoc.mtime,
    handledDoc.mtime,
    resumeVersionsDoc.mtime,
    // 「今天」是构建时算的：跨零点后文件都没写，客户端拿着 since 就会一整天显示昨天的天数（工程评审 #3）。
    localDateKey(new Date()),
  ].join('-')

  const merged = mergeFresh(allDoc.value, freshDoc.value)
  const rows = merged.rows.map(normalizeThread).filter(Boolean)

  const jev = jevDoc.value && typeof jevDoc.value === 'object' ? jevDoc.value : {}
  const blacklist = flattenBlacklist(blacklistDoc.value)
  const metaOf = makeMetaLookup(metaDoc.value)

  const interviewsRaw = Array.isArray(interviewDoc.value?.items) ? interviewDoc.value.items : []
  const interviewByCompany = new Map(
    interviewsRaw
      .filter((item) => item && typeof item === 'object')
      .map((item) => [String(item.company ?? '').trim(), item]),
  )
  // APPT 2026-10-27（用户：「要给打电话的那个不算面试吗？」）：
  // 约「电话沟通/线上初聊」也是面试——同样占用户时间、需要他本人出面应付。
  // 之前只读 interview_schedule.json，逻辑控股 16:30 那通电话在看板的「已约面试」里是漏的。
  // 这里把 appointments.json 里已明确约好时间、且没取消/没面完的电话/线上沟通补进 ivm，
  // 走与线下约面完全相同的「已约面试」分类，不另开状态，避免两边口径再分叉。
  // 唯一的权威实现；离线看板侧（_appt_items）已于 2026-10-27 停用。
  const apptItems = Array.isArray(apptDoc.value?.items) ? apptDoc.value.items : []
  for (const item of apptItems) {
    if (!item || typeof item !== 'object') continue
    const kind = String(item.kind ?? item.mode_kind ?? '')
    if (kind !== 'phone' && kind !== 'online') continue
    const company = String(item.company ?? '').trim()
    if (!company || interviewByCompany.has(company)) continue
    const st = String(item.state ?? '')
    if (/已取消|已结束|已完成|不去了|取消/.test(st)) continue
    interviewByCompany.set(company, {
      company,
      who: item.who ?? '',
      job: item.job ?? '',
      when: item.when ?? '',
      mode: item.mode ?? '电话沟通',
      state: st || '已约好时间',
      next: item.next ?? '',
    })
  }

  const contactRows = Array.isArray(contactedDoc.value?.entries) ? contactedDoc.value.entries : []
  const contacts = contactRows.map(normalizeContact).filter(Boolean)
  const contactIndex = buildContactIndex(contacts)

  // HANDLED 2026-10-27（用户：「你每次不记录上次的状态吗？」）：
  //   人工/流程复核过的会话记一条签名（时间|预览前 60 字 + 结论），
  //   下一轮只要会话没变化就直接沿用结论，不再反复挂待回复、也不再重复判。
  //   会话里只要有新消息，time/预览必变 → 签名失效 → 自动重新判。
  const handledMap = new Map()
  for (const [company, rec] of Object.entries(handledDoc.value || {})) {
    if (!company || !rec || typeof rec !== 'object') continue
    handledMap.set(String(company).trim(), rec)
  }

  // 聊天正文：key 形如「对接人|公司」，取 | 后面那段当公司名；只保留真有消息的。
  const historyRaw = historyDoc.value?.threads
  const history = new Map()
  if (historyRaw && typeof historyRaw === 'object') {
    for (const [key, value] of Object.entries(historyRaw)) {
      const company = key.includes('|') ? key.split('|').pop().trim() : key.trim()
      const msgs = Array.isArray(value?.msgs) ? value.msgs : []
      if (company && msgs.length) history.set(company, msgs)
    }
  }

  // --- 分类引擎（逐行移植 classify()）-------------------------------------
  const isBlacklisted = (company) => {
    if (!blacklist.size) return false
    const text = String(company ?? '')
    for (const item of blacklist) {
      if (item && text.includes(item)) return true
    }
    return false
  }

  // 会话签名：与 `boss_mark.py` 写入的格式必须逐字一致（时间|预览前 60 字）。
  const sigOfRow = (row) =>
    `${row.time || ''}|${String(row.full || row.last || row.preview || '').slice(0, 60)}`

  // 外部 JSON 里手写的状态字串不能直接进桶：一个错字会造出 filters 选不到的幽灵状态（工程评审 #7）。
  const STATE_SAFE = new Set(ORDER)
  const safeState = (value, fallback = '等对方') => {
    const text = String(value ?? '').trim()
    return STATE_SAFE.has(text) ? text : fallback
  }

  const classify = (row) => {
    const company = row.company
    // HANDLED：人工复核过的结论优先（比 AUDIT 更细，AUDIT 是公司级、这是「这一次对话」级）。
    //   会话一变签名就失效，所以不会把新消息压掉。
    const hrec = handledMap.get(company)
    if (hrec && hrec.sig && hrec.sig === sigOfRow(row)) return safeState(hrec.state)
    // SELFTAIL 2026-10-25：人工覆盖写的是「待你决定」但末条其实是我方且已送达/已读时，
    // 球在对方，必须降级成「等对方」——否则面板长期挂着假待办（用户会以为有活没干）。
    // AUDIT（人工复核）优先级高于 OVR：2026-10-27 全量审计的 15 条结论。
    if (Object.prototype.hasOwnProperty.call(AUDIT, company)) {
      const audited = AUDIT[company][0]
      const selfTailAudit = row.lastFrom === '我' && String(row.delivery ?? '').trim() !== ''
      if (audited === '待你决定' && selfTailAudit) return '等对方'
      return safeState(audited)
    }
    if (Object.prototype.hasOwnProperty.call(OVR, company)) {
      const override = OVR[company][0]
      const selfTail = row.lastFrom === '我' && String(row.delivery ?? '').trim() !== ''
      if (override === '待你决定' && selfTail) return '等对方'
      return safeState(override)
    }
    if (isBlacklisted(company)) return '已结束'

    const text = String(row.last || row.full || row.preview || '')
    const fullText = String(row.full || row.last || row.preview || '')

    // ORDER_FIX：硬规则优先，jev 覆盖次之，owed 兜底。
    // 2026-10-26 整段上移到 jev 之前：对方明确婉拒/门槛不符/不相关岗位/系统占位符，
    // 不该被公司级的 jev 旧判定盖住——否则「不太合适」的拒信也会挂成「等对方」。
    // SELFCARE 2026-10-26：REJ 是照「对方」的话写的，我方末条也可能出现「抱歉/谢谢」，
    // 不能把我说的话当拒信。末条是我方时交给后面的 jev/owed/已读规则判。
    // REJLAST 2026-10-28：full 可能是列表占位符（「您正在与BossX沟通」），而真正的婉拒句
    // 躺在 last 里 —— 只测 fullText 会漏判。两处都测。
    if (row.lastFrom !== '我' && (REJ.test(fullText) || REJ.test(text))) return '已结束'
    // CANCEL 2026-10-28：「取消了面试 / 面试取消 取消原因:职位已删除」是系统或对方的**结果通知**，
    // 不是提问。凡宝 16:12「取消了面试」曾被 owed 兜底成「待回复」，白占一条待办。
    // 注意只认「取消+面试」这种结果句，别把「能取消吗」这类问句误判。
    if (/取消了?面试|面试(已)?取消|取消原因/.test(fullText) && !/吗|？|\?/.test(text)) return '已结束'
    // SELFCLOSE 2026-10-26：末条是我方主动收尾（「就不占您时间了/祝顺利」），
    // 会话已经结束，别再挂成「等对方/待回复」。
    if (
      row.lastFrom === '我' &&
      /不占(用)?(您|你)时间|不耽误(您|你)时间|先不打扰|就不打扰|不是我的方向/.test(text)
    ) {
      return '已结束'
    }
    // 门槛答复：「需要k12背景的」= 对方给了硬门槛且我方不符，不应记「待回复」。
    if (BARR.test(fullText) && !/吗|？|\?|请问/.test(text)) return '已结束'
    if (IRRELEVANT.test(text)) return '已结束'
    // BOSS 占位符「您正在与BossX沟通」是系统消息，不是对方在等我回复。
    // PLACEHOLDER_OWED 2026-10-27（三起「占位符盖掉真提问」的漏回事故）：
    // 占位符只是**列表预览**被系统消息顶掉，真实末条往往就在下面（「你好啊，可以聊一聊~」+ 简历请求卡）。
    // owed 说明列表侧判定有未读 → 必须挂「待回复」逼一次 live 复核，不能就地压成「等对方」。
    if (BOSS_PLACEHOLDER.test(text)) {
      return row.owed ? '待回复' : '等对方'
    }
    // ACKPASS：「我先把简历分享给用人部门/有反馈会联系你/我们会尽快审核」是流程告知，
    // owed 会把它误判成欠回复（实测有会话就因此被挂成待回复）。它不是提问，不需要我回。
    if (row.lastFrom !== '我' && ACKPASS.test(fullText)) return '等对方'
    // CLOSER 2026-10-27：对方一句客套收尾（「好的呀，感谢关注呢」）不是提问，别用 owed 兜底成待回复。
    if (row.lastFrom !== '我' && isCloser(fullText)) return '已结束'
    // SYSTEM_INVITE 2026-10-27：系统面试邀请是「要我点操作」，不是「要我打字回复」。
    // 必须排在 owed 兜底之前，否则会被算进待回复，和真人提问混在一起没法区分。
    if (SYSTEM_INVITE.test(fullText)) return '待你决定'

    // JEVSTALE 2026-10-26：jev 是批处理快照（几天才跑一次）。快照说「球在对方」，
    // 但最新一条其实是对方在问我问题 → 快照已过期，以真实对话为准，别把该我回的
    // 会话长期压在「等对方」里（例：对方 11:59 问「是否在深圳」，看板仍显示等对方）。
    const jevState = jev[company]
    const jevStale =
      (jevState === '等对方' || jevState === '待回复') &&
      row.lastFrom === '对方' &&
      /吗|？|\?|请问|能否|是否|方便|期望|薪资|到岗|面试|接受|同意|确认/.test(text)

    // JEVFIRST：状态以 jev 判定为准，正则只在 jev 没覆盖时兜底。
    // JEVDEFER 2026-10-27：但 jev「待回复」不能抢在 owed 硬证据之前——jev 是几天才跑一次的
    // 批处理快照，它说「待回复」时 owed 才是当期权威；反过来 jev 的「已结束/等对方/待你决定」
    // 是保守判定（对方已收尾/球在对方），可以压过 owed 的粗红点信号。
    // 事故：明明命中 ACKPASS 了，却被 jev 旧快照「待回复」拉回来。
    if (
      jevState &&
      !jevStale &&
      ['已结束', '等对方', '待你决定'].includes(jevState)
    ) {
      if (jevState === '待你决定' && (daysSince(row.time, today) ?? 0) > 7) return '可静默'
      return jevState
    }

    const iv = interviewByCompany.get(company)
    if (iv) {
      const blob = `${iv.state ?? ''}|${iv.when ?? ''}`
      if (blob.includes('已面试') || blob.includes('不合适')) return '已面试'
      // 「收了简历/转面试官/等反馈」不等于约了面试。
      const soft = /简历|反馈|待定|未定|等对方/.test(blob)
      const hard = /\d{1,2}:\d{2}|月\d{1,2}日|周[一二三四五六日]/.test(blob)
      if (soft && !hard) return '等对方'
      return '已约面试'
    }

    if (jevState && row.fresh && !jevStale && jevState !== '待回复') {
      let state = jevState
      if (state === '待你决定' && (daysSince(row.time, today) ?? 99) > 7) state = '可静默'
      // TIGHTEN：jev 的「待你决定」必须带具体可拍板事项。
      if (
        state === '待你决定' &&
        !/面试|简历|时间|地点|地址|薪资|期望|到岗|是否|能不能|方便/.test(text)
      ) {
        state = '等对方'
      }
      return safeState(state)
    }
    if (jevState && !row.fresh && jevState === '已结束') return '已结束'

    if (
      row.unverified &&
      row.lastFrom !== '我' &&
      !/附件简历|已发送|对方已同意|已发送给对方|\.pdf|点击查看附件|欢迎投递|^收到$|^好的$|^OK/.test(fullText)
    ) {
      // UNVSTALE 2026-10-28：探针扫不到的旧行（BOSS 列表只保留近 176 条）会永远挂在
      // 「未验证」，例如 10-19「合适和您电话具体沟通」这种 9 天前的被动告知就是典型。
      // 超过 7 天已无跟进价值 → 归「已结束」，别让一个查不到的会话长期占着待核对。
      const d = daysSince(row.time, today)
      if (d !== null && d >= 7) return '已结束'
      return '未验证'
    }

    if (row.owed) {
      if (ACKFILTER.test(fullText.trim())) return '已结束'
      if (/附件简历|已发送给对方|对方已同意/.test(fullText)) return '等对方'
      if (row.lastFrom === '我') return '等对方'
      if (/卡学历|要求.{0,8}本科|需要k12背景/.test(fullText)) return '已结束'
      return '待回复'
    }

    // ONLYFRESH：只有探针里的新行才配判「待你决定」，旧快照的预览文本不可信。
    if (!row.fresh) {
      // LASTFROMME 2026-10-28：问号只能算「对方在问我」。我方刚发出去的首触草稿里
      // 也常带「是硬线吗？」这类问句，之前被误判成待你决定，用户看到就是「我拍板什么？」
      if (row.lastFrom === '对方' && /吗|？|\?|请问|能否|是否|方便|面试|薪资|到岗/.test(text)) {
        const days = daysSince(row.time, today)
        if (days !== null && days <= 3 && /吗|？|\?|请问|能否|是否|方便/.test(text)) {
          return '待你决定'
        }
        return '可静默'
      }
    }

    if (row.lastFrom === '对方') {
      if (REJ.test(fullText)) return '已结束'
      if (ACKFILTER.test(fullText.trim())) return '已结束'
      if (IRRELEVANT.test(text)) return '已结束'
      if (/附件简历|同意|已发送|点击预览|\.pdf/.test(text)) return '等对方'
      if (PAS.test(text)) return '等对方'
      if (/外派|外包|驻场|派遣|人力外包/.test(text)) return '可静默'
      // STATEFIX2：婉拒/通知类再细分，别都堆进「待你决定」。
      if (/不是很相符|不相符|有少许偏差|少许偏差|有偏差/.test(text)) return '已结束'
      if (/硬性要求.{0,40}才合适|硬性要求.{0,40}合适/.test(text)) return '已结束'
      if (/会比较有优势|可能投递/.test(text)) return '可静默'
      if (/通过初筛后会联系|会跟进.{0,10}匹配|岗位比较多|会尽快通知/.test(text)) return '等对方'
      if (
        /吗|？|\?|请问|能否|是否|方便|期望|薪资|到岗|面试|接受|同意|确认|简历/.test(text)
      ) {
        return '待你决定'
      }
      return '可静默'
    }

    // READ_TIMEOUT 2026-10-27（用户：「已读不回 过48小时，就不用管了。
    //   就两个状态等回复，超时不管。」）
    //   我方末条 + 对方已读 + 没回 = 本质还是在等对方回 → 归「等对方」。
    //   超过 48h（BOSS 时间粒度只到「昨天/前天/日期」，用 days≥2 近似）→ 「已结束」，不再管。
    if (row.lastFrom === '我' && String(row.delivery ?? '').includes('已读')) {
      const days = daysSince(row.time, today)
      if (days !== null && days >= 2) return '已结束'
    }

    return '等对方'
  }

  // --- 逐行产出 -----------------------------------------------------------
  const byState = Object.fromEntries(ORDER.map((state) => [state, 0]))
  const threads = []
  const skippedRows = { noCompany: 0 }
  for (const row of rows) {
    // 公司名为空的行点开是空弹窗，也不该计入「沟通对象」（审计 #7）。
    if (!String(row.company ?? '').trim()) {
      skippedRows.noCompany += 1
      continue
    }
    const state = classify(row)
    const days = daysSince(row.time, today)
    byState[state] = (byState[state] ?? 0) + 1

    const contact = contactIndex.firstByCompany.get(row.company)
    const pairKey = `${row.company}\u0000${row.who.split('\u00b7')[0].trim()}`
    const pairContact = contactIndex.byPair.get(pairKey)
    const job =
      contact?.job ||
      pairContact?.job ||
      contactIndex.byCompany.get(row.company)?.job ||
      ''
    const salary = contact?.salary || ''

    threads.push({
      company: row.company,
      who: row.who,
      state,
      days,
      next: nextStep(state, days, row.lastFrom),
      time: row.time,
      delivery: row.delivery.replace(/[[\]]/g, ''),
      last: row.last,
      lastFrom: row.lastFrom,
      job,
      salary,
      // 只留 120 字：客户端只当 title/aria-label 用，全文留在原文件（工程评审 #4）。
      track: (() => {
        const role = roleTrack(job)
        return role && role.evidence ? { ...role, evidence: String(role.evidence).slice(0, 120) } : role
      })(),
      fresh: row.fresh,
    })
  }

  // 排序：按状态优先级，再按距今天数（越久越靠后）。
  threads.sort((a, b) => {
    const rank = ORDER.indexOf(a.state) - ORDER.indexOf(b.state)
    if (rank !== 0) return rank
    return (b.days ?? 999) - (a.days ?? 999)
  })

  // --- 今日 A/B 首触统计 ---------------------------------------------------
  // SENTONLY: contacted.json 里也有「首触未成功」的记录（点击了但没建立会话）。
  // 那些不是送达，不能计入今日首触，否则数字看着涨了、会话列表却没有任何新行。
  const ab = { A: 0, B: 0 }
  const failedCompanies = []
  for (const item of contacts) {
    if (String(item.date).slice(0, 10) !== todayKey) continue
    if (SEND_FAILED.test(item.status)) {
      if (item.company) failedCompanies.push(item.company)
      continue
    }
    if (item.tag === 'A') ab.A += 1
    else if (item.tag === 'B') ab.B += 1
  }
  let todayFailed = failedCompanies.length

  // --- 面试日程 -----------------------------------------------------------
  const allInterviews = interviewsRaw
    .filter((item) => item && typeof item === 'object' && String(item.company ?? '').trim())
    .map((item) => ({
      company: String(item.company ?? '').trim(),
      who: String(item.who ?? item.contact ?? '').trim(),
      job: String(item.job ?? '').trim(),
      when: String(item.when ?? item.time ?? '').trim(),
      mode: String(item.mode ?? item.form ?? '').trim(),
      state: String(item.state ?? '').trim(),
      next: String(item.next ?? '').trim(),
      date: String(item.date ?? '').trim(),
      dayDiff: interviewDayDiff(item.date, today),
      dateWarning: interviewDateWarning(item.when ?? item.time, item.date),
    }))
    .sort((a, b) => (a.dayDiff ?? 9999) - (b.dayDiff ?? 9999))

  // 面试口径（2026-10-28 数据审计 #1）：原来只留 dayDiff>=0，把 4/6 条日程直接吞掉——
  // 其中一条（待对方给时间）仍然活着，用户却看到「面试 0」，误以为这条线没进展。
  // 现在拆成四桶，KPI 只算「有明确日期且未取消」，其余在空态里如实交代。
  const isCancelled = (item) => /已取消|取消/.test(item.state || '')
  const interviews = allInterviews.filter(
    (item) => item.dayDiff !== null && item.dayDiff >= 0 && !isCancelled(item),
  )
  const pastInterviews = allInterviews.filter(
    (item) => item.dayDiff !== null && item.dayDiff < 0 && !isCancelled(item),
  )
  const tbdInterviews = allInterviews.filter((item) => item.dayDiff === null && !isCancelled(item))
  const cancelledInterviews = allInterviews.filter(isCancelled)
  const lastPast = pastInterviews.length ? pastInterviews[pastInterviews.length - 1] : null

  // --- 最近 14 天首触 -----------------------------------------------------
  // 首触的唯一口径 = contacted(送达) ∪ approvals(sent)，按「本地日 + 公司」去重。
  // 原来只读 contacted，审批链发的 11 条进不了趋势条 → KPI 说今天 11、趋势最新是昨天，
  // 同一件事三个数（2026-10-28 数据审计 #3）。这里统一，daily 与 recentDays 同源。
  const touchDays = new Map() // dateKey -> Set(company)
  const addTouch = (dateKey, company) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return // 剔掉 "undefined" 这类脏桶（#10）
    const key = dateKey
    if (!touchDays.has(key)) touchDays.set(key, new Set())
    touchDays.get(key).add(company || key)
  }
  for (const item of contacts) {
    if (SEND_FAILED.test(item.status)) continue
    addTouch(String(item.date ?? '').slice(0, 10), item.company)
  }
  for (const item of approvalsDoc.value?.items ?? []) {
    // 这条循环读的是原始文件，绕过了 normalizeApproval —— 一条 null 就能让整页白屏（工程评审 #1）。
    if (!item || typeof item !== 'object') continue
    if (item.status !== 'sent' || !item.sentAt) continue
    const when = new Date(item.sentAt)
    if (Number.isNaN(when.getTime())) continue
    addTouch(localDateKey(when), item.company)
  }
  const recentDays = [...touchDays.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 14)
    .map(([date, set]) => ({ date, count: set.size }))

  // --- 今日简报 -----------------------------------------------------------
  const decideRows = threads.filter((item) => item.state === '待你决定')
  const daily = {
    decide: decideRows.length,
    decideCompanies: decideRows.slice(0, 4).map((item) => item.company),
    // 已读不回桶 2026-10-27 删除。不用 0 表示「没做」——0 会被外部脚本当真实业务值（审计 #9）。
    readNoReply: null,
    todayThreads: threads.filter((item) => item.days === 0).length,
    todayOutreach: 0, // 下面按 approvals ∪ contacted 的本地日去重口径回填
    todayFailed,
    failedCompanies: failedCompanies.slice(0, 6),
    a: ab.A,
    b: ab.B,
  }

  const pending = normalizePending(pendingDoc.value)
  const approvals = buildApprovals(approvalsDoc.value, threads)

  // 审批链（boss_approval_runner）发送后只写 boss_approvals.json，不写 contacted.json，
  // 简报不能只看 contacted。todayOutreach 直接取上面统一口径的 union（本地日去重）。
  daily.todayOutreach = touchDays.get(todayKey)?.size ?? 0
  // sendResult 里从来没有 ok 字段，`ok === false` 恒假 → 「未送达」永远是假的 0（审计 #6）。
  // 以 status 判定：只有 sent/already 算发出成功。
  daily.todayFailed = Math.max(
    daily.todayFailed,
    approvals.items.filter((item) => {
      if (!item.sendResult || !item.sentAt) return false
      const when = new Date(item.sentAt)
      if (Number.isNaN(when.getTime()) || localDateKey(when) !== todayKey) return false
      const st = String(item.sendResult.status ?? '')
      return st !== 'sent' && st !== 'already'
    }).length,
  )
  const agentAudit = buildAgentAudit({
    threads,
    interviews: allInterviews,
    resumeVersions: resumeVersionsDoc.value,
    factGateInstalled,
    resumeGateInstalled,
  })

  const counts = {
    // 行数 ≠ 公司数：同一家可能多行（海马云 3 行）；也不能算上被跳过的空公司行，
    // 否则表头写 810、列表只有 807（工程评审「其他」）。
    threads: threads.length,
    threadRows: threads.length,
    skippedRows,
    companies: new Set(threads.map((item) => item.company)).size,
    pending: pending.length,
    byState,
    interviews: interviews.length,
    tbdInterviews: tbdInterviews.length,
    cancelledInterviews: cancelledInterviews.length,
    pastInterviews: pastInterviews.length,
    contacts: contacts.length,
    todayOutreach: daily.todayOutreach,
    ab,
  }

  // 文件读坏了（比如面板正好在写）要显式告诉界面，别把「读不出来」渲染成「没有待发」。
  let approvalsCorrupt = false
  try {
    const raw = await fs.readFile(files.approvals, 'utf8')
    JSON.parse(raw)
  } catch (error) {
    if (error?.code !== 'ENOENT') approvalsCorrupt = true
  }

  // 发送链跑没跑，是面板看不到的一面：runner 每小时至少写一行审计，
  // 长时间没动静而又有条目在等发，就说明后台停了（2026-10-29 SRE 审计）。
  // runner 每轮都 touch heartbeat（含 IDLE），审计文件只在有动作时写 —— 先看心跳。
  const stateDir = path.join(os.homedir(), '.hermes/state')
  let lastRunnerAt = null
  for (const name of ['boss_approval_heartbeat', 'boss_approval_audit.jsonl']) {
    try {
      const stat = await fs.stat(path.join(stateDir, name))
      lastRunnerAt = new Date(stat.mtimeMs).toISOString()
      break
    } catch {
      lastRunnerAt = null
    }
  }
  const runnerStaleMin = lastRunnerAt
    ? Math.round((Date.now() - Date.parse(lastRunnerAt)) / 60000)
    : null

  // 被闸门挡下的条目只写审计 + 推一次 IM，面板上看不见 —— 用户会以为「点了怎么没发」。
  // 取审计尾部最后一条 blocked，与最后一次 dispatch 比时间：之后又发成功了就不再提示。
  let lastBlockedAt = null
  let lastBlockedCount = 0
  let lastDispatchAt = null
  try {
    const auditFile = path.join(stateDir, 'boss_approval_audit.jsonl')
    const raw = await fs.readFile(auditFile, 'utf8')
    const lines = raw.trim().split('\n').slice(-200)
    for (const line of lines) {
      let row = null
      try {
        row = JSON.parse(line)
      } catch {
        continue
      }
      if (!row || !row.ts) continue
      if (row.event === 'blocked') {
        lastBlockedAt = row.ts
        if (Array.isArray(row.items)) lastBlockedCount = row.items.length
      } else if (row.event === 'dispatch' || row.event === 'settled') {
        lastDispatchAt = row.ts
      }
    }
  } catch {
    /* 没有审计文件就是没跑过，不算异常 */
  }

  return {
    version,
    updatedAt: toIso(merged.ts),
    dataQuality: {
      approvalsCorrupt,
      lastRunnerAt,
      runnerStaleMin,
      lastBlockedAt,
      lastBlockedCount,
      lastDispatchAt,
    },
    dataDir,
    today: todayKey,
    counts,
    daily,
    filters: ORDER.map((state) => ({ state, count: byState[state] ?? 0 })),
    threads,
    interviews,
    interviewStats: {
      upcoming: interviews.length,
      tbd: tbdInterviews.length,
      cancelled: cancelledInterviews.length,
      past: pastInterviews.length,
      total: allInterviews.length,
    },
    tbdInterviews,
    interviewEmptyTail: lastPast
      ? `最近一次「${lastPast.company}｜${lastPast.job}｜${lastPast.state}」已结束（${
          lastPast.next || '已收尾'
        }）`
      : '',
    recentDays,
    pending,
    approvals,
    agentAudit,
    contacts: contacts.slice(-80).reverse(),
  }
}

// ---------------------------------------------------------------------------
// 审批队列（boss_approvals.json）
//
// 2026-10-28 用户要求：「在面板上加上聊天记录、JD 详情、公司详情，给我审批按钮，
// 我切换状态，你检测到能发就发。」所以面板从只读变成**唯一的人工授权入口**：
// 用户在卡片上点「通过并发送」→ 状态写 approved → agent 侧 runner 看到 approved
// 才允许调 boss_outbox.sh 真发。draft 与 draftHash 一起存，改过文案就必须重新审批。
// ---------------------------------------------------------------------------
// 与 boss_approvals.py 的 HARDGATE 同源：投之前先把 JD 里的硬性条件摆出来，
// 别等发完才发现「必须有放置卡牌实战」这种一票否决（招聘方评审实测 11 条里 5 条撞这个）。
const HARDGATE = [
  /必须(?:有|具备|做过|是).{0,24}(卡牌|放置|SLG|MMO|已上线|上线项目|同品类)/,
  /硬性(?:要求|条件)/,
  /(?:至少|不少于).{0,8}年.{0,12}(卡牌|放置|同品类|上线项目)/,
]
const hardGateOf = (jd) => {
  const text = String(jd ?? '')
  for (const pattern of HARDGATE) {
    const hit = pattern.exec(text)
    if (hit) return hit[0].slice(0, 60)
  }
  return ''
}

const APPROVAL_STATUSES = ['pending', 'approved', 'skipped', 'sent', 'failed']
const APPROVAL_STATUS_ORDER = { approved: 0, pending: 1, failed: 2, sent: 3, skipped: 4 }

function normalizeApproval(item) {
  if (!item || typeof item !== 'object') return null
  const id = String(item.id ?? '').trim()
  const company = String(item.company ?? '').trim()
  if (!id || !company) return null
  const status = String(item.status ?? 'pending')
  return {
    id,
    date: String(item.date ?? '').trim(),
    company,
    recruiter: String(item.recruiter ?? item.name ?? '').trim(),
    recruiterTitle: String(item.recruiterTitle ?? '').trim(),
    jobTitle: String(item.jobTitle ?? item.job ?? '').trim(),
    salary: String(item.salary ?? '').trim(),
    city: String(item.city ?? '').trim(),
    jobId: String(item.jobId ?? '').trim(),
    tier: String(item.tier ?? '').trim(),
    track: String(item.track ?? '').trim(),
    evidence: String(item.evidence ?? '').trim(),
    gap: String(item.gap ?? '').trim(),
    draft: String(item.draft ?? '').trim(),
    jdText: String(item.jdText ?? '').trim(),
    hardGate: String(item.hardGate ?? hardGateOf(item.jdText)).trim(),
    draftHash: String(item.draftHash ?? '').trim(),
    status: APPROVAL_STATUSES.includes(status) ? status : 'pending',
    addedAt: toIso(item.addedAt),
    decidedAt: toIso(item.decidedAt),
    approvedAt: toIso(item.approvedAt),
    sentAt: toIso(item.sentAt),
    sendResult: item.sendResult && typeof item.sendResult === 'object' ? item.sendResult : null,
    note: String(item.note ?? '').trim(),
  }
}

function buildApprovals(doc, threadRows = []) {
  const items = Array.isArray(doc?.items) ? doc.items : []
  // 审批条目常常没记对接人（列表接口只给 bossName，首触时还没建会话）。
  // 会话表里已经有这条线程时，用它的对接人/最近一句补上，省得弹窗里「对接人 —」。
  const byCompany = new Map()
  for (const row of threadRows) {
    if (!row?.company) continue
    const prev = byCompany.get(row.company)
    if (!prev || String(row.time ?? '') > String(prev.time ?? '')) byCompany.set(row.company, row)
  }
  const out = []
  for (const raw of items) {
    const item = normalizeApproval(raw)
    if (!item) continue
    const row = byCompany.get(item.company)
    if (row) {
      // 会话行在这里已经过 normalizeThread（字段叫 who，不是 name）——之前写 row.name 永远拿不到。
      const who = row.who || row.name || ''
      if (!item.recruiter && who) item.recruiter = who
      if (!item.threadState && row.state) item.threadState = row.state
      if (!item.threadTime && row.time) item.threadTime = row.time
      if (!item.threadLast && row.last) item.threadLast = row.last
      // 对方是否已经回了：审批条目的线程末条来自对方，就是「球在对方 → 已经回我了」。
      // 面板要能直接回答「我今天发出去的，有人理吗」，不能只靠人工点开看（数据审计 #8）。
      item.threadFrom = row.lastFrom || ''
      // 送达 ≠ 已读。运营复盘里「0 已读」和「已读不回」是两个完全不同的结论
      // （前者是没触达，后者才轮到文案），所以这一位必须显式落进快照。
      const delivery = String(row.delivery || '')
      item.readState = delivery.includes('已读') ? 'read' : delivery.includes('送达') ? 'delivered' : ''
    }
    // 资料齐全度：面板不能再出现「有的有公司/JD/聊天，有的缺一块」而看不出为什么。
    // 每个字段只有两种状态 ——「采集到了」或「标记为未采集」，不留空白让人猜。
    item.coverage = {
      jd: Boolean(item.jdText),
      salary: Boolean(item.salary),
      city: Boolean(item.city),
      jobId: Boolean(item.jobId),
      recruiter: Boolean(item.recruiter),
      tier: Boolean(item.tier),
    }
    item.missing = Object.entries(item.coverage)
      .filter(([, filled]) => !filled)
      .map(([key]) => key)
    item.completeness = `${Object.values(item.coverage).filter(Boolean).length}/${Object.keys(item.coverage).length}`
    out.push(item)
  }
  out.sort((a, b) => {
    const rank = (APPROVAL_STATUS_ORDER[a.status] ?? 9) - (APPROVAL_STATUS_ORDER[b.status] ?? 9)
    if (rank) return rank
    return String(b.addedAt ?? '').localeCompare(String(a.addedAt ?? ''))
  })
  const stats = { total: out.length, pending: 0, approved: 0, sent: 0, skipped: 0, failed: 0 }
  for (const item of out) stats[item.status] = (stats[item.status] ?? 0) + 1
  const replied = out.filter((item) => item.status === 'sent' && item.threadFrom === '对方')
  return {
    items: out,
    stats,
    replied: replied.length,
    repliedCompanies: replied.map((item) => item.company),
  }
}

/**
 * 单家公司详情（点开会话行时按需拉取，避免快照里塞几千份详情）。
 *
 * @param {string} company
 * @param {{dataDir?: string}} options
 */
/**
 * 回写「待你拍板」队列的某一条状态（sent / dismissed / pending）。
 * 只改这一条的 status 与时间戳，其余字段原样保留，避免和 CLI 侧并发写打架。
 */
export async function markPending(id, status, options = {}) {
  const dataDir = options.dataDir || DEFAULT_DATA_DIR
  const file = fileSet(dataDir).pending
  const doc = await readJson(file, { items: [] })
  const items = Array.isArray(doc?.items) ? doc.items : []
  let hit = null
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const key = String(item.id ?? `${item.name ?? ''}|${item.company ?? ''}`)
    if (key !== String(id)) continue
    item.status = status
    item.decidedAt = new Date().toISOString()
    hit = item
  }
  if (!hit) throw operationError('not_found', `队列里没有这一条：${String(id)}`)
  await writeJsonAtomic(file, { ...doc, items, ts: new Date().toISOString() })
  return { ok: true, id: String(id), status }
}

/**
 * 审批卡片详情：JD 正文 + 公司信息 + 完整聊天记录，按需拉取。
 *
 * 快照里只放轻量字段（列表渲染用），JD 正文和全部聊天记录在点开卡片时才取，
 * 避免每次轮询把几百 KB 文本推给浏览器。
 */
export async function buildApprovalDetail(id, options = {}) {
  const dataDir = options.dataDir || DEFAULT_DATA_DIR
  const files = fileSet(dataDir)
  const doc = await readJson(files.approvals, { items: [] })
  const items = Array.isArray(doc?.items) ? doc.items : []
  const raw = items.find((item) => String(item?.id ?? '') === String(id))
  if (!raw) throw operationError('not_found', `审批队列里没有这一条：${String(id)}`)
  const item = normalizeApproval(raw)

  const [contactedDoc, metaDoc, historyDoc, threadsDoc] = await Promise.all([
    readCached(files.contacted, { entries: [] }),
    readCached(files.meta, {}),
    readCached(files.history, { threads: {} }),
    readCached(files.all, { rows: [] }),
  ])

  const meta = makeMetaLookup(metaDoc.value)(item.company) ?? {}
  const contactRows = Array.isArray(contactedDoc.value?.entries) ? contactedDoc.value.entries : []
  const contact =
    contactRows.map(normalizeContact).filter(Boolean).find((row) => row.company === item.company) ?? {}

  // 完整聊天记录：history 按「对接人|公司」存，优先匹配同名对接人，退化为同公司任意一条。
  const historyRaw = historyDoc.value?.threads
  let msgs = []
  if (historyRaw && typeof historyRaw === 'object') {
    const candidates = []
    for (const [key, value] of Object.entries(historyRaw)) {
      const parts = String(key).split('|')
      const company = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim()
      if (company !== item.company) continue
      const who = parts.length > 1 ? parts.slice(0, -1).join('|').trim() : ''
      const list = Array.isArray(value?.msgs) ? value.msgs : []
      candidates.push({ who, list })
    }
    const best =
      candidates.find((row) => row.who && item.recruiter && row.who === item.recruiter) ??
      candidates.sort((a, b) => b.list.length - a.list.length)[0]
    if (best) {
      msgs = best.list.map((entry) => ({
        mine: entry?.mine === true,
        text: String(entry?.t ?? ''),
      }))
    }
  }

  const probeRows = Array.isArray(threadsDoc.value?.rows) ? threadsDoc.value.rows : []
  const probeRow = probeRows.find((row) => String(row.company ?? '').trim() === item.company)

  return {
    ...item,
    jdText: String(raw.jdText ?? '').trim(),
    jdUrl: item.jobId ? `https://www.zhipin.com/job_detail/${item.jobId}.html` : '',
    companyDetail: {
      industry: String(meta.industry ?? ''),
      stage: String(meta.stage ?? ''),
      city: String(meta.city ?? '') || item.city,
      scale: String(meta.scale ?? ''),
      intro: String(meta.intro ?? ''),
      contactedBefore: contact.date || '',
      channel: contact.channel || '',
      tag: contact.tag || '',
      note: contact.note || '',
    },
    chatState: String(probeRow?.state ?? ''),
    chatLast: String(probeRow?.last ?? ''),
    msgs,
  }
}

/**
 * 面板上切换审批状态。只允许人工三个动作：通过 / 跳过 / 撤回。
 * sent / failed 由 agent 侧 runner 回写，面板不直接写，避免「点一下就算发成功」。
 */
let approvalWriteChain = Promise.resolve()

/**
 * 同一个审批文件的读-改-写必须串行：两次并发决策各自读到同一份旧 doc，
 * 后写的会把前一次抹掉，审计里却留着两条记录（工程评审 #6）。
 */
function withApprovalLock(task) {
  const run = approvalWriteChain.then(task, task)
  approvalWriteChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function markApproval(id, status, options = {}) {
  return withApprovalLock(() => markApprovalUnlocked(id, status, options))
}

async function markApprovalUnlocked(id, status, options = {}) {
  const dataDir = options.dataDir || DEFAULT_DATA_DIR
  const file = fileSet(dataDir).approvals
  const doc = await readJsonStrict(file, { items: [] })
  const items = Array.isArray(doc?.items) ? doc.items : []
  const allowed = ['pending', 'approved', 'skipped']
  if (!allowed.includes(status)) {
    throw operationError('invalid_status', `面板只能切到 ${allowed.join(' / ')}，收到：${status}`)
  }
  // 单向状态机：只能从这些前置状态进入，防止任何持有 token 的脚本把 sent 改回 approved 重复发。
  const FROM = {
    approved: ['pending', 'failed'],
    skipped: ['pending', 'approved'],
    pending: ['approved', 'skipped'],
  }
  const hit = items.find((item) => item && typeof item === 'object' && String(item.id ?? '') === String(id))
  if (!hit) throw operationError('not_found', `审批队列里没有这一条：${String(id)}`)
  const from = String(hit.status ?? 'pending')
  if (!(FROM[status] ?? []).includes(from)) {
    throw operationError('invalid_transition', `不能从 ${from} 切到 ${status}`)
  }
  // 授权完整性：用户点的是他屏幕上那一版文案，不是「这条 id 的最新版」。
  if (status === 'approved' && options.draftHash && String(options.draftHash) !== String(hit.draftHash ?? '')) {
    throw operationError('stale_draft', '这条草稿在你查看后改过，请重新打开确认再发')
  }
  const at = new Date().toISOString()
  hit.status = status
  hit.decidedAt = at
  if (status === 'approved') {
    hit.approvedAt = at
    hit.approvedDraftHash = String(hit.draftHash ?? '')
  } else {
    delete hit.approvedAt
    delete hit.approvedDraftHash
  }
  await backupApprovalsDaily(file)
  await writeJsonAtomic(file, { ...doc, items, ts: at })
  await appendApprovalAudit(
    {
      at,
      id: String(id),
      company: String(hit.company ?? ''),
      from,
      status,
      draftHash: String(hit.draftHash ?? ''),
      source: 'panel',
    },
    options,
  )
  return {
    ok: true,
    id: String(id),
    status,
    company: String(hit.company ?? ''),
    draftHash: String(hit.draftHash ?? ''),
  }
}

export async function buildDetail(company, options = {}) {
  const dataDir = options.dataDir || DEFAULT_DATA_DIR
  await loadOverrides(dataDir)
  const files = fileSet(dataDir)
  const target = String(company ?? '').trim()
  if (!target) throw operationError('invalid_company', '公司名不能为空')

  const [contactedDoc, metaDoc, historyDoc, threadsDoc] = await Promise.all([
    readCached(files.contacted, { entries: [] }),
    readCached(files.meta, {}),
    readCached(files.history, { threads: {} }),
    readCached(files.threads, { rows: [] }),
  ])

  const contactRows = Array.isArray(contactedDoc.value?.entries) ? contactedDoc.value.entries : []
  const contacts = contactRows.map(normalizeContact).filter(Boolean)
  const contactIndex = buildContactIndex(contacts)
  const contact = contactIndex.firstByCompany.get(target) ?? {}
  const meta = makeMetaLookup(metaDoc.value)(target) ?? {}

  const historyRaw = historyDoc.value?.threads
  let msgs = []
  if (historyRaw && typeof historyRaw === 'object') {
    for (const [key, value] of Object.entries(historyRaw)) {
      const name = key.includes('|') ? key.split('|').pop().trim() : key.trim()
      if (name !== target) continue
      const list = Array.isArray(value?.msgs) ? value.msgs : []
      msgs = list.map((item) => ({
        mine: item?.mine === true,
        text: String(item?.t ?? ''),
      }))
      if (msgs.length) break
    }
  }

  const probeRows = Array.isArray(threadsDoc.value?.rows) ? threadsDoc.value.rows : []
  const probeRow = probeRows.find((row) => String(row.company ?? '').trim() === target)

  return {
    company: target,
    job: contact.job || '',
    salary: contact.salary || '',
    city: contact.city || String(meta.city ?? ''),
    industry: String(meta.industry ?? ''),
    scale: String(meta.scale ?? ''),
    stage: String(meta.stage ?? ''),
    recruiter: String(probeRow?.name ?? contact.recruiter ?? ''),
    first: contact.date || '',
    channel: contact.channel || '',
    tag: contact.tag || '',
    note: contact.note || '',
    advice: Object.prototype.hasOwnProperty.call(OVR, target) ? OVR[target][1] : '',
    last: String(probeRow?.last ?? ''),
    lastFrom: String(probeRow?.lastFrom ?? ''),
    msgs: msgs.slice(-12),
  }
}

// ---------------------------------------------------------------------------
// 插件入口
// ---------------------------------------------------------------------------

export function apply(ctx, config = {}) {
  if (config.enabled === false) return

  const dataDir = config.dataDir || DEFAULT_DATA_DIR

  const log = (message, fields) => {
    ctx.logger?.info?.(`[boss-panel] ${message}`, fields ?? '')
  }

  const jsonResponse = (payload, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })

  const handleRpcRequest = async (request) => {
    let payload
    try {
      payload = await request.json()
    } catch {
      return jsonResponse(
        { ok: false, error: { code: 'invalid_body', message: '请求体必须是 JSON' } },
        400,
      )
    }
    if (!payload || typeof payload !== 'object') {
      return jsonResponse(
        { ok: false, error: { code: 'invalid_body', message: '请求体必须是 JSON 对象' } },
        400,
      )
    }
    try {
      const op = payload.op ?? 'status'
      if (op === 'status') {
        const snapshot = await buildSnapshot({ dataDir })
        // 版本没变就不重发几 MB 的列表；客户端沿用上一份数据。
        if (payload.since && payload.since === snapshot.version) {
          return jsonResponse({ ok: true, value: { unchanged: true, version: snapshot.version } })
        }
        return jsonResponse({ ok: true, value: snapshot })
      }
      if (op === 'detail') {
        return jsonResponse({ ok: true, value: await buildDetail(payload.company, { dataDir }) })
      }
      if (op === 'pending_mark') {
        const status = String(payload.status ?? '')
        if (!['pending', 'sent', 'dismissed'].includes(status)) {
          throw operationError('invalid_status', `不支持的队列状态：${status}`)
        }
        return jsonResponse({
          ok: true,
          value: await markPending(payload.id, status, { dataDir }),
        })
      }
      if (op === 'approval_detail') {
        return jsonResponse({ ok: true, value: await buildApprovalDetail(payload.id, { dataDir }) })
      }
      if (op === 'approval_decide') {
        const status = String(payload.status ?? '')
        return jsonResponse({
          ok: true,
          value: await markApproval(payload.id, status, { dataDir, draftHash: payload.draftHash }),
        })
      }
      if (op === 'ping') {
        return jsonResponse({ ok: true, value: { dataDir } })
      }
      throw operationError('unknown_op', `未知操作：${String(op)}`)
    } catch (error) {
      log('rpc 失败', { error: messageOf(error) })
      return jsonResponse(
        { ok: false, error: { code: error?.code ?? 'internal_error', message: messageOf(error) } },
        200,
      )
    }
  }

  const installWebRoute = (webCtx) => {
    const fetchRegistry =
      (typeof webCtx.get === 'function' ? webCtx.get('connection') : undefined)?.fetch ??
      webCtx.connection?.fetch
    if (!fetchRegistry || typeof fetchRegistry.register !== 'function') return
    webCtx.effect(() => {
      const dispose = fetchRegistry.register({
        path: RPC_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: handleRpcRequest,
      })
      return () => {
        try {
          void Promise.resolve(dispose()).catch(() => {})
        } catch {
          /* 已经释放 */
        }
      }
    }, 'boss-panel: /api/boss-panel.rpc')
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['connection'], installWebRoute)
  }

  log('已就绪', { dataDir })
}

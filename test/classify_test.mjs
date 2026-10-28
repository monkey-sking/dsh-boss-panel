// classify_test.mjs — 分类引擎回归测试（插件是唯一权威实现）。
//
// 缘起（2026-10-27）：离线看板 boss-chat-status.html / boss_dashboard_render.py 已停用，
// 规则只剩插件一处。此前靠「py vs 插件」parity 对账来抓偏移，停用后必须换成
// 直接喂数据的 goldens 断言，否则规则改动没有护栏。
//
// 跑法：node test/classify_test.mjs
//
// ⚠️ 本文件的公司与姓名一律虚构。早期版本把真实求职对话原样搬进来（公司名、
//    对接人姓名、消息正文），那是个人数据，不该出现在公开仓库里。
//    规则引擎判的是文本特征而不是具体主体，所以换名字不影响测试价值——
//    每条用例都只保留「触发该规则的语言结构」。
//
// 用例（每条都对应一次真实事故的语言结构）：
//   CLOSER        客套 + 语气助词的短收尾              → 已结束
//   ACKPASS       我方已把球传出去的告知句              → 等对方
//   SYSTEM_INVITE 系统生成的面试邀请卡片                → 待你决定
//   （jev 为空时托管句落到 owed 兜底）                  → 待回复
//   门槛拒绝       学历/经验硬门槛                      → 已结束
//   ACKFILTER     纯致谢                               → 已结束
//   PLACEHOLDER   系统占位符「您正在与Boss…沟通」        → 待回复（逼 live 复核）
import { buildSnapshot } from '../index.js'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const dir = await mkdtemp(path.join(tmpdir(), 'boss-classify-'))

/** 造一条「我方已首触、对方刚发来最后一条」的探针行。 */
const row = (company, name, last, extra = {}) => ({
  company,
  name,
  last,
  lastFrom: '对方',
  owed: true,
  time: '今天',
  ...extra,
})

// —— 虚构主体。刻意用明显不存在的名字，一眼能看出是测试数据。——
const A = { company: '示例甲方科技', who: '示例甲' }
const B = { company: '示例乙方网络', who: '示例乙' }
const C = { company: '示例丙方数据', who: '示例丙' }
const D = { company: '示例丁方智能', who: '示例丁' }
const E = { company: '示例戊方信息', who: '示例戊' }
const F = { company: '示例己方传媒', who: '示例己' }
const G = { company: '示例庚方软件', who: '示例庚' }

const rows = [
  // CLOSER：客套短收尾，不是在提问
  row(A.company, A.who, '好的呀，感谢关注呢'),
  // ACKPASS：我方已把球传出（简历已转部门），对方末条是告知而非提问
  row(B.company, B.who, '好的， 我要先把你的简历分享给用人部门，如果那边有反馈我会尽快联系你的'),
  // SYSTEM_INVITE：系统生成的面试邀请卡片
  row(C.company, C.who, '面试邀请：邀请您参加现场面试，前往查看，确认是否接受'),
  // 托管审核句：jev 为空时落到 owed 兜底（真实环境靠 jev「等对方」收口）
  row(D.company, D.who, '好的，简历用人部门面试官需要二审，他们很忙审核会比较慢，通过会给你留言的。请耐心等待'),
  // 门槛拒绝
  row(E.company, E.who, '岗位要求本科及以上学历，暂不匹配'),
  // ACKFILTER：纯致谢
  row(F.company, F.who, '打扰啦'),
  // PLACEHOLDER_OWED：系统占位符 + owed，必须逼 live 复核
  row(G.company, G.who, '您正在与Boss示例庚沟通'),
  // READ_TIMEOUT（用户：「已读不回 过48小时，就不用管了。就两个状态等回复，超时不管。」）
  //   我方末条 + 对方已读，按时间分界。
  row('超时-今天', '甲', '您好，方便的话加个微信细聊', { lastFrom: '我', delivery: '已读', owed: false, time: '10:30' }),
  row('超时-昨天', '乙', '您好，方便的话加个微信细聊', { lastFrom: '我', delivery: '已读', owed: false, time: '昨天 18:10' }),
  row('超时-前天', '丙', '您好，方便的话加个微信细聊', { lastFrom: '我', delivery: '已读', owed: false, time: '前天 09:00' }),
  row('超时-十天前', '丁', '您好，方便的话加个微信细聊', { lastFrom: '我', delivery: '已读', owed: false, time: '10-17 15:00' }),
  // CANCEL 2026-10-28：面试取消是结果通知，不是待办（凡宝 16:12 曾被 owed 兜底成待回复）。
  row('取消通知-面试', '子', '取消了面试'),
  row('取消通知-职位删除', '丑', '面试取消 取消原因:该面试职位已删除'),
  // 月日格式时间：BOSS 旧行写「10月23日」，必须能算出天数（否则时间规则全失效）。
  row('月日格式-久未跟进', '寅', '您好，方便的话加个微信细聊', { lastFrom: '我', delivery: '已读', owed: false, time: '10月20日' }),
  // 反向用例：真提问必须留在待回复/待你决定，别被收尾规则误杀。
  row('某某真提问的', '示例辛', '你们现在几个人的团队？方便发份简历吗'),
]

// 故意让 jev 快照与真实对话相反：真实判据必须赢过批处理旧快照（JEVDEFER 事故）。
const jev = { [A.company]: '待回复', [B.company]: '待回复', [G.company]: '待回复' }
const threads = { [A.company]: { msgs: [] } }

const file = (name, value) => writeFile(path.join(dir, name), JSON.stringify(value), 'utf-8')
await Promise.all([
  file('boss_threads.json', { rows }),
  file('boss_threads_all.json', { rows }),
  file('boss_jev_state.json', jev),
  file('boss_thread_history.json', { threads }),
  file('contacted.json', { entries: [] }),
  file('interview_schedule.json', { items: [] }),
  file('appointments.json', { items: [] }),
  file('company_meta.json', {}),
  file('outsourcing_blacklist.json', {}),
  file('boss_pending_decisions.json', { items: [] }),
])

const snap = await buildSnapshot({ dataDir: dir })
const stateOf = new Map(snap.threads.map((t) => [`${t.company}|${t.who}`, t.state]))

const expect = [
  [`${A.company}|${A.who}`, '已结束'],
  [`${B.company}|${B.who}`, '等对方'],
  [`${C.company}|${C.who}`, '待你决定'],
  // 真实环境靠 jev「等对方」兜住；本用例该行 jev 为空，兜底落到 owed → 待回复。
  [`${D.company}|${D.who}`, '待回复'],
  [`${E.company}|${E.who}`, '已结束'],
  [`${F.company}|${F.who}`, '已结束'],
  [`${G.company}|${G.who}`, '待回复'],
  // READ_TIMEOUT 按时间分界
  ['超时-今天|甲', '等对方'],
  ['超时-昨天|乙', '等对方'],
  ['超时-前天|丙', '已结束'],
  ['超时-十天前|丁', '已结束'],
  ['取消通知-面试|子', '已结束'],
  ['取消通知-职位删除|丑', '已结束'],
  ['月日格式-久未跟进|寅', '已结束'],
]
// 真提问那行不锁死具体状态（会随 fresh/jev 细节浮动），只断言「不能判成已结束」。
const MUST_NOT_CLOSE = '某某真提问的|示例辛'

let fail = 0
for (const [key, want] of expect) {
  const got = stateOf.get(key) ?? '(缺行)'
  const ok = got === want
  if (!ok) fail++
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${key}: ${got}${ok ? '' : `  (期望 ${want})`}`)
}
{
  const got = stateOf.get(MUST_NOT_CLOSE) ?? '(缺行)'
  const ok = got !== '已结束'
  if (!ok) fail++
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${MUST_NOT_CLOSE}: ${got}  (不能是已结束)`)
}

await rm(dir, { recursive: true, force: true })
console.log(fail === 0 ? 'PASS classify' : `FAIL classify (${fail} 条)`)
process.exit(fail === 0 ? 0 : 1)

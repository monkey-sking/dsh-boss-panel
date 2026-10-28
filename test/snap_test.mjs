// snap_test.mjs — 冒烟测试：buildSnapshot 对空数据目录和真实数据目录都不崩。
// 空目录这条是 CI 可用性的关键：没有本机求职数据时也必须能跑通。
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { buildSnapshot } from '../index.js'

const empty = await mkdtemp(path.join(tmpdir(), 'boss-snap-'))
try {
  const s = await buildSnapshot({ dataDir: empty })
  assert.equal(typeof s, 'object', 'buildSnapshot should return an object')
  assert.ok(Array.isArray(s.threads ?? []), 'threads should be an array')
  console.log('SNAP OK (empty dir): threads =', (s.threads ?? []).length)
} finally {
  await rm(empty, { recursive: true, force: true })
}

// 回归：审批文件里混进 null 条目不能让整个快照抛错（工程评审 #1 实测过白屏）。
const dirty = await mkdtemp(path.join(tmpdir(), 'boss-snap-dirty-'))
try {
  await writeFile(
    path.join(dirty, 'boss_approvals.json'),
    JSON.stringify({ items: [null, { id: 'ok', company: '示例公司', status: 'pending' }] }),
  )
  const s = await buildSnapshot({ dataDir: dirty })
  assert.equal(s.approvals.items.length, 1, 'null 条目应被跳过，好的条目仍要留下')
  console.log('SNAP OK (null item tolerated)')
} finally {
  await rm(dirty, { recursive: true, force: true })
}

// 回归：审批文件损坏时不能假装「没有待发」——要带 dataQuality.approvalsCorrupt 让界面说实话。
const broken = await mkdtemp(path.join(tmpdir(), 'boss-snap-broken-'))
try {
  await writeFile(path.join(broken, 'boss_approvals.json'), '{bad json')
  const s = await buildSnapshot({ dataDir: broken })
  assert.equal(s.dataQuality.approvalsCorrupt, true, 'corrupt approvals file must be flagged')
  console.log('SNAP OK (corrupt approvals flagged)')
} finally {
  await rm(broken, { recursive: true, force: true })
}

// 回归：「N 天前投过」必须按本地日算。contacted.json 的 date 是本地日期，
// 早年用 toISOString().slice(0,10) 当今天，东八区 00:00–08:00 会整体差一天（2026-10-29 实测）。
const contactAge = await mkdtemp(path.join(tmpdir(), 'boss-snap-contact-'))
try {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = key(now)
  const weekAgo = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7))
  await writeFile(path.join(contactAge, 'boss_approvals.json'), JSON.stringify({
    items: [
      { id: 'c1', company: '示例甲', jobTitle: '战斗策划', draft: 'x', draftHash: 'h', status: 'pending' },
      { id: 'c2', company: '示例乙', jobTitle: '战斗策划', draft: 'x', draftHash: 'h', status: 'pending' },
      { id: 'c3', company: '示例丙', jobTitle: '战斗策划', draft: 'x', draftHash: 'h', status: 'pending' },
    ],
  }), 'utf-8')
  await writeFile(path.join(contactAge, 'contacted.json'), JSON.stringify({
    entries: [
      { company: '示例甲', date: today },
      { company: '示例乙', date: weekAgo },
    ],
  }), 'utf-8')
  const s = await buildSnapshot({ dataDir: contactAge })
  const by = Object.fromEntries(s.approvals.items.map((i) => [i.company, i.contactedDays]))
  assert.equal(by['示例甲'], 0, '今天投过应为 0 天（UTC 日期会错成 1 天）')
  assert.equal(by['示例乙'], 7, '7 天前投过应为 7 天')
  assert.equal(by['示例丙'], null, '没投过的公司应为 null，不是 0')
  console.log('SNAP OK (contact age uses local date)')
} finally {
  await rm(contactAge, { recursive: true, force: true })
}

// 审批链发送只写 boss_approvals.json，且 sentAt 是 UTC ISO —— 简报的「今天已发」
// 必须按本地日算，不能拿 UTC 日期切片（00:00–08:00 发出的会算到前一天）。
const clock = await mkdtemp(path.join(tmpdir(), 'boss-snap-clock-'))
try {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  // 本地时间今天 00:30 → UTC 可能是昨天，正好踩到跨日错位。
  const todayEarly = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 30, 0).toISOString()
  const yesterdayLate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 30, 0).toISOString()
  await writeFile(path.join(clock, 'boss_approvals.json'), JSON.stringify({
    items: [
      { id: 'a', company: '示例甲', jobTitle: '战斗策划', draft: 'x', draftHash: 'h', status: 'sent', sentAt: todayEarly },
      { id: 'b', company: '示例乙', jobTitle: '战斗策划', draft: 'x', draftHash: 'h', status: 'sent', sentAt: yesterdayLate },
    ],
  }), 'utf-8')
  const snap = await buildSnapshot({ dataDir: clock })
  assert.equal(snap.daily.todayOutreach, 1, `跨日统计错位：期望 1，实际 ${snap.daily.todayOutreach}（todayKey=${todayKey}）`)
  console.log('SNAP OK (local-day merge): today =', snap.daily.todayOutreach)
} finally {
  await rm(clock, { recursive: true, force: true })
}

// 面试口径（2026-10-28 数据审计 #1）：dayDiff 为 null 的条目（日期未定 / 已取消）不能静默消失。
// 空公司名的会话行也不该计入「沟通对象」（审计 #7）。
const buckets = await mkdtemp(path.join(tmpdir(), 'boss-snap-iv-'))
try {
  const iso = (d) => d.toISOString().slice(0, 10)
  const day = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return iso(d)
  }
  await writeFile(path.join(buckets, 'interview_schedule.json'), JSON.stringify({
    items: [
      { company: '示例未定', state: '待对方给时间', date: '' },
      { company: '示例已取消', state: '已取消', date: '' },
      { company: '示例已取消2', state: '面试取消', date: day(3) },
      { company: '示例未来', state: '已约好', date: day(2), when: '14:00' },
      { company: '示例已过', state: '已面试', date: day(-5), when: '10:00' },
    ],
  }), 'utf-8')
  await writeFile(path.join(buckets, 'boss_threads_all.json'), JSON.stringify({
    rows: [
      { company: '', who: '示例甲', last: '你好', lastFrom: '对方', time: '今天' },
      { company: '示例乙', who: '示例乙', last: '你好', lastFrom: '对方', time: '今天' },
    ],
  }), 'utf-8')
  const snap = await buildSnapshot({ dataDir: buckets })
  assert.equal(snap.interviews.length, 1, `未来面试应为 1，实际 ${snap.interviews.length}`)
  assert.equal(snap.interviewStats.cancelled, 2, `已取消应为 2，实际 ${snap.interviewStats.cancelled}`)
  assert.equal(snap.interviewStats.tbd, 1, `待定应为 1，实际 ${snap.interviewStats.tbd}`)
  assert.equal(snap.interviews.length + snap.interviewStats.tbd + snap.interviewStats.cancelled + snap.interviewStats.past, snap.interviewStats.total,
    '四个桶必须覆盖全部日程，不能有条目静默消失')
  assert.equal(snap.threads.length, 1, '空公司名的会话行不应进入列表')
  console.log('SNAP OK (interview buckets):', JSON.stringify(snap.interviewStats))
} finally {
  await rm(buckets, { recursive: true, force: true })
}

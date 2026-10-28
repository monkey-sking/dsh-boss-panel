// 审批队列 + 审批弹窗渲染测试（2026-10-28 返工版）。
// 用户口径：不要单独 Tab、不要把详情摊成展开卡片 —— 一行一条候选，点开用既有弹窗。
// 断言：
//   1) TabBar 只剩三个 Tab（审批不再是 Tab）
//   2) 概览里出现待审批队列，行数 = 未终结条目数
//   3) 行里带公司 / 岗位 / 薪资 / 草稿
//   4) 点行 → 弹窗打开，底部出现「通过并发送 / 跳过」
//   5) 点通过 → 真的 POST approval_decide(status=approved)
//   6) 已通过的条目在行上显示「已通过 · 待发送」，弹窗里只剩「撤回」
import fs from 'node:fs'

let factory = null
globalThis.window = {
  __ModuleLoader__: { load: ({ factory: f }) => { factory = f } },
}

let stateBag = {}
let seq = 0
const React = {
  Fragment: Symbol('Fragment'),
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState(init) {
    const i = seq++
    if (!(i in stateBag)) stateBag[i] = typeof init === 'function' ? init() : init
    return [stateBag[i], (v) => { stateBag[i] = typeof v === 'function' ? v(stateBag[i]) : v }]
  },
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: (v) => ({ current: v }),
  useSyncExternalStore: (_s, get) => get(),
}
const requireStub = (name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
}

// 捕获面板发出的 RPC，供断言。
const calls = []
globalThis.fetch = async (url, init) => {
  const payload = JSON.parse(init?.body || '{}')
  calls.push(payload)
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, value: { ok: true, id: payload.id, status: payload.status } }),
  }
}

const src = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
new Function('window', 'require', src)(globalThis.window, requireStub)
if (!factory) { console.log('FAIL: factory not captured'); process.exit(1) }
const plugin = factory(requireStub)

const registrations = []
plugin.apply({
  locale: {
    bind: () => (key, vars) => (vars ? `${key}(${JSON.stringify(vars)})` : key),
    register: () => ({ disposed: false }),
    getSnapshot: () => ({ locale: 'zh' }),
  },
  effect: () => ({}),
  slots: { inject: (name, cb) => cb(), register: (meta, Comp) => { registrations.push({ meta, Comp }) } },
})
const panel = registrations.find((r) => r.meta.name === 'main')

const { buildSnapshot, buildApprovalDetail } = await import('../index.js')
const liveSnap = await buildSnapshot()
const snap = {
  ...liveSnap,
  approvals: {
    stats: { total: 4, pending: 2, approved: 1, sent: 1, skipped: 0, failed: 0 },
    items: [
      {
        id: 'demo-001', company: '示例科技', jobTitle: '战斗策划', salary: '20-30K', city: '上海',
        recruiter: '联系人A', recruiterTitle: 'HR', tier: 'A', status: 'pending',
        evidence: 'JD 写明行为树与怪物 AI', gap: '需补 MMO 经验',
        draft: '您好，看到 JD 里写行为树和怪物 AI，我在 3A 项目里主做战斗 AI…', draftHash: 'h1',
      },
      {
        id: 'demo-002', company: '样本互娱', jobTitle: '技术策划', salary: '18-25K', city: '杭州',
        recruiter: '联系人B', recruiterTitle: '制作人', tier: 'B', status: 'pending',
        evidence: '工具链与蓝图调试', gap: '岗位偏工具', draft: '您好，我在项目里做过蓝图调试工具…', draftHash: 'h2',
      },
      {
        id: 'demo-003', company: '样例网络', jobTitle: '战斗数值', salary: '15-20K', city: '长沙',
        recruiter: '联系人C', recruiterTitle: 'HR', tier: 'B', status: 'approved',
        evidence: '自走棋数值', gap: '无 AI 主责', draft: '您好，做过战斗数值与平衡…', draftHash: 'h3',
      },
      {
        id: 'demo-004', company: '示例网络', jobTitle: '战斗策划', salary: '16-22K', city: '成都',
        recruiter: '联系人D', recruiterTitle: 'HR', tier: 'A', status: 'sent',
        sentAt: '2026-10-28T12:00:00Z', draft: '您好，做过敌人 AI…', draftHash: 'h4',
        sendResult: { status: 'sent', ok: true, tail: '已送达' },
      },
    ],
  },
}

let store = { getSnapshot: () => ({ loading: false, data: snap, error: null }), subscribe: () => () => {}, refresh: async () => {} }
const face = () => ({ useSnapshot: (f) => f(store.getSnapshot()), t: (k, v) => (v ? `${k}(${JSON.stringify(v)})` : k), lang: 'zh', refresh: () => {} })

// 同一次渲染内 stateBag 不重置，才能模拟「点一下 → 重渲染」。
const renderFresh = () => { stateBag = {}; seq = 0; return panel.Comp(face()) }
const rerender = () => { seq = 0; return panel.Comp(face()) }

function walk(node, out) {
  if (node == null || typeof node === 'boolean') return
  if (Array.isArray(node)) { node.forEach((n) => walk(n, out)); return }
  if (typeof node === 'string' || typeof node === 'number') { out.texts.push(String(node)); return }
  if (node && typeof node === 'object' && typeof node.type === 'function') {
    const kids = node.children.length <= 1 ? node.children[0] : node.children
    return walk(node.type({ ...node.props, children: kids }), out)
  }
  if (node && typeof node === 'object' && node.props) {
    const cls = node.props.className
    if (typeof cls === 'string') for (const c of cls.split(' ')) out.classes.add(c)
    const kids = node.children
    if (kids != null) { const arr = Array.isArray(kids) ? kids : [kids]; arr.forEach((k) => walk(k, out)) }
  }
}

function findAll(node, pred, acc = []) {
  if (node == null || typeof node !== 'object') return acc
  if (Array.isArray(node)) { node.forEach((n) => findAll(n, pred, acc)); return acc }
  if (typeof node.type === 'function') {
    const kids = node.children.length <= 1 ? node.children[0] : node.children
    findAll(node.type({ ...node.props, children: kids }), pred, acc)
  }
  if (node.props) {
    if (pred(node)) acc.push(node)
    const kids = node.children
    if (kids != null) { const arr = Array.isArray(kids) ? kids : [kids]; arr.forEach((k) => findAll(k, pred, acc)) }
  }
  return acc
}

let ok = true
const check = (name, pass) => { console.log((pass ? '✓ ' : '✗ ') + name); if (!pass) ok = false }
const textOf = (n) => (typeof n.children?.[0] === 'string' ? n.children[0] : n.children?.map?.((c) => c?.children?.[0]).join(''))
const collect = (tree) => { const o = { texts: [], classes: new Set() }; walk(tree, o); return o }

const items = snap.approvals.items
const live = items.filter((i) => i.status === 'pending' || i.status === 'approved' || i.status === 'failed')
const rowFinder = (n) => typeof n.props?.className === 'string' && n.props.className.includes('boss-aq-item') && n.props['data-clickable'] === 'true'

// —— 1) 三个 Tab，审批不再占位 ——
const tree = renderFresh()
const tabsNode = findAll(tree, (n) => Array.isArray(n.props?.tabs))[0]
const tabLabels = (tabsNode?.props?.tabs ?? []).map((x) => x.label)
check('Tab 只有两个（今天/全部会话）', tabLabels.length === 2 && !tabLabels.some((l) => l.includes('tabApproval')))
check('默认落在今天', tabLabels[0] === 'tabToday')

// —— 2/3) 概览里有待审批队列 ——
const out = collect(tree)
check('概览渲染待审批区块', out.texts.join(' | ').includes('approvalTitle'))
const rows = findAll(tree, rowFinder)
check(`队列行数 = ${live.length}`, rows.length === live.length && rows.length > 0)
const firstCompany = live[0]?.company ?? ''
const lastCompany = live[live.length - 1]?.company ?? ''
const joined = out.texts.join(' | ')
check('行里带公司名', !!firstCompany && joined.includes(firstCompany) && joined.includes(lastCompany))
check('行里带岗位/薪资', joined.includes(live[0]?.jobTitle ?? '@@') && joined.includes(live[0]?.salary ?? '@@'))
check('概览保留「等我回」区块', out.texts.join(' | ').includes('waitTitle'))
check('概览有「发出去了」折叠行', out.texts.join(' | ').includes('sentTitle'))
check('统计卡不再有「待审批」卡', !out.texts.includes('statApproval'))
const inlineApprove = findAll(tree, (n) => n.props?.onClick && textOf(n) === 'approvalActApprove')
check('队列行自带「通过」按钮', inlineApprove.length === 2)

// —— 4) 点行开弹窗 ——
calls.length = 0
rows[0].props.onClick()
const tree2 = rerender()
const out2 = collect(tree2)
const modalActs = findAll(tree2, (n) => typeof n.props?.className === 'string' && n.props.className.includes('boss-ap-acts'))
check('点行后弹窗底部动作区出现', modalActs.length === 1)
const approveBtn = findAll(tree2, (n) => n.props?.onClick && textOf(n) === 'approvalApprove')
const skipBtn = findAll(tree2, (n) => n.props?.onClick && textOf(n) === 'approvalSkip')
check('弹窗里有「通过并发送 / 跳过」', approveBtn.length === 1 && skipBtn.length === 1)
check('弹窗标题带公司名', out2.texts.some((x) => typeof x === 'string' && x.includes(firstCompany)))

// —— 5) 点通过 → POST ——
approveBtn[0].props.onClick()
await new Promise((r) => setTimeout(r, 20))
const decide = calls.find((c) => c.op === 'approval_decide')
check('点击后 POST approval_decide', !!decide && decide.status === 'approved')
check('带上条目 id', decide?.id === 'demo-001')

// —— 6) 已通过的条目：行上有状态、弹窗里只剩「撤回」 ——
{
  const approvedSnap = JSON.parse(JSON.stringify(snap))
  approvedSnap.approvals.items[0].status = 'approved'
  approvedSnap.approvals.stats.pending = snap.approvals.stats.pending - 1
  approvedSnap.approvals.stats.approved = snap.approvals.stats.approved + 1
  store = { getSnapshot: () => ({ loading: false, data: approvedSnap, error: null }), subscribe: () => () => {}, refresh: async () => {} }
  const t2 = renderFresh()
  const o2 = collect(t2)
  check('已通过的行显示状态', o2.texts.join(' | ').includes('approvalStatusApproved'))
  const rows2 = findAll(t2, rowFinder)
  rows2[0].props.onClick()
  const t3 = rerender()
  const revoke = findAll(t3, (n) => n.props?.onClick && textOf(n) === 'approvalRevoke')
  const approveNow = findAll(t3, (n) => n.props?.onClick && textOf(n) === 'approvalApprove')
  check('已通过的弹窗只剩「撤回」', revoke.length >= 1 && approveNow.length === 0)
}

// —— 6b) 最近发送的行也能点开 —— 列表里每个可点的行都该有弹窗，不做区别对待 ——
{
  const sentSnap = JSON.parse(JSON.stringify(snap))
  const target = sentSnap.approvals.items[1]
  target.status = 'sent'
  target.sentAt = '2026-10-28T11:40:04Z'
  target.sendResult = 'sent · 11:40 已送达'
  store = { getSnapshot: () => ({ loading: false, data: sentSnap, error: null }), subscribe: () => () => {}, refresh: async () => {} }
  const t4 = renderFresh()
  const sentLine = findAll(t4, (n) => typeof n.props?.className === 'string' && n.props.className.includes('boss-sent-line'))[0]
  check('默认折叠「发出去了」', !!sentLine)
  sentLine.props.onClick()
  const t5 = rerender()
  const logRows = findAll(t5, (n) => typeof n.props?.className === 'string' && n.props.className.includes('boss-aq-log'))
  check('展开后出现最近发送列表', logRows.length === 1)
  const clickable = findAll(t5, (n) => typeof n.props?.className === 'string' && n.props.className.includes('boss-aq-item') && n.props['data-clickable'] === 'true')
  check('最近发送的行也能点开', clickable.length >= 1)
  clickable[0].props.onClick()
  const t6 = rerender()
  const body = collect(t6).texts.join(' | ')
  check('已发行点开后有弹窗内容', body.includes('approvalStatusSent') || body.includes('approvalJd'))
}

// —— 7) 宿主侧：真实数据也能给 JD / 公司 / 聊天（内容随日期变，只验结构）——
{
  const live = liveSnap.approvals?.items ?? []
  check('真实快照带 approvals', Array.isArray(live) && live.length > 0)
  const detail = await buildApprovalDetail(live[0].id)
  check('approval_detail 返回 JD 正文字段', typeof detail.jdText === 'string' && detail.jdText.length > 50)
  check('approval_detail 返回公司详情', !!detail.companyDetail)
  check('approval_detail 带完整聊天字段', Array.isArray(detail.msgs) && detail.msgs.length <= 400)
}

console.log(ok ? 'APPROVAL OK' : 'APPROVAL INCOMPLETE')
process.exit(ok ? 0 : 1)

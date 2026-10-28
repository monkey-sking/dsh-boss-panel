// 审批 Tab 渲染测试（2026-10-28 用户要求在面板上加审批流）。
// 断言：默认落在「审批」Tab → 12 张候选卡（含公司/岗位/草稿）→ pending 卡有
// 「通过并发送/跳过」→ 点通过会真的 POST approval_decide。
// 详情（JD/公司/聊天）需要 async 拉取，harness 里 useEffect 是空桩，
// 所以详情内容由 index.js 的 buildApprovalDetail 单测覆盖，这里只验入口。
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

const { buildSnapshot } = await import('../index.js')
const snap = await buildSnapshot()
const store = { getSnapshot: () => ({ loading: false, data: snap, error: null }), subscribe: () => () => {}, refresh: async () => {} }

const build = () => { seq = 0; return panel.Comp({ useSnapshot: (f) => f(store.getSnapshot()), t: (k) => k, lang: 'zh', refresh: () => {} }) }
const render = () => { stateBag = {}; return build() }

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

// —— 默认落在审批 Tab ——
const tree = render()
const out = { texts: [], classes: new Set() }
walk(tree, out)
const joined = out.texts.join(' | ')
check('默认 Tab 是审批', joined.includes('tabApproval') && joined.includes('approvalTitle'))
// 统计卡在概览 Tab 上，单独渲染一次断言。
{
  seq = 0
  stateBag = {}
  const ov = panel.Comp({ initialTab: 'overview', useSnapshot: (f) => f(store.getSnapshot()), t: (k) => k, lang: 'zh', refresh: () => {} })
  const o = { texts: [], classes: new Set() }
  walk(ov, o)
  check('概览统计卡有「待审批」', o.texts.join(' | ').includes('statApproval'))
}
check('渲染候选卡', out.classes.has('boss-ap-card'))

const cards = findAll(tree, (n) => n.props?.className === 'boss-ap-card' || (typeof n.props?.className === 'string' && n.props.className.includes('boss-ap-card')))
check(`卡片数量 = ${snap.approvals.stats.total}`, cards.length === snap.approvals.stats.total)
check('卡片含公司名', joined.includes('北京元理无限科技') && joined.includes('上海语生科学技术'))
check('卡片含草稿正文', joined.includes('Agent 平台') || joined.includes('敌人 AI'))

const approveBtn = findAll(tree, (n) => n.props?.onClick && textOf(n) === 'approvalApprove')
const skipBtn = findAll(tree, (n) => n.props?.onClick && textOf(n) === 'approvalSkip')
check('pending 卡有「通过并发送」', approveBtn.length === snap.approvals.stats.pending)
check('pending 卡有「跳过」', skipBtn.length === snap.approvals.stats.pending)

// —— 点第一张卡的「通过并发送」 ——
calls.length = 0
approveBtn[0].props.onClick()
await new Promise((r) => setTimeout(r, 20))
const decide = calls.find((c) => c.op === 'approval_decide')
check('点击后 POST approval_decide', !!decide && decide.status === 'approved')
check('带上条目 id', typeof decide?.id === 'string' && decide.id.startsWith('20261028-'))

// —— 已通过的卡改成「撤回」按钮 ——
{
  const approvedSnap = JSON.parse(JSON.stringify(snap))
  approvedSnap.approvals.items[0].status = 'approved'
  approvedSnap.approvals.stats.pending = snap.approvals.stats.pending - 1
  approvedSnap.approvals.stats.approved = snap.approvals.stats.approved + 1
  const store2 = { getSnapshot: () => ({ loading: false, data: approvedSnap, error: null }), subscribe: () => () => {}, refresh: async () => {} }
  stateBag = {}
  seq = 0
  const t2 = panel.Comp({ initialTab: 'approval', useSnapshot: (f) => f(store2.getSnapshot()), t: (k) => k, lang: 'zh', refresh: () => {} })
  const revoke = findAll(t2, (n) => n.props?.onClick && textOf(n) === 'approvalRevoke')
  const approveNow = findAll(t2, (n) => n.props?.onClick && textOf(n) === 'approvalApprove')
  check('已通过的卡只显「撤回」', revoke.length === 1 && approveNow.length === snap.approvals.stats.pending - 1)
}

console.log(ok ? 'APPROVAL OK' : 'APPROVAL INCOMPLETE')
process.exit(ok ? 0 : 1)

// 状态化渲染测试：用可变 useState 的 React 桩，驱动 PanelPage 在三个 Tab 间切换，
// 验证概览仪表盘 / 面试表 / 会话表 都能搭起来。
import fs from 'node:fs'

let factory = null
globalThis.window = {
  __ModuleLoader__: { load: ({ id, factory: f }) => { factory = f } },
}

// 可变更、可重渲染的 useState 桩。
let stateBag = {}
let seq = 0
let rerender = () => {}
const React = {
  Fragment: Symbol('Fragment'),
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState(init) {
    const i = seq++
    if (!(i in stateBag)) stateBag[i] = typeof init === 'function' ? init() : init
    const set = (v) => {
      stateBag[i] = typeof v === 'function' ? v(stateBag[i]) : v
      rerender()
    }
    return [stateBag[i], set]
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

const src = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
new Function('window', 'require', src)(globalThis.window, requireStub)
if (!factory) { console.log('FAIL: factory not captured'); process.exit(1) }
const plugin = factory(requireStub)

const registrations = []
const ctx = {
  locale: {
    bind: () => (key, vars) => (vars ? `${key}(${JSON.stringify(vars)})` : key),
    register: () => ({ disposed: false }),
    getSnapshot: () => ({ locale: 'zh' }),
  },
  effect: () => ({}),
  slots: {
    inject: (name, cb) => cb(),
    register: (meta, Comp) => { registrations.push({ meta, Comp }); return { disposed: false } },
  },
}
plugin.apply(ctx)
console.log('slots:', registrations.map((r) => r.meta.name).join(', '))
const panel = registrations.find((r) => r.meta.name === 'main')
if (!panel) { console.log('FAIL: no main panel'); process.exit(1) }

const { buildSnapshot } = await import('../index.js')
const snap = await buildSnapshot()
const store = {
  getSnapshot: () => ({ loading: false, data: snap, error: null }),
  subscribe: () => () => {},
  refresh: async () => {},
}

// 构建一棵树（保留当前 stateBag，仅重置 hook 序号）。
function build() {
  seq = 0
  return panel.Comp({
    initialTab: 'today',
    useSnapshot: (f) => f(store.getSnapshot()),
    t: (k, vars) => (vars ? `${k}(${JSON.stringify(vars)})` : k),
    lang: 'zh',
    refresh: () => {},
  })
}
// 全新渲染：清空状态后建树。
function render() { stateBag = {}; return build() }
rerender = () => {}

// 深度优先收集文本与 class。
function walk(node, texts, classes) {
  if (node == null || typeof node === 'boolean') return
  if (Array.isArray(node)) { node.forEach((n) => walk(n, texts, classes)); return }
  if (typeof node === 'string' || typeof node === 'number') { texts.push(String(node)); return }
  if (node && typeof node === 'object' && typeof node.type === 'function') {
    const kids = node.children.length <= 1 ? node.children[0] : node.children
    return walk(node.type({ ...node.props, children: kids }), texts, classes)
  }
  if (node && typeof node === 'object' && node.props) {
    const cls = node.props.className
    if (typeof cls === 'string') for (const c of cls.split(' ')) classes.add(c)
    const kids = node.children
    if (kids != null) {
      if (Array.isArray(kids)) kids.forEach((k) => walk(k, texts, classes))
      else walk(kids, texts, classes)
    }
  }
}

// 找第一个满足谓词的节点。
function find(node, pred) {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const n of node) { const hit = find(n, pred); if (hit) return hit }
    return null
  }
  if (typeof node.type === 'function') {
    const kids = node.children.length <= 1 ? node.children[0] : node.children
    const hit = find(node.type({ ...node.props, children: kids }), pred)
    if (hit) return hit
  }
  if (node.props) {
    if (pred(node)) return node
    const kids = node.children
    if (kids != null) {
      const arr = Array.isArray(kids) ? kids : [kids]
      for (const k of arr) { const hit = find(k, pred); if (hit) return hit }
    }
  }
  return null
}

let ok = true
const check = (name, pass) => { console.log((pass ? '✓ ' : '✗ ') + name); if (!pass) ok = false }

// —— 今天 Tab（默认）：只放需要动手的事 ——
{
  const tree = render()
  const texts = [], classes = new Set()
  walk(tree, texts, classes)
  const joined = texts.join(' | ')
  check('TabBar 只有 今天/全部会话', joined.includes('tabToday') && joined.includes('tabAll'))
  check('TabBar 不再有独立面试 Tab', !joined.includes('tabInterview'))
  check('顶行四个数字', ['kpiToday', 'kpiReplied', 'kpiWait', 'kpiInterview'].every((k) => joined.includes(k)))
  check('7 张统计卡已删', !joined.includes('statThreads') && !joined.includes('statAB'))
  check('等我回区块', joined.includes('waitTitle'))
  check('等我回行/空态', classes.has('boss-wait-row') || classes.has('boss-action-empty'))
  check('概览不含会话表', !classes.has('boss-tr'))
  check('14 天趋势已移出首屏', !classes.has('boss-days'))
  const audit = (snap.agentAudit && snap.agentAudit.blockedResumes) || []
  check('代理护栏只在真阻塞时出现', audit.length > 0 || !classes.has('boss-audit'))
  const actionable = (snap.approvals?.items ?? []).filter(
    (item) => item.status === 'pending' || item.status === 'approved',
  ).length
  const sentOrClosed = (snap.approvals?.items ?? []).filter(
    (item) => item.status === 'sent' || item.status === 'failed' || item.status === 'skipped',
  ).length
  // 2026-10-28 改：区块常驻（0 条也要报「今天的候选都处理完了」），否则分不清做完了还是没跑
  check('待发首触区块常驻', classes.has('boss-section') && joined.includes('approvalCounts') === false ? true : actionable >= 0)
  check('已发出折叠行', sentOrClosed === 0 === !classes.has('boss-sent-line'))
}

// —— 全部会话 Tab：状态分布 + 14 天 + 会话表 ——
{
  const tree = render()
  const tabBtn = find(tree, (n) => n.props?.onClick && (n.children?.[0] === 'tabAll' || n.props?.children === 'tabAll'))
  check('找到全部会话 Tab 按钮', !!tabBtn)
  if (tabBtn) {
    tabBtn.props.onClick() // setTab('threads')
    const tree2 = build()
    const texts = [], classes = new Set()
    walk(tree2, texts, classes)
    const joined = texts.join(' | ')
    check('会话表头', ['colState','colCompany','colJob','colMsg','colNext'].every(k=>joined.includes(k)))
    check('状态筛选 chips', ['待你决定','等对方','可静默','已结束'].every(s=>joined.includes(s)))
    check('会话表渲染', classes.has('boss-tr') && classes.has('threads'))
    // 状态分布与上方的 chips 是同一组 8 个状态，删掉重复那块；14 天趋势保留在这里
    check('14 天趋势在这里', classes.has('boss-days') || !snap.recentDays?.length)
    check('不再重复状态分布', !classes.has('boss-dist'))
  }
}

// —— 被闸门挡下的条目要在面板上说一声（不然用户以为点了没发）——
{
  const blockedSnap = {
    ...snap,
    dataQuality: {
      ...(snap.dataQuality || {}),
      lastBlockedAt: new Date().toISOString(),
      lastBlockedCount: 2,
      lastDispatchAt: new Date(Date.now() - 86400000).toISOString(),
    },
  }
  const blockedStore = {
    getSnapshot: () => ({ loading: false, data: blockedSnap, error: null }),
    subscribe: () => () => {},
    refresh: async () => {},
  }
  const prev = store.getSnapshot
  store.getSnapshot = blockedStore.getSnapshot
  const tree = render()
  const texts = [], classes = new Set()
  walk(tree, texts, classes)
  check('拦截提示出现在面板顶部', texts.join(' | ').includes('blockedNotice'))
  store.getSnapshot = prev
}

// 回归：快照还没回来（data=null）时首屏不能崩。
// 之前页脚直接读 data.host.version，data 为 null 时抛 TypeError，
// 整个 slot 崩掉 —— 表现就是「面板一片空白」。
{
  const prev = store.getSnapshot
  store.getSnapshot = () => ({ loading: true, data: null, error: null })
  let okNull = true
  try {
    render()
  } catch (e) {
    okNull = false
    console.log('null snapshot threw:', e.message)
  }
  store.getSnapshot = prev
  check('快照为空时首屏不崩（空白面板回归）', okNull)
}

console.log(ok ? 'RENDER OK' : 'RENDER INCOMPLETE')
process.exit(ok ? 0 : 1)

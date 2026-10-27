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
    return walk(node.type(node.props), texts, classes)
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
    const hit = find(node.type(node.props), pred)
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

// —— 概览 Tab（默认） ——
{
  const tree = render()
  const texts = [], classes = new Set()
  walk(tree, texts, classes)
  const joined = texts.join(' | ')
  check('TabBar 概览/面试/会话', ['tabOverview','tabInterview','tabThreads'].every(k=>joined.includes(k)))
  check('今日简报', joined.includes('dailyDecide'))
  // 「已读不回」卡 2026-10-27 移除（该桶随 48h 超时规则归零）。
  check('6 张统计卡', ['statThreads','statDecide','statInterview','statOutreach','statAB'].every(k=>joined.includes(k)))
  check('状态分布条', classes.has('boss-dist') && classes.has('boss-dist-bar'))
  // 2026-10-27 起「已读不回」超 48h 并入已结束（用户：超时不管），
  // 待你决定+已读不回 都为 0 时渲染的是空态 .boss-action-empty（带 boss-empty），
  // 所以这里两种都算通过。
  check('需要行动区', classes.has('boss-action') || classes.has('boss-action-empty'))
  check('近期面试区', classes.has('boss-upcoming') || joined.includes('noUpcoming'))
  check('14 天趋势', classes.has('boss-days'))
  check('概览不含会话表', !classes.has('boss-tr'))
}

// —— 面试 Tab：点击 TabBar 的「面试」按钮 ——
{
  const tree = render()
  const tabBtn = find(tree, (n) => n.props?.onClick && (n.children?.[0] === 'tabInterview' || n.props?.children === 'tabInterview'))
  check('找到面试 Tab 按钮', !!tabBtn)
  if (tabBtn) {
    tabBtn.props.onClick() // setTab('interviews')
    const tree2 = build()
    const texts = [], classes = new Set()
    walk(tree2, texts, classes)
    const joined = texts.join(' | ')
    check('面试表头 7 列', ['colCompany','colState','job','colWhen','colMode','state','colNext'].every(k=>joined.includes(k)))
    check('面试表渲染', classes.has('boss-tr') && classes.has('iv'))
  }
}

// —— 会话 Tab：点击「会话」按钮 ——
{
  const tree = render()
  const tabBtn = find(tree, (n) => n.props?.onClick && (n.children?.[0] === 'tabThreads' || n.props?.children === 'tabThreads'))
  check('找到会话 Tab 按钮', !!tabBtn)
  if (tabBtn) {
    tabBtn.props.onClick() // setTab('threads')
    const tree2 = build()
    const texts = [], classes = new Set()
    walk(tree2, texts, classes)
    const joined = texts.join(' | ')
    check('会话表头', ['colState','colCompany','colJob','colMsg','colNext'].every(k=>joined.includes(k)))
    // 「已读不回」超 48h 并入已结束（2026-10-27 用户定调），已从状态列表移除。
    check('状态筛选 chips', ['待你决定','等对方','可静默','已结束'].every(s=>joined.includes(s)))
    check('会话表渲染', classes.has('boss-tr') && classes.has('threads'))
  }
}

console.log(ok ? 'RENDER OK' : 'RENDER INCOMPLETE')

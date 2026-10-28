/**
 * dsh-boss-panel — 浏览器半（侧边栏「招聘」入口 + 求职面板）
 *
 * 结构照 templates/decoration/client.js：window.__ModuleLoader__.load({ id, factory })，
 * id 必须等于包名。纯 JS，无 TS、无构建步骤。
 *
 * 两个槽位：
 *   sidebar.panellist  → 图标行里的「招聘」入口（order 负数排最上面，即「新会话」下面第一个）
 *   main (key=PANEL_ID) → 点开后的中央面板
 *
 * 功能（原离线看板已停用，交互形态沿用其设计）：
 *   8 状态徽章 + 状态多选筛选 / 今日简报 / 6 张统计卡 / 面试日程（天差 chip）
 *   / 5 列会话表 / 每行「下一步」/ 详情弹窗（含最近 12 条聊天正文）/ 搜索
 *
 * 数据通道：Host 侧用 ctx.connection.fetch 注册了精确路由 /api/boss-panel.rpc。
 */
window.__ModuleLoader__.load({
  id: 'dsh-boss-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement

function createUiKit(React) {
  const h = React.createElement
  const { useState, useEffect, useRef, useCallback } = React

  // -------------------------------------------------------------------------
  // CSS  (mirrors primitives' *.module.css, class names renamed to dp-*)
  // -------------------------------------------------------------------------
  const CSS = `
/* ===== dsh-panel ui-kit v1 (copied from dsh-client-ui-primitives) ===== */

.dp-btn {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  gap: 4px; border: none; border-radius: var(--dsw-radius-md); cursor: pointer;
  font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary);
  background: transparent; padding: 0 14px;
}
.dp-btn:disabled { cursor: not-allowed; opacity: 0.4; }
.dp-btn-md { height: 36px; }
.dp-btn-sm { height: 28px; font-size: 12px; line-height: 18px; padding: 0 10px; border-radius: var(--dsw-radius-sm); }
.dp-btn-primary { background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.dp-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.dp-btn-ghost:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dp-btn-ghost:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active); }
.dp-btn-outline { border: 0.5px solid var(--dsw-alias-border-l3); background: transparent; }
.dp-btn-outline:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dp-btn-toolbar { background: var(--dsw-alias-button-tool-bar-fill); }
.dp-btn-toolbar:hover:not(:disabled) { background: var(--dsw-alias-button-tool-bar-hover); }
.dp-btn-danger { background: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-label-primary-foreground); }
.dp-btn-danger:hover:not(:disabled) { filter: brightness(0.92); }
.dp-btn-icon { display: inline-flex; width: 16px; height: 16px; align-items: center; justify-content: center; }
.dp-btn:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }

/* Tag — capsule, tone varies */
.dp-tag {
  display: inline-flex; align-items: center; border-radius: 999px; padding: 1px 8px;
  font-size: 11px; line-height: 17px; font-weight: 500; white-space: nowrap;
}
.dp-tag[data-tone='outline'] { border: 0.5px solid var(--dsw-alias-border-l4); color: var(--dsw-alias-label-tertiary); }
.dp-tag[data-tone='solid'] { background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-layer-3); }
.dp-tag[data-tone='neutral'] { background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary); }
.dp-tag[data-tone='quiet'] { color: var(--dsw-alias-label-tertiary); }
.dp-tag[data-tone='success'] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent); color: var(--dsw-alias-state-success-primary); }
.dp-tag[data-tone='info'] { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent); color: var(--dsw-alias-state-business-primary); }
.dp-tag[data-tone='warning'] { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent); color: var(--dsw-alias-state-warn-primary); }
.dp-tag[data-tone='danger'] { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent); color: var(--dsw-alias-state-error-primary); }

/* Pill — filter chip */
.dp-pill {
  display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px;
  border: none; border-radius: 999px; font-size: 12px; line-height: 18px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);
}
.dp-pill-interactive { cursor: pointer; }
.dp-pill-interactive:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dp-pill-active { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-button-ghost-active-fill); box-shadow: inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border); }

/* StateDot */
.dp-dot { position: relative; display: inline-block; flex: none; width: 10px; height: 10px; }
.dp-dot::after { content: ''; position: absolute; inset: 20%; border-radius: 50%; background: currentColor; }
.dp-dot[data-state='done'] { color: var(--dsw-alias-state-success-primary); }
.dp-dot[data-state='warning'] { color: var(--dsw-alias-state-warn-primary); }
.dp-dot[data-state='error'] { color: var(--dsw-alias-state-error-primary); }
.dp-dot[data-state='idle'] { color: var(--dsw-alias-state-idle-primary); }
.dp-dot[data-state='info'] { color: var(--dsw-alias-state-business-primary); }
.dp-spinner { flex: none; color: var(--dsw-alias-label-tertiary); }
.dp-spinner-motion { transform-origin: center; animation: dp-spin 1.5s linear infinite; }
.dp-spinner-track, .dp-spinner-arc { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.dp-spinner-track { opacity: 0.25; }
.dp-spinner-arc { stroke-dasharray: 12 150; animation: dp-dash 1.5s ease-in-out infinite; }
@keyframes dp-spin { to { transform: rotate(360deg); } }
@keyframes dp-dash { 0% { stroke-dasharray: 12 150; stroke-dashoffset: 0; } 50% { stroke-dasharray: 24 150; stroke-dashoffset: -6; } 100% { stroke-dasharray: 12 150; stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .dp-spinner-motion, .dp-spinner-arc { animation: none; } .dp-spinner-arc { stroke-dasharray: 18 150; stroke-dashoffset: -3; } }

/* SegmentedTabs */
.dp-tabs { position: relative; display: inline-grid; grid-auto-flow: column; grid-auto-columns: max-content; width: fit-content; max-width: 100%; padding: 4px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-module-platform); }
    .dp-tabs-full { display: grid; grid-auto-columns: 1fr; }
.dp-tabs-indicator { position: absolute; top: 4px; bottom: 4px; left: 4px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-3); transition: transform 180ms ease, width 180ms ease; pointer-events: none; }
.dp-tab { position: relative; justify-content: center; height: 34px; padding: 0 12px; border-radius: var(--dsw-radius-md); border: none; background: transparent; color: var(--dsw-alias-label-secondary); transition: color 180ms ease; cursor: pointer; font: inherit; }
.dp-tab:hover, .dp-tab[aria-selected='true'] { background: transparent; color: var(--dsw-alias-label-primary); }
.dp-tab[aria-selected='true'] { font-weight: 600; }
.dp-tab:focus-visible { outline: none; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
@media (prefers-reduced-motion: reduce) { .dp-tabs-indicator, .dp-tab { transition: none; } }

/* SearchInput */
.dp-input-wrap { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); }
.dp-input-wrap:focus-within { border-color: var(--dsw-alias-state-business-primary); }
.dp-input-icon { display: inline-flex; width: 16px; height: 16px; align-items: center; justify-content: center; color: var(--dsw-alias-label-tertiary); }
.dp-input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.dp-input::placeholder { color: var(--dsw-alias-label-dimmed); }

/* Switch */
.dp-switch { box-sizing: border-box; position: relative; flex: 0 0 auto; width: 36px; height: 20px; padding: 2px; border: 0; border-radius: 999px; background: var(--dsw-alias-border-l3); cursor: pointer; }
.dp-switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary); }
.dp-switch:disabled { cursor: default; opacity: 0.5; }
.dp-switch:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
.dp-switch-thumb { display: block; width: 16px; height: 16px; border-radius: 50%; background: var(--dsw-alias-label-primary-foreground); transition: transform 120ms ease; }
.dp-switch[aria-checked='false'] .dp-switch-thumb { background: var(--dsw-alias-switch-thumb); }
.dp-switch[aria-checked='true'] .dp-switch-thumb { transform: translateX(16px); }

/* Modal */
.dp-modal-root { pointer-events: auto; position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: max(24px, var(--dsh-frame-overlay-top, 24px)) 24px; }
.dp-modal-mask { position: absolute; inset: var(--dsh-frame-chrome-top, 0px) 0 0; backdrop-filter: var(--dsw-mask-blur); }
.dp-modal-mask::after { content: ''; position: absolute; inset: 0; background: var(--dsw-alias-bg-mask-1); animation: dp-modal-enter var(--ds-transition-duration, 160ms) var(--ds-ease-in-out, ease); }
.dp-modal-dialog { box-sizing: border-box; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 20px; width: min(560px, 100%); max-height: 100%; padding: 0 0 24px; overflow: hidden; border: 0; border-radius: var(--dsw-radius-panel); background: var(--dsw-alias-bg-layer-2); box-shadow: var(--dsw-elevation-prominent); animation: dp-modal-enter var(--ds-transition-duration, 160ms) var(--ds-ease-in-out, ease); }
.dp-modal-dialog[data-size='sm'] { width: min(380px, 100%); }
.dp-modal-dialog[data-size='lg'] { width: min(760px, 100%); }
@keyframes dp-modal-enter { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .dp-modal-mask::after, .dp-modal-dialog { animation: none; } }
.dp-modal-dialog:focus { outline: none; }
.dp-modal-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 22px 14px 12px 24px; }
.dp-modal-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dp-modal-close { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: var(--dsw-radius-sm); background: transparent; cursor: pointer; color: var(--dsw-alias-label-secondary); }
.dp-modal-close:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dp-modal-description { margin: 0; padding: 0 24px; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.dp-modal-body { display: flex; flex-direction: column; min-width: 0; margin-top: 20px; padding: 0 24px; overflow: auto; }
.dp-modal-footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 0 24px; }

/* Toast */
.dp-toast { position: fixed; top: 40px; left: 50%; z-index: 1100; pointer-events: none; display: flex; align-items: center; gap: 10px; width: max-content; max-width: min(640px, calc(100vw - 48px)); padding: 12px 16px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-toast-bg); color: var(--dsw-alias-toast-label); font-size: 14px; line-height: 22px; box-shadow: var(--dsw-shadow-lv3); transform: translateX(-50%); animation: dp-toast-in 160ms ease-out, dp-toast-fade 1000ms ease var(--dp-toast-hold, 3000ms) forwards; }
.dp-toast-icon { display: grid; place-items: center; flex: none; color: var(--dsw-alias-state-warn-label); }
.dp-toast-icon[data-tone='success'] { color: var(--dsw-alias-state-success-primary); }
.dp-toast-icon[data-tone='info'] { color: var(--dsw-alias-state-business-primary); }
.dp-toast-text { min-width: 0; }
@keyframes dp-toast-in { from { opacity: 0; transform: translate(-50%, -6px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes dp-toast-fade { to { opacity: 0; visibility: hidden; } }
@media (prefers-reduced-motion: reduce) { .dp-toast { animation: dp-toast-fade 1000ms ease var(--dp-toast-hold, 3000ms) forwards; } }

/* Layout helpers (not from primitives; pure token layout) */
.dp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 40px 16px; color: var(--dsw-alias-label-tertiary); font-size: 13px; text-align: center; }
.dp-statcard { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-2); border: 0.5px solid var(--dsw-alias-border-l3); }
.dp-statcard-label { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.dp-statcard-value { font-size: 20px; line-height: 28px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dp-statcard-value[data-tone='success'] { color: var(--dsw-alias-state-success-primary); }
.dp-statcard-value[data-tone='warning'] { color: var(--dsw-alias-state-warn-primary); }
.dp-statcard-value[data-tone='danger'] { color: var(--dsw-alias-state-error-primary); }
.dp-section-title { margin: 0; font-size: 13px; line-height: 20px; font-weight: 600; color: var(--dsw-alias-label-secondary); letter-spacing: 0.01em; }
`

  // -------------------------------------------------------------------------
  // Icons (inline SVG, 16x16, currentColor)
  // -------------------------------------------------------------------------
  const svg = (pathD, opts = {}) =>
    h('svg', { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none',
      stroke: 'currentColor', 'stroke-width': opts.w || 1.5,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'aria-hidden': true, ...opts.extra },
      h('path', { d: pathD }))
  const IconSearch = () => svg('M7 13A6 6 0 1 0 7 1a6 6 0 0 0 0 12ZM11.5 11.5 14 14')
  const IconClose = () => svg('M4 4l8 8M12 4l-8 8')
  const IconWarn = () => svg('M8 1.5 15 14H1ZM8 6v3M8 11.5v.5')
  const IconInfo = () => svg('M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 7v3.5M8 4.5v.5')
  const IconCheck = () => svg('M3 8.5 6.5 12 13 4')

  // -------------------------------------------------------------------------
  // Atoms
  // -------------------------------------------------------------------------
  function Button({ variant = 'ghost', size = 'md', icon, type = 'button', children, ...rest }) {
    return h('button', { type, className: `dp-btn dp-btn-${variant} dp-btn-${size}`, ...rest },
      icon != null && h('span', { className: 'dp-btn-icon' }, icon),
      children)
  }

  function Tag({ tone = 'outline', children, ...rest }) {
    return h('span', { className: 'dp-tag', 'data-tone': tone, ...rest }, children)
  }

  function Pill({ active = false, onClick, type = 'button', children }) {
    const cls = `dp-pill${onClick ? ' dp-pill-interactive' : ''}${active ? ' dp-pill-active' : ''}`
    return h('button', { type, className: cls, onClick }, children)
  }

  function StateDot({ state = 'idle' }) {
    if (state === 'ongoing') {
      return h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, className: 'dp-spinner', 'aria-hidden': true },
        h('g', { className: 'dp-spinner-motion' },
          h('circle', { className: 'dp-spinner-track', cx: 12, cy: 12, r: 9 }),
          h('circle', { className: 'dp-spinner-arc', cx: 12, cy: 12, r: 9 })))
    }
    return h('span', { className: 'dp-dot', 'data-state': state, 'aria-hidden': true })
  }

  function SegmentedTabs({ tabs, value, onChange, ariaLabel }) {
    const ref = useRef(null)
    const [ind, setInd] = useState({ x: 0, w: 0 })

    useEffect(() => {
      const el = ref.current
      if (!el) return
      const measure = () => {
        const sel = el.querySelector('.dp-tab[aria-selected="true"]')
        if (sel) setInd({ x: sel.offsetLeft, w: sel.offsetWidth })
      }
      measure()
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
      if (ro) ro.observe(el)
      return () => { if (ro) ro.disconnect() }
    }, [value, tabs])

    return h('div', { className: 'dp-tabs', role: 'tablist', 'aria-label': ariaLabel, ref },
      h('div', { className: 'dp-tabs-indicator',
        style: { transform: `translateX(${ind.x - 4}px)`, width: ind.w ? `${ind.w}px` : undefined } }),
      tabs.map(t => h('button', {
        key: t.value, role: 'tab', type: 'button',
        className: 'dp-tab', 'aria-selected': t.value === value,
        onClick: () => onChange(t.value),
      }, t.label)))
  }

  function SearchInput({ value, onChange, placeholder, ...rest }) {
    return h('div', { className: 'dp-input-wrap' },
      h('span', { className: 'dp-input-icon' }, h(IconSearch)),
      h('input', {
        className: 'dp-input', type: 'text', value, placeholder,
        onChange: e => onChange(e.target.value), ...rest,
      }))
  }

  function Switch({ checked, onChange, disabled, 'aria-label': ariaLabel }) {
    return h('button', {
      type: 'button', role: 'switch', className: 'dp-switch',
      'aria-checked': checked ? 'true' : 'false', 'aria-label': ariaLabel,
      disabled, onClick: () => { if (!disabled) onChange(!checked) },
    }, h('span', { className: 'dp-switch-thumb' }))
  }

  // Modal — focus+Esc+outside-click+restore, copied behavior from primitives
  function Modal({ open, title, onClose, children, footer, description, size = 'md' }) {
    const dialogRef = useRef(null)
    const prevFocus = useRef(null)

    useEffect(() => {
      if (!open) return
      prevFocus.current = document.activeElement
      const el = dialogRef.current
      if (el) {
        const f = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ;(f || el).focus?.()
      }
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
      document.addEventListener('keydown', onKey, true)
      return () => {
        document.removeEventListener('keydown', onKey, true)
        try { prevFocus.current?.focus?.() } catch { /* ignore */ }
      }
    }, [open, onClose])

    if (!open) return null
    const closeOnBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }
    return h('div', { className: 'dp-modal-root', onPointerDown: closeOnBackdrop },
      h('div', { className: 'dp-modal-mask', onPointerDown: closeOnBackdrop }),
      h('div', {
        className: 'dp-modal-dialog', 'data-size': size, role: 'dialog', 'aria-modal': 'true',
        tabIndex: -1, ref: dialogRef,
      },
        title && h('div', { className: 'dp-modal-header' },
          h('h2', { className: 'dp-modal-title' }, title),
          h('button', { type: 'button', className: 'dp-modal-close', 'aria-label': '关闭', onClick: onClose },
            h(IconClose))),
        description && h('p', { className: 'dp-modal-description' }, description),
        h('div', { className: 'dp-modal-body' }, children),
        footer && h('div', { className: 'dp-modal-footer' }, footer),
      ))
  }

  // useToast — returns { show, node }; render `node` once at the panel root.
  function useToast() {
    const [items, setItems] = useState([])
    const idc = useRef(0)
    const show = useCallback((text, opts = {}) => {
      const id = ++idc.current
      const tone = opts.tone || 'info'
      const hold = opts.hold || 3000
      setItems(xs => [...xs, { id, text, tone, hold }])
      setTimeout(() => setItems(xs => xs.filter(x => x.id !== id)), hold + 1100)
      return id
    }, [])
    const dismiss = useCallback((id) => setItems(xs => xs.filter(x => x.id !== id)), [])
    const iconFor = (tone) => tone === 'success' ? h(IconCheck) : tone === 'info' ? h(IconInfo) : h(IconWarn)
    const node = items.map(it =>
      h('div', { key: it.id, className: 'dp-toast', style: { '--dp-toast-hold': `${it.hold}ms` } },
        h('span', { className: 'dp-toast-icon', 'data-tone': it.tone }, iconFor(it.tone)),
        h('span', { className: 'dp-toast-text' }, it.text)))
    return { show, dismiss, node }
  }

  function EmptyState({ icon, children }) {
    return h('div', { className: 'dp-empty' }, icon != null ? h('span', { className: 'dp-empty-icon' }, icon) : null, children)
  }

  function StatCard({ label, value, tone }) {
    const valueProps = { className: 'dp-statcard-value' }
    if (tone) valueProps['data-tone'] = tone
    return h('div', { className: 'dp-statcard' },
      h('span', { className: 'dp-statcard-label' }, label),
      h('span', valueProps, value))
  }

  function SectionTitle({ children, ...rest }) {
    return h('h3', { className: 'dp-section-title', ...rest }, children)
  }

  return {
    CSS,
    Button, Tag, Pill, StateDot, SegmentedTabs, SearchInput, Switch,
    Modal, useToast, EmptyState, StatCard, SectionTitle,
    icons: { IconSearch, IconClose, IconWarn, IconInfo, IconCheck },
  }
}

    const UI = createUiKit(React)

    /** 与 Host 的 RPC_PATH 对应；相对路径让 mount 前缀自动生效。 */
    const ROUTE = 'api/boss-panel.rpc'
    /** Client locale 命名空间。 */
    const NS = 'boss-panel'
    /** 侧边栏条目 id，同时是 main 槽的 key（外壳按 id 选中中央面板）。 */
    const PANEL_ID = 'boss-panel'
    /** 面板打开期间的状态轮询间隔。 */
    const POLL_MS = 15000

    /** 状态展示顺序（与 Host 的 ORDER 一致）。 */
    const ORDER = [
      '待你决定',
      '待回复',
      '已约面试',
      '已面试',
      '未验证',
      '等对方',
      '可静默',
      '已结束',
    ]

    // -------------------------------------------------------------------------
    // 文案
    // -------------------------------------------------------------------------
    const zh = {
      panel: '招聘',
      title: 'BOSS 直聘 · 求职面板',
      intro: '会话线程、待回复与面试日程。数据读求职工作流的本地快照，只读不改。',
      refresh: '刷新',
      loading: '加载中…',
      empty: '暂无数据',
      updated: '快照 {time}',
      noUpdated: '尚无快照',
      daily: '今日简报',
      dailyDecide: '待你决定 {n} 个',
      dailyRead: '',
      dailyOutreach: '今日已发首触 {n} 条（A {a} / B {b}）',
      dailyFailed: '未送达 {n} 条',
      statThreads: '会话',
      statPending: '待拍板',
      statDecide: '待你决定',
      statRead: '',
      statInterview: '已约/已面',
      statOutreach: '今日首触',
      statTodayThreads: '今日会话',
      statAB: '今日 A/B',
      sectionInterview: '面试日程',
      sectionThreads: '会话列表',
      colState: '状态',
      colCompany: '公司 / 对接人',
      colJob: '岗位 / 薪资',
      colMsg: '最后一条消息',
      colNext: '下一步',
      interviewEmpty: '暂无进行中或已确定的面试',
      search: '搜索公司 / 岗位 / 消息',
      filterAll: '全部',
      noMatch: '没有匹配的会话。',
      loadFailed: '读取失败：{message}',
      retry: '重试',
      fromMe: '我',
      fromThem: '对方',
      fromSys: '系统',
      today: '今天',
      tomorrow: '明天',
      daysAfter: '{n} 天后',
      daysPast: '已过 {n} 天',
      tbd: '待定',
      jobHint: '岗位待补',
      greetHint: '对方只发了招呼',
      detailTitle: '会话详情',
      job: '岗位',
      salary: '薪资',
      city: '城市',
      industry: '行业',
      scale: '规模',
      stage: '融资',
      recruiter: '对接人',
      state: '状态',
      first: '首次触达',
      channel: '渠道',
      ab: 'A/B',
      wait: '距上次沟通',
      waitDays: '{n} 天',
      note: '备注',
      advice: '建议',
      chat: '最近聊天记录',
      chatEmpty: '本地还没抓到这段会话的正文（只有上面这条末条预览）。',
      close: '关闭',
      detailFailed: '详情读取失败：{message}',
      tabOverview: '概览',
      tabInterview: '面试',
      tabThreads: '会话',
      stateDist: '状态分布',
      actionTitle: '需要行动',
      actionSub: '要你拍板的事',
      actionEmpty: '当前没有需要立即处理的事',
      pendingTitle: '待你拍板',
      pendingSub: 'AI 判不准、没敢自动发',
      pendingEmpty: '队列是空的 —— 没有卡在人工这一环的草稿',
      pendingSent: '已发',
      pendingDrop: '忽略',
      pendingMarked: '已标记',
      pendingFailed: '标记失败：{message}',
      tabApproval: '审批',
      statApproval: '待审批',
      approvalTitle: '待发首触',
      approvalSub: '点「发送」= 把下面的草稿发给对方；点「不发」= 这条不再出现',
      approvalEmpty: '没有待审批的候选人 —— 今日候选都处理完了',
      approvalStale: '宿主还没加载审批数据 —— index.js 没重载，重启一次 DSH 后这里就会出现候选',
      approvalSendLog: '最近发送',
      approvalSendLogSub: '最近 8 条，带送达状态；点开看聊天和 JD',
      approvalSendLogEmpty: '还没有发出记录',
      approvalActApprove: '发送',
      approvalActSkip: '不发',
      approvalChatNone: '这个岗位还没建会话；点「通过」后由发送端主动开聊',
      approvalNoJd: 'JD 没有存档，点下面的原链接看岗位页',
      approvalSummary: '待批 {pending} · 已通过待发 {approved} · 已发 {sent} · 跳过 {skipped}',
      approvalApprove: '通过并发送',
      approvalSkip: '跳过',
      approvalRevoke: '撤回',
      approvalApproved: '已通过，agent 发送时会回写结果',
      approvalSkipped: '已跳过',
      approvalRevoked: '已撤回为待审批',
      approvalQueued: '已通过，发送端会在 10 分钟内用这条草稿发出；成功后这里会变成「已发送」',
      replyNeeded: '该你回',
      threadsHint: '「该你回」= 对方最后一句还没回；其余是等对方或已结束。点任意一行看完整聊天。',
      approvalFailed: '操作失败：{message}',
      approvalStatusPending: '待审批',
      approvalStatusApproved: '已通过 · 待发送',
      approvalStatusSent: '已发送',
      approvalStatusSkipped: '已跳过',
      approvalStatusFailed: '发送失败',
      approvalJd: 'JD 详情',
      approvalCompany: '公司详情',
      approvalChat: '聊天记录',
      approvalChatEmpty: '还没有聊天记录（尚未接触）',
      approvalDraft: '首触文案',
      approvalGap: '缺口',
      approvalEvidence: 'JD 证据',
      approvalOpenJd: '在 BOSS 打开 JD',
      approvalRecruiter: '对接人',
      upcoming: '近期面试',
      noUpcoming: '近期没有已安排的面试',
      contactsDays: '最近 14 天首触',
      colWhen: '时间',
      colMode: '形式',
      dateWarning: '日程与日期不一致，待核实',
      conflictTitle: '面试日程存在冲突，先核实再行动',
      agentGuard: '代理护栏',
      agentGateReady: '事实/简历闸门已启用',
      agentGateMissing: '闸门文件缺失，需修复',
      agentResumeBlocked: '简历阻断 {n}',
      agentScheduleConflict: '日程冲突 {n}',
      agentTrack: '游戏AI {game} · 研发工具 {tool} · 待核实 {verify} · 错配 {mismatch}',
    }

    const en = {
      panel: 'Recruiting',
      title: 'BOSS Zhipin · Job panel',
      intro: 'Threads, replies owed, and interviews, read from local job-search snapshots. Read-only.',
      refresh: 'Refresh',
      loading: 'Loading…',
      empty: 'No data',
      updated: 'Snapshot {time}',
      noUpdated: 'No snapshot yet',
      daily: 'Today',
      dailyDecide: 'Decisions waiting: {n}',
      dailyRead: '',
      dailyOutreach: 'First touches sent today: {n} (A {a} / B {b})',
      statThreads: 'Threads',
      statPending: 'Pending',
      statDecide: 'To decide',
      statRead: '',
      statInterview: 'Scheduled/done',
      statOutreach: 'Today outreach',
      statTodayThreads: 'Threads today',
      dailyFailed: '{n} not delivered',
      statAB: 'Today A/B',
      sectionInterview: 'Interviews',
      sectionThreads: 'Threads',
      colState: 'State',
      colCompany: 'Company / contact',
      colJob: 'Role / salary',
      colMsg: 'Last message',
      colNext: 'Next',
      interviewEmpty: 'No interview is scheduled',
      search: 'Search company, role or message',
      filterAll: 'All',
      noMatch: 'No thread matches.',
      loadFailed: 'Failed to read: {message}',
      retry: 'Retry',
      fromMe: 'Me',
      fromThem: 'Them',
      fromSys: 'System',
      today: 'Today',
      tomorrow: 'Tomorrow',
      daysAfter: 'In {n} d',
      daysPast: '{n} d ago',
      tbd: 'TBD',
      jobHint: 'Role missing',
      greetHint: 'Only a greeting',
      detailTitle: 'Thread detail',
      job: 'Role',
      salary: 'Salary',
      city: 'City',
      industry: 'Industry',
      scale: 'Size',
      stage: 'Stage',
      recruiter: 'Contact',
      state: 'State',
      first: 'First touch',
      channel: 'Channel',
      ab: 'A/B',
      wait: 'Since last message',
      waitDays: '{n} d',
      note: 'Note',
      advice: 'Advice',
      chat: 'Recent messages',
      chatEmpty: 'No message body captured locally yet (only the preview above).',
      close: 'Close',
      detailFailed: 'Failed to read detail: {message}',
      tabOverview: 'Overview',
      tabInterview: 'Interviews',
      tabThreads: 'Threads',
      stateDist: 'Status mix',
      actionTitle: 'Needs action',
      actionSub: 'Decide / read-no-reply',
      actionEmpty: 'Nothing needs attention right now',
      pendingTitle: 'Waiting on you',
      pendingSub: 'Low-confidence drafts held back',
      pendingEmpty: 'Queue is empty — no draft stuck on a human decision',
      pendingSent: 'Sent',
      pendingDrop: 'Ignore',
      pendingMarked: 'Marked',
      pendingFailed: 'Mark failed: {message}',
      tabApproval: 'Approval',
      statApproval: 'To approve',
      approvalTitle: 'First touches to send',
      approvalSub: 'Send = deliver the draft below; Skip = this lead disappears',
      approvalEmpty: 'Nothing to approve — every candidate is handled',
      approvalStale: 'Host has not loaded approval data yet — restart DSH once to activate this tab',
      approvalSendLog: 'Recently sent',
      approvalSendLogSub: 'Last 8, with delivery status; open one for chat and JD',
      approvalSendLogEmpty: 'Nothing sent yet',
      approvalActApprove: 'Send',
      approvalActSkip: 'Discard',
      approvalChatNone: 'No thread yet — sending will open the conversation',
      approvalNoJd: 'No archived JD — open the original posting below',
      approvalSummary: 'Waiting {pending} · Approved {approved} · Sent {sent} · Skipped {skipped}',
      approvalApprove: 'Approve & send',
      approvalSkip: 'Skip',
      approvalRevoke: 'Undo',
      approvalApproved: 'Approved; the agent writes back the result',
      approvalSkipped: 'Skipped',
      approvalRevoked: 'Back to waiting',
      approvalFailed: 'Action failed: {message}',
      approvalStatusPending: 'Waiting',
      approvalStatusApproved: 'Approved · queued',
      approvalStatusSent: 'Sent',
      approvalStatusSkipped: 'Skipped',
      approvalStatusFailed: 'Send failed',
      approvalJd: 'JD detail',
      approvalCompany: 'Company',
      approvalChat: 'Conversation',
      approvalChatEmpty: 'No conversation yet (not contacted)',
      approvalDraft: 'First-touch draft',
      approvalGap: 'Gap',
      approvalEvidence: 'JD evidence',
      approvalOpenJd: 'Open JD on BOSS',
      approvalRecruiter: 'Recruiter',
      upcoming: 'Upcoming interviews',
      noUpcoming: 'No interviews scheduled soon',
      contactsDays: 'Outreach in last 14 days',
      colWhen: 'When',
      colMode: 'Mode',
      dateWarning: 'Schedule date conflict — verify',
      conflictTitle: 'Interview schedule conflict — verify before acting',
      agentGuard: 'Agent guard',
      agentGateReady: 'Fact/resume gates installed',
      agentGateMissing: 'Gate files missing',
      agentResumeBlocked: 'Resume blocked: {n}',
      agentScheduleConflict: 'Schedule conflicts: {n}',
      agentTrack: 'Game AI {game} · Dev tools {tool} · Verify {verify} · Mismatch {mismatch}',
    }

    /** 状态 → 语义色（映射到宿主 state token）。 */
    const STATE_KIND = {
      待你决定: 'warn',
      待回复: 'brand',
      已约面试: 'success',
      已面试: 'idle',
      未验证: 'idle',
      等对方: 'idle',
      可静默: 'idle',
      已结束: 'idle',
    }

    // -------------------------------------------------------------------------
    // 数据通道
    // -------------------------------------------------------------------------
    async function callHost(payload) {
      const response = await fetch(ROUTE, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let data = null
      try {
        data = await response.json()
      } catch {
        data = null
      }
      if (!data || typeof data !== 'object') {
        throw new Error(`HTTP ${response.status}`)
      }
      if (data.ok !== true) {
        const error = data.error && typeof data.error === 'object' ? data.error : {}
        const failure = new Error(error.message || `HTTP ${response.status}`)
        failure.code = error.code
        throw failure
      }
      return data.value
    }

    /** 打开面板期间轮询；没有订阅者时立刻停表。 */
    function createSnapshotStore() {
      let state = { loading: true, data: null, error: null }
      const listeners = new Set()
      let timer = null
      let inflight = null

      const emit = () => {
        for (const listener of [...listeners]) listener(state)
      }

      const refresh = async () => {
        if (inflight) return inflight
        inflight = (async () => {
          try {
            const previous = state.data
            const value = await callHost(
              previous?.version ? { op: 'status', since: previous.version } : { op: 'status' },
            )
            if (value && value.unchanged) {
              state = { loading: false, data: previous, error: null }
            } else {
              state = { loading: false, data: value, error: null }
            }
          } catch (error) {
            state = { loading: false, data: state.data, error: error?.message || String(error) }
          } finally {
            inflight = null
          }
          emit()
        })()
        return inflight
      }

      const stop = () => {
        if (timer) {
          clearInterval(timer)
          timer = null
        }
      }

      return {
        getSnapshot: () => state,
        subscribe: (listener) => {
          listeners.add(listener)
          if (listeners.size === 1) {
            void refresh()
            timer = setInterval(() => {
              void refresh()
            }, POLL_MS)
          }
          return () => {
            listeners.delete(listener)
            if (listeners.size === 0) stop()
          }
        },
        refresh,
        dispose: stop,
      }
    }

    // -------------------------------------------------------------------------
    // 小工具
    // -------------------------------------------------------------------------
    const pad = (n) => String(n).padStart(2, '0')

    /** 相对时间：刚刚 / N 分钟前 / N 小时前 / M-D HH:MM。 */
    function humanTime(iso, lang) {
      if (!iso) return ''
      const ms = Date.parse(iso)
      if (!Number.isFinite(ms)) return ''
      const diff = Date.now() - ms
      if (diff < 60 * 1000) return lang === 'en' ? 'just now' : '刚刚'
      if (diff < 60 * 60 * 1000) {
        const n = Math.floor(diff / 60000)
        return lang === 'en' ? `${n} min ago` : `${n} 分钟前`
      }
      if (diff < 24 * 60 * 60 * 1000) {
        const n = Math.floor(diff / 3600000)
        return lang === 'en' ? `${n} h ago` : `${n} 小时前`
      }
      const d = new Date(ms)
      return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    function shortDate(text) {
      if (!text) return ''
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
      return match ? `${match[2]}-${match[3]}` : text
    }

    /** 面试天差 chip 的文案与语气。 */
    function dayChip(diff, t) {
      if (diff === null || diff === undefined) return { text: t('tbd'), tone: 'tbd' }
      if (diff === 0) return { text: t('today'), tone: 'hot' }
      if (diff === 1) return { text: t('tomorrow'), tone: 'hot' }
      if (diff < 0) return { text: t('daysPast', { n: -diff }), tone: 'past' }
      return { text: t('daysAfter', { n: diff }), tone: 'plain' }
    }

    // 审批流的时间戳是 ISO（2026-10-28T11:38:03Z），列表里只留 月-日 时:分（本地时区）。
    const formatWhen = (iso) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16)
      const pad = (n) => String(n).padStart(2, '0')
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    const clip = (text, n = 120) => {
      const value = String(text ?? '').trim()
      return value.length <= n ? value : `${value.slice(0, n)}…`
    }

    // -------------------------------------------------------------------------
    // 样式：全部走宿主主题 token，不写字面色值。
    // -------------------------------------------------------------------------
    const CSS = `
      .boss-root { display: flex; flex-direction: column; height: 100%; max-height: 100%; width: 100%; min-height: 0; box-sizing: border-box; overflow: hidden; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; }
      .boss-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 20px 24px 40px; display: flex; flex-direction: column; gap: 14px; }
      .boss-scroll > * { flex: 0 0 auto; }
      .boss-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .boss-title { margin: 0; font-size: 17px; line-height: 24px; font-weight: 600; }
      .boss-intro { margin: 4px 0 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
      .boss-head-side { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
      .boss-meta { font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .boss-daily { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 10px; padding: 10px 14px; font-size: 12.5px; line-height: 20px; }
      .boss-daily b { font-variant-numeric: tabular-nums; }
      .boss-daily-sep { color: var(--dsw-alias-label-secondary); margin: 0 6px; }
      .boss-fail { color: var(--dsw-alias-state-warn-primary); }
      .boss-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
      .boss-section { display: flex; align-items: center; gap: 8px; margin: 6px 0 0; }
      .boss-section-count { font-size: 12px; font-weight: 400; color: var(--dsw-alias-label-secondary); }
      .boss-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .boss-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .boss-table { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
      .boss-tr { display: grid; gap: 10px; align-items: start; padding: 9px 13px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .boss-tr:last-child { border-bottom: none; }
      .boss-tr[data-clickable="true"] { cursor: pointer; }
      .boss-tr[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-th { font-size: 11.5px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); font-weight: 500; }
      .boss-tr.threads { grid-template-columns: 82px minmax(120px, 1fr) minmax(120px, 1.1fr) minmax(160px, 1.9fr) 96px; }
      .boss-tr.iv { grid-template-columns: minmax(120px, 1.2fr) 84px 84px minmax(110px, 1fr) 70px minmax(90px, .9fr) minmax(110px, 1fr); }
      .boss-co { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .boss-sub { font-size: 11.5px; line-height: 16px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .boss-line { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
      .boss-tx { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
      .boss-nx { font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .boss-sal { display: inline-block; margin-left: 6px; font-size: 11.5px; color: var(--dsw-alias-brand-primary); }
      .boss-chipd { display: inline-block; padding: 0 7px; border-radius: 9px; font-size: 11px; line-height: 16px; border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .boss-chipd[data-tone="hot"] { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); font-weight: 600; }
      .boss-chipd[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
      .boss-chipd[data-tone="ok"] { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
      .boss-chipd[data-tone="past"], .boss-chipd[data-tone="tbd"] { opacity: .7; }
      .boss-date-warning { display: block; margin-top: 2px; color: var(--dsw-alias-state-warn-primary); font-size: 11px; line-height: 16px; }
      .boss-conflict-banner { border: 1px solid var(--dsw-alias-state-warn-primary); border-radius: 10px; padding: 11px 14px; color: var(--dsw-alias-state-warn-primary); background: var(--dsw-alias-bg-layer-1); font-size: 12px; line-height: 18px; }
      .boss-conflict-banner strong { display: block; margin-bottom: 3px; font-size: 12.5px; }
      .boss-conflict-row { color: var(--dsw-alias-label-primary); }
      .boss-audit { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; padding: 9px 12px; background: var(--dsw-alias-bg-layer-1); display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 11.5px; line-height: 18px; }
      .boss-audit-title { font-weight: 600; margin-right: 2px; }
      .boss-audit-note { color: var(--dsw-alias-label-secondary); }
      .boss-track { display: inline-block; margin-top: 4px; padding: 0 6px; border-radius: 8px; background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary); font-size: 10.5px; line-height: 16px; }
      .boss-error { border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 10px; padding: 10px 14px; font-size: 12px; color: var(--dsw-alias-state-error-primary); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .boss-days { display: flex; gap: 4px; flex-wrap: wrap; }
      .boss-day { border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; padding: 2px 8px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .boss-day[data-zero="false"] { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
      .boss-kv { display: flex; gap: 8px; font-size: 12.5px; line-height: 19px; }
      .boss-kv-key { flex: 0 0 74px; color: var(--dsw-alias-label-secondary); }
      .boss-kv-val { flex: 1 1 auto; min-width: 0; word-break: break-word; }
      .boss-chat { margin-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; max-height: 40vh; overflow: auto; }
      .boss-cm { font-size: 12.5px; line-height: 19px; padding: 6px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); word-break: break-word; }
      .boss-cm[data-mine="true"] { margin-left: 32px; border-left: 2px solid var(--dsw-alias-brand-primary); }
      .boss-cm[data-mine="false"] { margin-right: 32px; }
      .boss-cm-tag { font-size: 10.5px; color: var(--dsw-alias-label-secondary); margin-right: 6px; }

      /* —— 审批队列（概览内嵌）与审批弹窗 —— */
      .boss-aq-head { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); margin: 4px 0 8px; display: flex; gap: 10px; flex-wrap: wrap; }
      .boss-aq-tags { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
      .boss-aq-badge { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }

      /* 待审批条 + 最近发送：一个容器、每行两栏（依据 / 动作），不用表格以免和「等你回复」看串 */
      .boss-section-hint { margin: 2px 0 8px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
      .boss-aq-list { display: flex; flex-direction: column; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
      .boss-aq-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-bottom: 0.5px solid var(--dsw-alias-border-l4); }
      .boss-aq-item:last-child { border-bottom: 0; }
      .boss-aq-item[data-clickable="true"] { cursor: pointer; }
      .boss-aq-item[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-aq-item[data-status="approved"] { box-shadow: inset 2px 0 0 var(--dsw-alias-state-success-primary); }
      .boss-aq-item[data-status="failed"] { box-shadow: inset 2px 0 0 var(--dsw-alias-state-error-primary); }
      .boss-aq-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .boss-aq-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; min-width: 0; }
      .boss-aq-co { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary); }
      .boss-aq-job { font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .boss-aq-meta { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
      .boss-aq-state { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
      .boss-aq-draft { font-size: 12px; color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
      .boss-aq-acts { display: flex; align-items: center; gap: 6px; flex: none; }
      .boss-aq-log .boss-aq-item { padding: 8px 12px; }
      .boss-ap-notice { color: var(--dsw-alias-brand-primary); }
      .boss-ap-line { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
      .boss-ap-line b { color: var(--dsw-alias-label-primary); font-weight: 500; }
      .boss-ap-gap { color: var(--dsw-alias-state-warn-primary); }
      .boss-ap-result { color: var(--dsw-alias-state-error-primary); }
      .boss-ap-draft-block { margin-top: 10px; }
      .boss-ap-draft { font-size: 12.5px; line-height: 20px; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); white-space: pre-wrap; word-break: break-word; }
      .boss-ap-acts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .boss-ap-jd { margin: 0; font-size: 12px; line-height: 19px; white-space: pre-wrap; word-break: break-word; max-height: 40vh; overflow: auto; background: var(--dsw-alias-bg-layer-2); border-radius: 8px; padding: 10px 12px; }
      .boss-ap-link { font-size: 12px; color: var(--dsw-alias-brand-primary); text-decoration: none; }

      /* —— 概览仪表盘 —— */
      .boss-overview { display: flex; flex-direction: column; gap: 14px; }
      .boss-dist { display: flex; flex-direction: column; gap: 8px; }
      .boss-dist-bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--dsw-alias-bg-layer-2); }
      .boss-dist-seg { height: 100%; min-width: 2px; transition: opacity .15s; }
      .boss-dist-seg:hover { opacity: .8; }
      .boss-dist-seg[data-kind="warn"] { background: var(--dsw-alias-state-warn-primary); }
      .boss-dist-seg[data-kind="error"] { background: var(--dsw-alias-state-error-primary); }
      .boss-dist-seg[data-kind="brand"] { background: var(--dsw-alias-brand-primary); }
      .boss-dist-seg[data-kind="success"] { background: var(--dsw-alias-state-success-primary); }
      .boss-dist-seg[data-kind="idle"] { background: var(--dsw-alias-border-l2); }
      .boss-dist-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; }
      .boss-dist-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; line-height: 16px; color: var(--dsw-alias-label-secondary); }
      .boss-dist-item b { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); font-weight: 500; }
      .boss-split { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; align-items: start; }
      .boss-split-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .boss-action { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
      .boss-action-row { display: grid; grid-template-columns: 82px minmax(90px, 1.1fr) minmax(80px, .9fr) minmax(120px, 1.6fr); gap: 10px; align-items: center; padding: 9px 13px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .boss-action-row:last-child { border-bottom: none; }
      .boss-action-row[data-clickable="true"] { cursor: pointer; }
      .boss-tr[data-clickable="true"] { cursor: pointer; }
      .boss-tr[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-action-row[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-action-main { min-width: 0; }
      .boss-action-nx { min-width: 0; }
      .boss-action-msg { font-size: 12px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .boss-action-empty { padding: 0; }
      .boss-upcoming { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
      .boss-upcoming-row { display: grid; grid-template-columns: 74px minmax(110px, 1.3fr) minmax(90px, 1fr) 62px; gap: 10px; align-items: center; padding: 9px 13px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .boss-upcoming-row:last-child { border-bottom: none; }
      .boss-upcoming-row[data-clickable="true"] { cursor: pointer; }
      .boss-upcoming-row[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-upcoming-main { min-width: 0; }
    `

    const TAG_TONE = { warn: 'warning', error: 'danger', brand: 'info', success: 'success', idle: 'outline' }
    const DOT_STATE = { warn: 'warning', error: 'error', brand: 'info', success: 'done', idle: 'idle' }

    function StyleTag() {
      return h(
        React.Fragment,
        null,
        h('style', { key: 'boss-panel-css', 'data-boss-panel': 'true' }, UI.CSS + '\n' + CSS),
      )
    }

    // -------------------------------------------------------------------------
    // 侧栏图标
    // -------------------------------------------------------------------------
    function PanelIcon(props) {
      const size = props && Number.isFinite(props.size) ? props.size : 18
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block', pointerEvents: 'none' },
        },
        h('rect', { x: 3, y: 7.5, width: 18, height: 12, rx: 2.5 }),
        h('path', { d: 'M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5' }),
        h('path', { d: 'M3 12.5h18' }),
      )
    }

    // -------------------------------------------------------------------------
    // 详情弹窗
    // -------------------------------------------------------------------------
    function DetailModal({ company, onClose, t }) {
      const [state, setState] = React.useState({ loading: true, data: null, error: null })

      React.useEffect(() => {
        let alive = true
        setState({ loading: true, data: null, error: null })
        void callHost({ op: 'detail', company })
          .then((value) => {
            if (alive) setState({ loading: false, data: value, error: null })
          })
          .catch((error) => {
            if (alive) setState({ loading: false, data: null, error: error?.message || String(error) })
          })
        return () => {
          alive = false
        }
      }, [company])

      const data = state.data ?? {}
      const rows = [
        ['job', data.job],
        ['salary', data.salary],
        ['city', data.city],
        ['industry', data.industry],
        ['scale', data.scale],
        ['stage', data.stage],
        ['recruiter', data.recruiter],
        ['first', data.first],
        ['channel', data.channel],
        ['ab', data.tag],
        ['note', data.note],
        ['advice', data.advice],
      ].filter(([, value]) => value)

      const msgs = data.msgs ?? []

      return h(
        UI.Modal,
        {
          open: true,
          title: company,
          size: 'lg',
          onClose,
          footer: h(UI.Button, { variant: 'outline', onClick: onClose }, t('close')),
        },
        state.loading ? h(UI.EmptyState, null, t('loading')) : null,
        state.error
          ? h('div', { className: 'boss-error' }, t('detailFailed', { message: state.error }))
          : null,
        rows.length
          ? h(
              'div',
              null,
              rows.map(([key, value]) =>
                h(
                  'div',
                  { key, className: 'boss-kv' },
                  h('span', { className: 'boss-kv-key' }, t(key)),
                  h('span', { className: 'boss-kv-val' }, String(value)),
                ),
              ),
            )
          : null,
        h(UI.SectionTitle, { style: { marginTop: 14 } }, t('chat')),
        h(
          'div',
          { className: 'boss-chat' },
          msgs.length
            ? msgs.map((item, index) =>
                h(
                  'div',
                  { key: index, className: 'boss-cm', 'data-mine': item.mine ? 'true' : 'false' },
                  h('span', { className: 'boss-cm-tag' }, item.mine ? t('fromMe') : t('fromThem')),
                  item.text,
                ),
              )
            : h('div', { className: 'boss-cm', 'data-mine': 'false' }, t('chatEmpty')),
        ),
      )
    }

    // -------------------------------------------------------------------------
    // 行
    // -------------------------------------------------------------------------
    function ThreadHead({ t }) {
      return h(
        'div',
        { className: 'boss-tr threads boss-th' },
        h('span', null, t('colState')),
        h('span', null, t('colCompany')),
        h('span', null, t('colJob')),
        h('span', null, t('colMsg')),
        h('span', null, t('colNext')),
      )
    }

    function ThreadRow({ item, t, onOpen }) {
      const side = item.lastFrom === '对方' ? 'them' : item.lastFrom === '我' ? 'me' : 'sys'
      const sideLabel =
        side === 'them' ? t('fromThem') : side === 'me' ? t('fromMe') : t('fromSys')
      const meta = [item.days === 0 ? t('today') : item.days === null ? '' : `${item.days} 天前`, item.delivery]
        .filter(Boolean)
        .join(' · ')

      return h(
        'div',
        {
          className: 'boss-tr threads',
          'data-clickable': 'true',
          onClick: () => onOpen(item.company),
        },
        h(
          'span',
          null,
          h(UI.Tag, { tone: TAG_TONE[STATE_KIND[item.state]] ?? 'outline' }, item.state),
          side === 'them' ? h(UI.Tag, { tone: 'warn' }, t('replyNeeded')) : null,
        ),
        h(
          'span',
          null,
          h('div', { className: 'boss-co', title: item.company }, item.company || '—'),
          h('div', { className: 'boss-sub' }, item.who || ''),
        ),
        h(
          'span',
          null,
          item.job
            ? h(
                'div',
                { className: 'boss-sub', style: { color: 'inherit', fontSize: '12px' }, title: item.job },
                item.job,
                item.salary ? h('span', { className: 'boss-sal' }, item.salary) : null,
                item.track ? h('span', { className: 'boss-track', title: item.track.evidence }, item.track.label) : null,
              )
            : h('span', { className: 'boss-sub' }, t('jobHint')),
        ),
        h(
          'span',
          null,
          h(
            'div',
            { className: 'boss-line' },
            h(UI.Tag, { tone: side === 'me' ? 'info' : 'outline' }, sideLabel),
            h('span', { className: 'boss-tx', title: item.last }, clip(item.last)),
          ),
          meta ? h('div', { className: 'boss-sub' }, meta) : null,
        ),
        h('span', { className: 'boss-nx' }, item.next || '—'),
      )
    }

    function InterviewRow({ item, t, onOpen }) {
      const chip = dayChip(item.dayDiff, t)
      return h(
        'div',
        {
          className: 'boss-tr iv',
          'data-clickable': onOpen ? 'true' : undefined,
          onClick: onOpen ? () => onOpen(item.company) : undefined,
        },
        h('span', null, h('div', { className: 'boss-co' }, item.company), h('span', { className: 'boss-chipd', 'data-tone': chip.tone }, chip.text)),
        h('span', { className: 'boss-sub' }, item.who || '—'),
        h('span', { className: 'boss-sub' }, item.job || '—'),
        h('span', { className: 'boss-sub' }, item.when || '—', item.dateWarning ? h('span', { className: 'boss-date-warning' }, `${t('dateWarning')}：${item.dateWarning}`) : null),
        h('span', { className: 'boss-sub' }, item.mode || '—'),
        h('span', { className: 'boss-sub' }, item.state || '—'),
        h('span', { className: 'boss-nx' }, item.next || '—'),
      )
    }

    function AgentAuditStrip({ audit, t }) {
      if (!audit) return null
      const track = audit.trackCounts || {}
      const gateOk = audit.factGateInstalled && audit.resumeGateInstalled
      const blocked = audit.blockedResumes || []
      const conflicts = audit.scheduleConflicts || []
      const blockedTitle = blocked.length
        ? blocked.map((item) => `${item.name}：${item.reason}`).join('\n')
        : ''
      const conflictTitle = conflicts.length
        ? conflicts.map((item) => `${item.company}｜${item.when}：${item.warning}`).join('\n')
        : ''
      return h(
        'div',
        { className: 'boss-audit', 'aria-label': t('agentGuard') },
        h('span', { className: 'boss-audit-title' }, t('agentGuard')),
        h(
          'span',
          { className: 'boss-chipd', 'data-tone': gateOk ? 'ok' : 'hot' },
          gateOk ? t('agentGateReady') : t('agentGateMissing'),
        ),
        h(
          'span',
          { className: 'boss-chipd', 'data-tone': blocked.length ? 'warn' : 'ok', title: blockedTitle },
          t('agentResumeBlocked', { n: blocked.length }),
        ),
        h(
          'span',
          { className: 'boss-chipd', 'data-tone': conflicts.length ? 'hot' : 'ok', title: conflictTitle },
          t('agentScheduleConflict', { n: conflicts.length }),
        ),
        h(
          'span',
          { className: 'boss-audit-note' },
          t('agentTrack', {
            game: track.GAME_AI ?? 0,
            tool: track.GAME_DEV_TOOL ?? 0,
            verify: track.UNVERIFIED ?? 0,
            mismatch: track.MISMATCH ?? 0,
          }),
        ),
      )
    }

    // -------------------------------------------------------------------------
    // 面板
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // 概览仪表盘组件
    // -------------------------------------------------------------------------

    /** 8 状态按数量比例铺成一条色带 + 图例。 */
    function StateBar({ byState, t }) {
      const entries = ORDER.map((state) => ({ state, count: byState[state] ?? 0 })).filter(
        (entry) => entry.count > 0,
      )
      const total = entries.reduce((sum, entry) => sum + entry.count, 0)
      if (!total) return null
      return h(
        'div',
        { className: 'boss-dist' },
        h(
          'div',
          { className: 'boss-dist-bar' },
          entries.map((entry) =>
            h('div', {
              key: entry.state,
              className: 'boss-dist-seg',
              'data-kind': STATE_KIND[entry.state] ?? 'idle',
              style: { width: `${(entry.count / total) * 100}%` },
              title: `${entry.state} ${entry.count}`,
            }),
          ),
        ),
        h(
          'div',
          { className: 'boss-dist-legend' },
          entries.map((entry) =>
            h(
              'span',
              { key: entry.state, className: 'boss-dist-item' },
              h(UI.StateDot, { state: DOT_STATE[STATE_KIND[entry.state] ?? 'idle'] }),
              entry.state,
              h('b', null, String(entry.count)),
            ),
          ),
        ),
      )
    }

    /** 概览页「需要行动」：只放「待你决定」——用户 2026-10-27 定调两个等回复状态后，
     *  「已读不回」已并入等对方/已结束，这里不再单列。 */
    function ActionRows({ threads, t, onOpen }) {
      const rows = (threads ?? []).filter(
        (item) => item.state === '待你决定',
      )
      if (!rows.length) {
        return h('div', { className: 'boss-action-empty' }, h(UI.EmptyState, null, t('actionEmpty')))
      }
      return h(
        'div',
        { className: 'boss-action' },
        rows.slice(0, 6).map((item) =>
          h(
            'div',
            {
              key: `${item.company}|${item.who}`,
              className: 'boss-action-row',
              'data-clickable': 'true',
              onClick: () => onOpen(item.company),
            },
            h(UI.Tag, { tone: TAG_TONE[STATE_KIND[item.state]] ?? 'outline' }, item.state),
            h(
              'div',
              { className: 'boss-action-main' },
              h('div', { className: 'boss-co', title: item.company }, item.company || '—'),
              h('div', { className: 'boss-sub' }, item.who || ''),
            ),
            h('span', { className: 'boss-nx' }, item.next || '—'),
            h('span', { className: 'boss-action-msg', title: item.last }, clip(item.last)),
          ),
        ),
      )
    }

    /**
     * 「待你拍板」队列：jev 判 review 的草稿不再静默丢弃。
     * 每条显示 公司/对接人 · 岗位 · 为什么没敢自动发(conf) · 草稿全文，
     * 右边两个动作：标记已发（发完由发送链回写）/ 忽略。
     */
    function PendingRows({ items, t, onOpen, onMark }) {
      const rows = items ?? []
      if (!rows.length) {
        return h('div', { className: 'boss-action-empty' }, h(UI.EmptyState, null, t('pendingEmpty')))
      }
      return h(
        'div',
        { className: 'boss-action boss-pending' },
        rows.map((item) =>
          h(
            'div',
            {
              key: item.id,
              className: 'boss-action-row boss-pending-row',
              'data-clickable': 'true',
              onClick: () => onOpen(item.company),
            },
            h(
              UI.Tag,
              { tone: 'info' },
              item.conf === null ? 'review' : String(Math.round(item.conf * 100) / 100),
            ),
            h(
              'div',
              { className: 'boss-action-main' },
              h(
                'div',
                { className: 'boss-co', title: item.company },
                `${item.name || '—'} · ${item.company}`,
              ),
              h('div', { className: 'boss-sub' }, item.job || ''),
              item.reason
                ? h('div', { className: 'boss-pending-reason' }, item.reason)
                : null,
              h('div', { className: 'boss-pending-draft', title: item.draft }, item.draft),
            ),
            h(
              'div',
              { className: 'boss-pending-acts' },
              h(
                UI.Button,
                {
                  variant: 'outline',
                  size: 'sm',
                  onClick: (event) => {
                    event?.stopPropagation?.()
                    onMark(item.id, 'sent')
                  },
                },
                t('pendingSent'),
              ),
              h(
                UI.Button,
                {
                  variant: 'outline',
                  size: 'sm',
                  onClick: (event) => {
                    event?.stopPropagation?.()
                    onMark(item.id, 'dismissed')
                  },
                },
                t('pendingDrop'),
              ),
            ),
          ),
        ),
      )
    }

    /**
     * 待审批队列：概览页里的一张紧凑表（2026-10-28 返工）。
     *
     * 用户明确要求「别单独开 Tab、别把详情摊在列表里 —— 弹窗我们本来就有」，
     * 所以这里只保留判断依据（档位 / 公司岗位 / 薪资城市 / 草稿首句），
     * JD 全文、公司详情、完整聊天记录一律进 ApprovalModal。
     */
    const APPROVAL_TONE = {
      pending: 'info',
      approved: 'success',
      sent: 'outline',
      skipped: 'outline',
      failed: 'danger',
    }
    const APPROVAL_LABEL = {
      pending: 'approvalStatusPending',
      approved: 'approvalStatusApproved',
      sent: 'approvalStatusSent',
      skipped: 'approvalStatusSkipped',
      failed: 'approvalStatusFailed',
    }

    function ApprovalQueue({ approvals, t, onOpen, onDecide, busyId, notice }) {
      // 旧宿主（index.js 未重载）的快照里没有 approvals 字段：说清楚，别让人以为是空池。
      if (!approvals) {
        return h('div', { className: 'boss-action-empty' }, h(UI.EmptyState, null, t('approvalStale')))
      }
      const stats = approvals.stats ?? {}
      const rows = (approvals.items ?? []).filter(
        (item) => item.status === 'pending' || item.status === 'approved' || item.status === 'failed',
      )
      const head = h(
        'div',
        { className: 'boss-aq-head' },
        t('approvalSummary', {
          pending: stats.pending ?? 0,
          approved: stats.approved ?? 0,
          sent: stats.sent ?? 0,
          skipped: stats.skipped ?? 0,
        }),
        notice ? h('span', { className: 'boss-ap-notice' }, notice) : null,
      )
      if (!rows.length) {
        return h('div', null, head, h('div', { className: 'boss-action-empty' }, h(UI.EmptyState, null, t('approvalEmpty'))))
      }
      // 每条是一张两行的紧凑条：左边判断依据（档位 + 公司·岗位 + 草稿首句），
      // 右边直接给按钮 —— 不点开弹窗也能通过/跳过；要看 JD/聊天再点整行。
      return h(
        'div',
        null,
        head,
        h(
          'div',
          { className: 'boss-aq-list' },
          rows.map((item) => {
            const acts =
              item.status === 'pending'
                ? [
                    h(
                      UI.Button,
                      {
                        key: 'ok',
                        variant: 'primary',
                        size: 'sm',
                        disabled: busyId === item.id,
                        onClick: (event) => {
                          event?.stopPropagation?.()
                          onDecide(item, 'approved')
                        },
                      },
                      t('approvalActApprove'),
                    ),
                    h(
                      UI.Button,
                      {
                        key: 'skip',
                        variant: 'ghost',
                        size: 'sm',
                        disabled: busyId === item.id,
                        onClick: (event) => {
                          event?.stopPropagation?.()
                          onDecide(item, 'skipped')
                        },
                      },
                      t('approvalActSkip'),
                    ),
                  ]
                : [
                    h(
                      UI.Button,
                      {
                        key: 'revoke',
                        variant: 'ghost',
                        size: 'sm',
                        disabled: busyId === item.id,
                        onClick: (event) => {
                          event?.stopPropagation?.()
                          onDecide(item, 'pending')
                        },
                      },
                      t('approvalRevoke'),
                    ),
                  ]
            return h(
              'div',
              {
                key: item.id,
                className: 'boss-aq-item',
                'data-clickable': 'true',
                'data-status': item.status,
                onClick: () => onOpen(item.id),
              },
              h(
                'div',
                { className: 'boss-aq-body' },
                h(
                  'div',
                  { className: 'boss-aq-top' },
                  h(UI.Tag, { tone: item.tier === 'A' ? 'success' : 'info' }, item.tier || 'B'),
                  item.status === 'pending'
                    ? null
                    : h(
                        UI.Tag,
                        { tone: APPROVAL_TONE[item.status] ?? 'outline' },
                        t(APPROVAL_LABEL[item.status] ?? 'approvalStatusPending'),
                      ),
                  h('span', { className: 'boss-aq-co', title: item.company }, item.company || '—'),
                  h('span', { className: 'boss-aq-job' }, item.jobTitle || ''),
                  h('span', { className: 'boss-aq-meta' }, [item.salary, item.city].filter(Boolean).join(' · ')),
                  item.threadState
                    ? h('span', { className: 'boss-aq-state' }, `${item.threadState}${item.threadTime ? ' · ' + item.threadTime : ''}`)
                    : null,
                ),
                h('div', { className: 'boss-aq-draft', title: item.draft || '' }, clip(item.draft || item.gap || '')),
              ),
              h('div', { className: 'boss-aq-acts' }, acts),
            )
          }),
        ),
      )
    }

    /** 最近发送：把已发/失败/跳过摊开，解决「发出去的看不到去向」。 */
    function SentLog({ approvals, t, onOpen }) {
      const items = (approvals?.items ?? [])
        .filter((item) => item.status === 'sent' || item.status === 'failed' || item.status === 'skipped')
        .sort((a, b) =>
          String(b.sentAt || b.decidedAt || '').localeCompare(String(a.sentAt || a.decidedAt || '')),
        )
        .slice(0, 8)
      if (!items.length) {
        return h('div', { className: 'boss-action-empty' }, h(UI.EmptyState, null, t('approvalSendLogEmpty')))
      }
      return h(
        'div',
        { className: 'boss-aq-list boss-aq-log' },
        items.map((item) =>
          h(
            'div',
            {
              key: item.id,
              className: 'boss-aq-item',
              'data-status': item.status,
              'data-clickable': 'true',
              onClick: () => onOpen?.(item.id),
            },
            h(
              'div',
              { className: 'boss-aq-body' },
              h(
                'div',
                { className: 'boss-aq-top' },
                h(
                  UI.Tag,
                  { tone: item.status === 'sent' ? 'success' : item.status === 'failed' ? 'danger' : 'outline' },
                  t(APPROVAL_LABEL[item.status] ?? 'approvalStatusPending'),
                ),
                h('span', { className: 'boss-aq-co' }, item.company || '—'),
                h('span', { className: 'boss-aq-job' }, item.jobTitle || ''),
                h('span', { className: 'boss-aq-meta' }, formatWhen(item.sentAt || item.decidedAt)),
              ),
              item.sendResult
                ? h('div', { className: 'boss-aq-draft' }, String(item.sendResult).slice(0, 120))
                : null,
            ),
          ),
        ),
      )
    }

    /**
     * 审批弹窗：点击队列行才拉全文（JD / 公司 / 完整聊天），复用 ui-kit 的 Modal。
     * 底部三个动作：通过并发送（只改状态，agent 侧 runner 轮询到 approved 才真的发）、
     * 跳过、撤回；已发送的不给回退入口。
     */
    const APPROVAL_DETAIL_CACHE = new Map()

    function ApprovalModal({ id, item, t, busy, onClose, onDecide }) {
      const cacheKey = `${id}|${item?.draftHash ?? ''}`
      const cached = APPROVAL_DETAIL_CACHE.get(cacheKey)
      const [state, setState] = React.useState(
        cached ? { loading: false, data: cached, error: null } : { loading: true, data: null, error: null },
      )

      React.useEffect(() => {
        let alive = true
        if (!cached) setState({ loading: true, data: null, error: null })
        void callHost({ op: 'approval_detail', id })
          .then((value) => {
            APPROVAL_DETAIL_CACHE.set(cacheKey, value)
            if (alive) setState({ loading: false, data: value, error: null })
          })
          .catch((error) => {
            if (alive) setState({ loading: false, data: null, error: error?.message || String(error) })
          })
        return () => {
          alive = false
        }
      }, [id])

      const data = state.data ?? item ?? {}
      const status = item?.status ?? data.status ?? 'pending'
      const kv = [
        ['job', data.jobTitle],
        ['salary', data.salary],
        ['city', data.city],
        ['recruiter', [data.recruiter, data.recruiterTitle].filter(Boolean).join(' / ')],
        ['ab', data.tier],
        ['industry', data.companyDetail?.industry],
        ['stage', data.companyDetail?.stage],
        ['scale', data.companyDetail?.scale],
        ['first', data.companyDetail?.contactedBefore],
        ['channel', data.companyDetail?.channel],
        ['note', data.companyDetail?.note],
      ].filter(([, value]) => value)
      const msgs = data.msgs ?? []

      const acts = []
      if (status === 'pending') {
        acts.push(
          h(UI.Button, { disabled: busy, onClick: () => onDecide(item, 'approved') }, t('approvalApprove')),
        )
        acts.push(
          h(UI.Button, { variant: 'outline', disabled: busy, onClick: () => onDecide(item, 'skipped') }, t('approvalSkip')),
        )
      } else if (item && status !== 'sent') {
        acts.push(
          h(UI.Button, { variant: 'outline', disabled: busy, onClick: () => onDecide(item, 'pending') }, t('approvalRevoke')),
        )
      }
      acts.push(h(UI.Button, { variant: 'ghost', onClick: onClose }, t('close')))

      return h(
        UI.Modal,
        {
          open: true,
          size: 'lg',
          title: `${data.company || ''} · ${data.jobTitle || ''}`,
          onClose,
          footer: h('div', { className: 'boss-ap-acts' }, acts),
        },
        state.loading ? h(UI.EmptyState, null, t('loading')) : null,
        state.error
          ? h('div', { className: 'boss-error' }, t('detailFailed', { message: state.error }))
          : null,
        !state.loading && !state.error
          ? h(
              React.Fragment,
              null,
              status === 'approved' && !data.sendResult
                ? h('div', { className: 'boss-ap-line' }, t('approvalQueued'))
                : null,
              h(
                'div',
                { className: 'boss-aq-badge' },
                h(UI.Tag, { tone: APPROVAL_TONE[status] ?? 'outline' }, t(APPROVAL_LABEL[status] ?? 'approvalStatusPending')),
                data.sendResult && data.sendResult.status
                  ? h(
                      'span',
                      { className: 'boss-sub' },
                      `${data.sendResult.status} · ${data.sendResult.at || ''} ${data.sendResult.detail || ''}`,
                    )
                  : null,
              ),
              kv.length
                ? h(
                    'div',
                    null,
                    kv.map(([key, value]) =>
                      h(
                        'div',
                        { key, className: 'boss-kv' },
                        h('span', { className: 'boss-kv-key' }, t(key)),
                        h('span', { className: 'boss-kv-val' }, String(value)),
                      ),
                    ),
                  )
                : null,
              data.evidence
                ? h('div', { className: 'boss-ap-line' }, h('b', null, `${t('approvalEvidence')}：`), data.evidence)
                : null,
              data.gap
                ? h('div', { className: 'boss-ap-line boss-ap-gap' }, h('b', null, `${t('approvalGap')}：`), data.gap)
                : null,
              data.draft
                ? h(
                    'div',
                    { className: 'boss-ap-draft-block' },
                    h(UI.SectionTitle, null, t('approvalDraft')),
                    h('div', { className: 'boss-ap-draft' }, data.draft),
                  )
                : null,
              h(UI.SectionTitle, { style: { marginTop: 14 } }, t('approvalChat')),
              msgs.length
                ? h(
                    'div',
                    { className: 'boss-chat' },
                    msgs.map((entry, index) =>
                      h(
                        'div',
                        { key: index, className: 'boss-cm', 'data-mine': entry.mine ? 'true' : 'false' },
                        h('span', { className: 'boss-cm-tag' }, entry.mine ? t('fromMe') : t('fromThem')),
                        entry.text,
                      ),
                    ),
                  )
                : h(
                    'div',
                    { className: 'boss-cm', 'data-mine': 'false' },
                    data.threadState ? t('approvalChatEmpty') : t('approvalChatNone'),
                  ),
              h(UI.SectionTitle, { style: { marginTop: 14 } }, t('approvalJd')),
              data.jdText
                ? h('pre', { className: 'boss-ap-jd' }, data.jdText)
                : h('div', { className: 'boss-sub' }, t('approvalNoJd')),
              data.jdUrl
                ? h(
                    'a',
                    { className: 'boss-ap-link', href: data.jdUrl, target: '_blank', rel: 'noreferrer' },
                    t('approvalOpenJd'),
                  )
                : null,
            )
          : null,
      )
    }

    /** 概览页「近期面试」：还没过去的面试，最多 4 条。 */
    function UpcomingList({ interviews, t, onOpen }) {
      const upcoming = (interviews ?? []).filter(
        (item) => item.dayDiff === null || item.dayDiff >= 0,
      )
      if (!upcoming.length) {
        return h('div', { className: 'boss-action-empty' }, h(UI.EmptyState, null, t('noUpcoming')))
      }
      return h(
        'div',
        { className: 'boss-upcoming' },
        upcoming.slice(0, 4).map((item, index) => {
          const chip = dayChip(item.dayDiff, t)
          return h(
            'div',
            {
              key: `${item.company}|${index}`,
              className: 'boss-upcoming-row',
              'data-clickable': 'true',
              onClick: () => onOpen(item.company),
            },
            h('span', { className: 'boss-chipd', 'data-tone': chip.tone }, chip.text),
            h(
              'div',
              { className: 'boss-upcoming-main' },
              h('div', { className: 'boss-co', title: item.company }, item.company || '—'),
              h('div', { className: 'boss-sub' }, item.job || item.who || '—'),
            ),
            h('span', { className: 'boss-sub' }, item.when || '—', item.dateWarning ? h('span', { className: 'boss-date-warning' }, t('dateWarning')) : null),
            h('span', { className: 'boss-sub' }, item.mode || '—'),
          )
        }),
      )
    }

    function TabBar({ tab, setTab, t }) {
      const tabs = [
        { value: 'overview', label: t('tabOverview') },
        { value: 'interviews', label: t('tabInterview') },
        { value: 'threads', label: t('tabThreads') },
      ]
      return h(UI.SegmentedTabs, { tabs, value: tab, onChange: setTab })
    }

    // -------------------------------------------------------------------------
    // 面板
    // -------------------------------------------------------------------------
    function PanelPage(props) {
      // 注入面把 `hooks` 里的每个 store 变成 `use<Key>` 形式的 hook；
      // 传选择器即可拿到快照，store 自己管轮询与停表。
      const snapshot = props.useSnapshot((value) => value)
      const t = props.t
      // props.initialTab 只给测试用：面板分 tab 渲染，单次渲染只能覆盖一个 tab，
      // 测试需要跑三遍才能断言三个区块都在（否则会误报 RENDER INCOMPLETE）。
      // 默认永远落在概览（2026-10-28 返工：审批不单开 Tab，待审批候选就嵌在概览里，
      // 免得「等着回复的」那些区块被一个空 Tab 挡住）。
      const [tab, setTab] = React.useState(() => props.initialTab ?? 'overview')
      const [query, setQuery] = React.useState('')
      const [picked, setPicked] = React.useState([])
      const [openCompany, setOpenCompany] = React.useState(null)
      const [pendingHidden, setPendingHidden] = React.useState(() => new Set())
      const [notice, setNotice] = React.useState('')
      const [approvalNotice, setApprovalNotice] = React.useState('')
      const [approvalOpen, setApprovalOpen] = React.useState(null)
      const [approvalBusy, setApprovalBusy] = React.useState(false)
      const [approvalBusyId, setApprovalBusyId] = React.useState(null)

      const data = snapshot.data
      const loading = snapshot.loading && !data
      const counts = data?.counts ?? {}
      const daily = data?.daily ?? {}
      const byState = counts.byState ?? {}

      const lowerQuery = query.trim().toLowerCase()
      const pickedSet = new Set(picked)
      const threads = (data?.threads ?? []).filter((item) => {
        if (pickedSet.size && !pickedSet.has(item.state)) return false
        if (!lowerQuery) return true
        return `${item.company} ${item.who} ${item.job} ${item.last}`.toLowerCase().includes(lowerQuery)
      })

      const togglePick = (state) => {
        setPicked((prev) =>
          prev.includes(state) ? prev.filter((item) => item !== state) : [...prev, state],
        )
      }

      const pending = data?.pending ?? []
      // 会话表里已有这条线的，把「对方状态/最近时间」补到审批行上（宿主侧也会补，
      // 但那份要重启才生效，这里前端先补一次，刷新即可看到）。
      const threadByCompany = new Map()
      for (const row of data?.threads ?? []) {
        if (row?.company) threadByCompany.set(row.company, row)
      }
      const approvalsView = data?.approvals
        ? {
            ...data.approvals,
            items: (data.approvals.items ?? []).map((item) => {
              const row = threadByCompany.get(item.company)
              if (!row) return item
              return {
                ...item,
                recruiter: item.recruiter || row.who || row.name || '',
                threadState: item.threadState || row.state || '',
                threadTime: item.threadTime || row.time || '',
              }
            }),
          }
        : null
      // 审批队列里的公司不再在「等你回复」里重复出现（两张表叠着最容易看串）。
      const approvalCompanies = new Set(
        (data?.approvals?.items ?? [])
          .filter((item) => item.status === 'pending' || item.status === 'approved')
          .map((item) => item.company),
      )
      const pendingVisible = pending.filter(
        (item) => !pendingHidden.has(item.id) && !approvalCompanies.has(item.company),
      )

      const cards = [
        { label: t('statThreads'), value: counts.threads ?? 0, kind: null },
        { label: t('statPending'), value: counts.pending ?? 0, kind: null },
        { label: t('statDecide'), value: byState['待你决定'] ?? 0, kind: 'warn' },
        {
          label: t('statInterview'),
          value: (byState['已约面试'] ?? 0) + (byState['已面试'] ?? 0),
          kind: 'success',
        },
        { label: t('statOutreach'), value: daily.todayOutreach ?? 0, kind: null },
        { label: t('statTodayThreads'), value: daily.todayThreads ?? 0, kind: null },
        { label: t('statAB'), value: `A ${daily.a ?? 0} / B ${daily.b ?? 0}`, kind: null },
      ]

      const interviews = data?.interviews ?? []
      const conflictInterviews = interviews.filter((item) => item.dateWarning)
      // 同一家公司不管从哪个列表点进来，看到的都该是同一个弹窗：
      // 有审批条目的（面板里的候选 / 已发 / 已跳过）→ 审批弹窗（JD·公司·完整聊天·状态）；
      // 没有审批条目的老会话 → 原来的公司详情弹窗。
      const open = (company) => {
        const hit = (data?.approvals?.items ?? []).find((item) => item.company === company)
        if (hit) {
          setApprovalOpen(hit.id)
          return
        }
        setOpenCompany(company)
      }

      // 队列回写：标记已发/忽略后立刻本地剔除（不等下一轮轮询），失败则提示。
      const markPending = async (id, status) => {
        try {
          await callHost({ op: 'pending_mark', id, status })
          setPendingHidden((prev) => new Set([...prev, id]))
          setNotice(t(status === 'sent' ? 'pendingMarked' : 'pendingMarked'))
          await props.refresh?.()
        } catch (error) {
          setNotice(t('pendingFailed', { message: error?.message || String(error) }))
        }
      }

      // 审批回写：只改本地状态机，不触发发送 —— 发送由 agent 侧 runner 轮询 approved 完成。
      const decideApproval = async (item, status) => {
        setApprovalBusy(true)
        setApprovalBusyId(item.id)
        try {
          await callHost({ op: 'approval_decide', id: item.id, status })
          setApprovalNotice(
            status === 'approved'
              ? t('approvalApproved')
              : status === 'skipped'
                ? t('approvalSkipped')
                : t('approvalRevoked'),
          )
          setApprovalOpen(null)
          await props.refresh?.()
        } catch (error) {
          setApprovalNotice(t('approvalFailed', { message: error?.message || String(error) }))
        } finally {
          setApprovalBusy(false)
          setApprovalBusyId(null)
        }
      }

      return h(
        'div',
        { className: 'boss-root' },
        h(StyleTag),
        h(
          'div',
          { className: 'boss-scroll' },
          h(
            'div',
            { className: 'boss-head' },
            h(
              'div',
              null,
              h('h2', { className: 'boss-title' }, t('title')),
              h('p', { className: 'boss-intro' }, t('intro')),
            ),
            h(
              'div',
              { className: 'boss-head-side' },
              h(
                'span',
                { className: 'boss-meta' },
                data?.updatedAt
                  ? t('updated', { time: humanTime(data.updatedAt, props.lang) })
                  : t('noUpdated'),
              ),
              h(
                UI.Button,
                {
                  variant: 'outline',
                  size: 'sm',
                  onClick: () => void props.refresh(),
                  disabled: snapshot.loading,
                },
                t('refresh'),
              ),
            ),
          ),

          snapshot.error
            ? h(
                'div',
                { className: 'boss-error' },
                h('span', null, t('loadFailed', { message: snapshot.error })),
                h(
                  UI.Button,
                  { variant: 'outline', size: 'sm', onClick: () => void props.refresh() },
                  t('retry'),
                ),
              )
            : null,

          conflictInterviews.length
            ? h(
                'div',
                { className: 'boss-conflict-banner', role: 'alert' },
                h('strong', null, t('conflictTitle')),
                conflictInterviews.map((item, index) =>
                  h(
                    'div',
                    { key: `${item.company}|conflict|${index}`, className: 'boss-conflict-row' },
                    `${item.company || '—'}｜${item.when || item.date || '—'}：${item.dateWarning}`,
                  ),
                ),
              )
            : null,

          !loading && data ? h(AgentAuditStrip, { audit: data.agentAudit, t }) : null,

          loading ? h(UI.EmptyState, null, t('loading')) : null,
          !loading && !data ? h(UI.EmptyState, null, t('empty')) : null,

          !loading && data ? h(TabBar, { tab, setTab, t }) : null,

          // —— 概览：仪表盘 ——
          !loading && data && tab === 'overview'
            ? h(
                'div',
                { className: 'boss-overview' },
                h(
                  'div',
                  { className: 'boss-daily' },
                  h('b', null, t('daily')),
                  '：',
                  h('b', null, t('dailyDecide', { n: daily.decide ?? 0 })),
                  daily.decideCompanies?.length
                    ? h(
                        'span',
                        { className: 'boss-meta' },
                        `（${daily.decideCompanies.join('、')}）`,
                      )
                    : null,
                  h('span', { className: 'boss-daily-sep' }, '·'),
                  h('b', null, t('dailyRead', { n: daily.readNoReply ?? 0 })),
                  h('span', { className: 'boss-daily-sep' }, '·'),
                  h(
                    'b',
                    null,
                    t('dailyOutreach', {
                      n: daily.todayOutreach ?? 0,
                      a: daily.a ?? 0,
                      b: daily.b ?? 0,
                    }),
                  ),
                  daily.todayFailed
                    ? h(
                        'span',
                        { className: 'boss-daily-sep' },
                        '·',
                      )
                    : null,
                  daily.todayFailed
                    ? h(
                        'b',
                        { className: 'boss-fail' },
                        t('dailyFailed', { n: daily.todayFailed }),
                      )
                    : null,
                  daily.failedCompanies?.length
                    ? h(
                        'span',
                        { className: 'boss-meta boss-fail' },
                        `（${daily.failedCompanies.join('、')}）`,
                      )
                    : null,
                ),
                h(
                  'div',
                  { className: 'boss-cards' },
                  cards.map((card) =>
                    h(UI.StatCard, {
                      key: card.label,
                      label: card.label,
                      value: String(card.value),
                      tone:
                        card.kind === 'warn'
                          ? 'warning'
                          : card.kind === 'error'
                            ? 'danger'
                            : card.kind === 'success'
                              ? 'success'
                              : undefined,
                    }),
                  ),
                ),
                approvalsView
                  ? h(
                      'div',
                      null,
                      h(
                        'div',
                        { className: 'boss-section' },
                        h(
                          UI.SectionTitle,
                          null,
                          `${t('approvalTitle')}（${(data.approvals.items ?? []).filter((i) => i.status !== 'sent' && i.status !== 'skipped').length}）`,
                        ),
                        h('span', { className: 'boss-section-count' }, t('approvalSub')),
                      ),
                      h(ApprovalQueue, {
                        approvals: approvalsView,
                        t,
                        onOpen: setApprovalOpen,
                        onDecide: decideApproval,
                        busyId: approvalBusy ? approvalBusyId : null,
                        notice: approvalNotice,
                      }),
                      h(
                        'div',
                        { className: 'boss-section', style: { marginTop: 18 } },
                        h(UI.SectionTitle, null, t('approvalSendLog')),
                        h('span', { className: 'boss-section-count' }, t('approvalSendLogSub')),
                      ),
                      h(SentLog, { approvals: data.approvals, t, onOpen: setApprovalOpen }),
                    )
                  : null,
                h('div', { className: 'boss-section' }, h(UI.SectionTitle, null, t('stateDist'))),
                h(StateBar, { byState, t }),
                h(
                  'div',
                  { className: 'boss-split' },
                  h(
                    'div',
                    { className: 'boss-split-col' },
                    h(
                      'div',
                      { className: 'boss-section' },
                      h(UI.SectionTitle, null, t('actionTitle')),
                      h('span', { className: 'boss-section-count' }, t('actionSub')),
                    ),
                    h(ActionRows, { threads: data.threads ?? [], t, onOpen: open }),
                  ),
                  h(
                    'div',
                    { className: 'boss-split-col' },
                    h('div', { className: 'boss-section' }, h(UI.SectionTitle, null, t('upcoming'))),
                    h(UpcomingList, { interviews, t, onOpen: open }),
                  ),
                ),
                h('div', { className: 'boss-section' }, h(UI.SectionTitle, null, t('contactsDays'))),
                h(
                  'div',
                  { className: 'boss-days', style: { marginTop: 6 } },
                  (data.recentDays ?? []).map((day) =>
                    h(
                      'span',
                      {
                        key: day.date,
                        className: 'boss-day',
                        'data-zero': day.count === 0 ? 'true' : 'false',
                        title: day.date,
                      },
                      `${shortDate(day.date)} · ${day.count}`,
                    ),
                  ),
                ),
              )
            : null,

          // —— 面试日程 ——
          !loading && data && tab === 'interviews'
            ? h(
                'div',
                null,
                h(
                  'div',
                  { className: 'boss-section' },
                  h(UI.SectionTitle, null, t('sectionInterview')),
                  h('span', { className: 'boss-section-count' }, String(interviews.length)),
                ),
                h(
                  'div',
                  { className: 'boss-table', style: { marginTop: 8 } },
                  h(
                    'div',
                    { className: 'boss-tr iv boss-th' },
                    h('span', null, t('colCompany')),
                    h('span', null, t('colState')),
                    h('span', null, t('job')),
                    h('span', null, t('colWhen')),
                    h('span', null, t('colMode')),
                    h('span', null, t('state')),
                    h('span', null, t('colNext')),
                  ),
                  interviews.length
                    ? interviews.map((item, index) =>
                        h(InterviewRow, { key: `${item.company}|${index}`, item, t, onOpen: open }),
                      )
                    : h(
                        UI.EmptyState,
                        null,
                        t('interviewEmpty'),
                        data.interviewEmptyTail ? `；${data.interviewEmptyTail}` : '',
                      ),
                ),
              )
            : null,

          // —— 会话列表 ——
          !loading && data && tab === 'threads'
            ? h(
                React.Fragment,
                null,
                h(
                  'div',
                  { className: 'boss-section' },
                  h(UI.SectionTitle, null, t('sectionThreads')),
                  h(
                    'span',
                    { className: 'boss-section-count' },
                    `${threads.length} / ${counts.threads ?? 0}`,
                  ),
                  h('div', { className: 'boss-section-hint' }, t('threadsHint')),
                ),
                h(
                  'div',
                  { className: 'boss-toolbar' },
                  h(UI.SearchInput, {
                    value: query,
                    onChange: setQuery,
                    placeholder: t('search'),
                  }),
                  h(
                    UI.Pill,
                    { active: picked.length === 0, onClick: () => setPicked([]) },
                    t('filterAll'),
                    h('span', null, String(counts.threads ?? 0)),
                  ),
                ),
                h(
                  'div',
                  { className: 'boss-chips' },
                  ORDER.map((state) =>
                    h(
                      UI.Pill,
                      {
                        key: state,
                        active: pickedSet.has(state),
                        onClick: () => togglePick(state),
                      },
                      state,
                      h('span', null, String(byState[state] ?? 0)),
                    ),
                  ),
                ),
                h(
                  'div',
                  { className: 'boss-table' },
                  h(ThreadHead, { t }),
                  threads.length
                    ? threads.map((item, index) =>
                        h(ThreadRow, {
                          key: `${item.company}|${item.who}|${index}`,
                          item,
                          t,
                          onOpen: setOpenCompany,
                        }),
                      )
                    : h(UI.EmptyState, null, t('noMatch')),
                ),
              )
            : null,
        ),

        openCompany
          ? h(DetailModal, { company: openCompany, onClose: () => setOpenCompany(null), t })
          : null,

        // 审批弹窗：队列行点开才有，详情（JD/公司/完整聊天）在这时才拉。
        approvalOpen
          ? h(ApprovalModal, {
              id: approvalOpen,
              item: (data?.approvals?.items ?? []).find((item) => item.id === approvalOpen),
              t,
              busy: approvalBusy,
              onClose: () => setApprovalOpen(null),
              onDecide: decideApproval,
            })
          : null,
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const localeApi = ctx.locale
        const t = localeApi.bind(NS)
        ctx.effect(() => localeApi.register(NS, { zh, en }), 'boss-panel: dictionaries')

        const readLang = () => {
          try {
            const snapshot =
              typeof localeApi.getSnapshot === 'function' ? localeApi.getSnapshot() : null
            const id = snapshot && (snapshot.locale ?? snapshot.id ?? snapshot.current)
            return typeof id === 'string' && id.toLowerCase().startsWith('en') ? 'en' : 'zh'
          } catch {
            return 'zh'
          }
        }

        const store = createSnapshotStore()
        ctx.effect(() => () => store.dispose(), 'boss-panel: snapshot store')

        const face = () => ({
          lang: readLang(),
          hooks: { snapshot: store },
          refresh: store.refresh,
        })

        // 侧边栏条目：图标行里的「招聘」。order 负数排到最上面，
        // 也就是「新会话」按钮下面的第一个图标。
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: -10,
              locale: NS,
              label: () => t('panel'),
            },
            PanelIcon,
          ),
        )

        // 中央面板：key 必须等于侧边栏条目的 id。
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
              inject: face,
            },
            PanelPage,
          ),
        )
      },
    }
  },
})

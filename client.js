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
      intro: '今天要办的事：谁在等我回、今天该发谁、发出去的有没有人回。',
      refresh: '刷新',
      loading: '加载中…',
      empty: '还没读到快照 —— 点右上「刷新」；还是空就说明后台采集没在跑',
      updated: '快照 {time}',
      noUpdated: '尚无快照',
      daily: '今日简报',
      dailyDecide: '待你决定 {n} 个',
      dailyOutreach: '今日已发首触 {n} 条（A {a} / B {b}）',
      statThreads: '会话',
      statDecide: '待你决定',
      statRead: '已读未回',
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
      filterWait: '只看等我回',
      filterAll: '全部',
      noMatch: '没有匹配的会话 —— 换个关键词，或点「全部」清掉筛选',
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
      first: '首触时间',
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
      tabToday: '今天',
      tabAll: '全部会话',
      kpiToday: '今天发出',
      kpiWait: '等我回',
      kpiReplied: '有人回',
      kpiTbd: '面试待定 {n}',
      todayInterview: '今天面试',
      interviewTbdChip: '待定',
      failedTitle: '{n} 条发送失败',
      resend: '重新发出',
      approvalCounts: '首触 {total} 家 · 待你定 {todo} · 已发出 {sent} · 不发 {skipped}',
      approvalMore: '还有 {n} 条待决定',
      approvalAllDone: '今天的候选都处理完了 —— 没有等你决定的草稿',
      kpiRepliedHint: '今天发出的 {n} 条里，对方已经回了',
      kpiInterview: '面试',
      waitTitle: '等我回',
      waitSub: '对方最后一句在等你，回完这条就翻篇',
      waitEmpty: '现在没有等我回的消息 —— 都回完了',
      goReply: '去回复',
      consentNeeded: '待同意发简历',
      goReplyHint: '新标签打开 BOSS 聊天，公司名已复制到剪贴板',
      sentNone: '暂无回复',
      sentTitleNone: '已发出',
      kpiFailed: '发送失败',
      sentTitle: '已发出',
      sentLine: '已发出 {n} 条 · 待回 {wait} · 最后 {time}',
      sentLineMissing: '已发出 {n} 条 · 待回 {wait} · 未进会话 {missing} · 最后 {time}',
      sentLineRead: '{read} 条已读 · {unread} 条未读（对方还没打开）',
      readYes: '已读',
      readNo: '未读',
      daysAgo: '{n} 天前',
      tierUnknown: '未评级',
      allLink: '全部 {n} 个会话 →',
      tabInterview: '面试',
      tabThreads: '会话',
      stateDist: '状态分布',
      recentDaysTitle: '近 14 天首触',
      recentDaysSub: '按本地日历日去重，已发首触（含面板审批发出的），单位：家/天',
      interviewTbd: '另有 {n} 场待定（日期未定）',
      interviewClosed: '已取消 {a} 场 · 已完成 {b} 场',
      interviewNone: '近期没有面试',
      threadsCount: '{rows} 个会话 · {companies} 家公司',
      actionTitle: '需要行动',
      actionSub: '要你拍板的事',
      actionEmpty: '当前没有需要立即处理的事',
      pendingSub: 'AI 判不准、没敢自动发',
      pendingEmpty: '队列是空的 —— 没有卡在人工这一环的草稿',
      pendingSent: '已发',
      pendingDrop: '忽略',
      pendingMarked: '已标记',
      pendingFailed: '标记失败：{message}',
      statApproval: '待审批',
      approvalTitle: '待发首触',
      notCollected: '未采集',
      coverageLine: '资料 {filled}/{total} · 缺：{missing}',
      coverageComplete: '无',
      field_jd: 'JD 正文',
      field_salary: '薪资',
      field_city: '城市',
      field_jobId: '岗位链接',
      field_recruiter: '对接人',
      field_tier: '匹配档位',
      approvalSub: '点「发出这条」= 10 分钟内自动发给对方，发出后不能收回；点「不发」= 永久移出，之后可点「收回」找回',
      approvalEmpty: '今天的首触都处理完了 —— 没有等你决定的草稿',
      approvalStale: '面板比后台旧，读不到待发数据 —— 重启一次 DSH 就会显示',
      approvalSendLog: '最近发送',
      approvalSendLogSub: '最近 8 条，带送达状态；点开看聊天和 JD',
      threadMissing: '会话未建立',
      threadMissingHint: '发出去了，但会话列表里还没有这家 —— 对方可能还没点开，或消息被折叠',
      approvalSendLogEmpty: '还没有发出记录',
      approvalActApprove: '发送',
      approvalActSkip: '不发',
      approvalChatNone: '这个岗位还没开聊；点「发出这条」后会自动打招呼',
      approvalNoJd: 'JD 没有存档，点下面的原链接看岗位页',
      approvalApprove: '发送',
      approvalSendHint: '10 分钟内自动发出；发出后不能收回',
      approvalFactBlocked: '上次被事实闸门拦下，文案已改写',
      approvalSkip: '不发',
      approvalRevoke: '收回',
      approvalApproved: '已通过，agent 发送时会回写结果',
      approvalSkipped: '不发',
      approvalRevoked: '已收回，回到待发',
      approvalQueued: '已排上，10 分钟内用这条草稿发出；发出后这里会变成「已发出」',
      replyNeeded: '等我回',
      threadsHint: '「等我回」= 对方最后一句还没回；其余是等对方或已结束。点任意一行看完整聊天。',
      approvalFailed: '操作失败：{message}',
      approvalStaleDraft: '这条草稿在你查看后改过 —— 重新打开看一眼再发',
      approvalPeekFirst: '先打开这一条看一眼 JD 和草稿，再点发送',
      approvalGone: '这条已经不在待发队列里了（可能刚被发出或队列被重写），已刷新',
      approvalsCorrupt: '待发清单暂时读不出来（可能正在写入）—— 下面的列表不是最新状态，稍等会自动恢复',
      runnerStale: '后台发送器已经 {n} 分钟没动静了 —— 面板上点「发出」不会真的发出去，检查 dsh 的 boss-approval-send 任务',
      hardGateChip: 'JD 硬门槛',
      approvalStuck: '有 {n} 条已排上、超过 20 分钟没发出 —— 后台发送任务可能停了（boss-approval-send）',
      chatOlder: '上面还有 {n} 条更早的聊天，这里只显示最近 30 条',
      hardGateWarn: 'JD 写明了硬性条件，先确认你够得上再发',
      approvalStatusPending: '待决定',
      approvalStatusApproved: '待发出',
      approvalStatusSent: '已发出',
      approvalStatusSkipped: '不发',
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
      empty: 'No snapshot yet — hit Refresh; if still empty the collector is not running',
      updated: 'Snapshot {time}',
      noUpdated: 'No snapshot yet',
      daily: 'Today',
      dailyDecide: 'Decisions waiting: {n}',
      dailyOutreach: 'First touches sent today: {n} (A {a} / B {b})',
      statThreads: 'Threads',
      statDecide: 'To decide',
      statRead: 'Read, no reply',
      statInterview: 'Scheduled/done',
      statOutreach: 'Today outreach',
      statTodayThreads: 'Threads today',
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
      filterWait: 'Waiting on me',
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
      tabToday: 'Today',
      tabAll: 'All threads',
      kpiToday: 'Sent today',
      kpiWait: 'Waiting on me',
      kpiReplied: 'Replied',
      kpiRepliedHint: '{n} of your sent messages got a reply',
      kpiInterview: 'Interviews',
      waitTitle: 'Waiting on my reply',
      waitSub: 'Their last message is waiting; reply and it clears',
      waitEmpty: 'Nothing waiting on you right now',
      goReply: 'Reply',
      consentNeeded: 'Resume consent pending',
      goReplyHint: 'Opens BOSS chat in a new tab, company name copied',
      sentNone: 'No replies yet',
      sentTitleNone: 'Sent — no replies yet',
      kpiFailed: 'Failed',
      sentTitle: 'Sent, awaiting reply',
      sentLine: '{n} sent · {wait} waiting · last {time}',
      sentLineMissing: '{n} sent · {wait} waiting · no thread {missing} · last {time}',
      sentLineRead: '{read} read · {unread} unread (not opened yet)',
      readYes: 'read',
      readNo: 'unread',
      daysAgo: '{n} days ago',
      tierUnknown: 'Unrated',
      allLink: 'All {n} threads →',
      tabInterview: 'Interviews',
      tabThreads: 'Threads',
      stateDist: 'Status mix',
      actionTitle: 'Needs action',
      actionSub: 'Decide / read-no-reply',
      actionEmpty: 'Nothing needs attention right now',
      pendingSub: 'Low-confidence drafts held back',
      pendingEmpty: 'Queue is empty — no draft stuck on a human decision',
      pendingSent: 'Sent',
      pendingDrop: 'Ignore',
      pendingMarked: 'Marked',
      pendingFailed: 'Mark failed: {message}',
      statApproval: 'To approve',
      approvalTitle: 'First touches to send',
      notCollected: 'not collected',
      coverageLine: 'Data {filled}/{total} · missing: {missing}',
      coverageComplete: '(complete)',
      field_jd: 'JD text',
      field_salary: 'Salary',
      field_city: 'City',
      field_jobId: 'Job link',
      field_recruiter: 'Recruiter',
      field_tier: 'Match tier',
      approvalSub: 'Send = deliver this draft (within 10 min, cannot be undone); Skip = gone for good, revocable',
      approvalEmpty: 'Nothing to approve — every candidate is handled',
      approvalStale: 'Host has not loaded approval data yet — restart DSH once to activate this tab',
      approvalSendLog: 'Recently sent',
      approvalSendLogSub: 'Last 8, with delivery status; open one for chat and JD',
      threadMissing: 'No thread',
      threadMissingHint: 'Sent, but no chat row yet — the recruiter may not have opened it',
      approvalSendLogEmpty: 'Nothing sent yet',
      approvalActApprove: 'Send',
      approvalActSkip: 'Discard',
      approvalChatNone: 'No thread yet — sending will open the conversation',
      approvalNoJd: 'No archived JD — open the original posting below',
      approvalApprove: 'Send',
      approvalSendHint: 'Sent in background within 10 min; cannot be undone',
      approvalFactBlocked: 'Blocked by fact gate last time; draft rewritten',
      approvalSkip: 'Skip',
      approvalRevoke: 'Undo',
      approvalApproved: 'Approved; the agent writes back the result',
      approvalSkipped: 'Skipped',
      approvalRevoked: 'Back to waiting',
      approvalFailed: 'Action failed: {message}',
      approvalStaleDraft: 'This draft changed after you opened it — reopen and confirm',
      approvalPeekFirst: 'Open this item first, then hit send',
      approvalGone: 'This item is no longer in the queue — refreshed',
      approvalsCorrupt: 'The approvals file is unreadable right now (likely being written) — the queue below is not authoritative',
      runnerStale: 'The background sender has been idle for {n} min — approving here will not send; check the boss-approval-send task',
      hardGateChip: 'JD hard gate',
      approvalStuck: '{n} approved over 20 minutes ago but not sent — the background sender may be down',
      chatOlder: '{n} earlier messages are hidden — showing the latest 30',
      hardGateWarn: 'The JD states a hard requirement — confirm you qualify before sending',
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
            if (value && value.unchanged && !state.error) {
              // 引用不变：订阅者拿到同一个 state，React 可以直接跳过重渲染（工程评审 #9）。
              // 之前每 15 秒都换一个新对象，等于白白重建 800 行。
              inflight = null
              return
            } else if (value && value.unchanged) {
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
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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
      .boss-daily { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 8px; padding: 12px 16px; font-size: 13px; line-height: 20px; }
      .boss-daily b { font-variant-numeric: tabular-nums; }
      .boss-daily-sep { color: var(--dsw-alias-label-secondary); margin: 0 6px; }
      .boss-fail { color: var(--dsw-alias-state-error-primary); font-weight: 600; }
      .boss-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
      .boss-section { display: flex; flex-direction: column; align-items: stretch; gap: 6px; margin: 10px 0 0; }
      .boss-section > .boss-section-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
      .boss-section-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
      .boss-section-count { font-size: 12px; font-weight: 400; color: var(--dsw-alias-label-secondary); }
      .boss-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .boss-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .boss-table { border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; overflow-x: auto; background: var(--dsw-alias-bg-layer-1); }
      .boss-tr { display: grid; gap: 10px; align-items: start; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .boss-tr:last-child { border-bottom: none; }
      .boss-tr[data-clickable="true"] { cursor: pointer; }
      .boss-tr[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      [data-clickable="true"]:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; border-radius: 6px; }
      .boss-th { font-size: 12px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); font-weight: 500; }
      .boss-tr.threads { grid-template-columns: 64px minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.4fr) 72px; }
      /* 480px 面板：最后一列（下一步）整列消失且没有滚动条 —— 收窄并隐藏它 */
      @media (max-width: 520px) {
        .boss-tr.threads { grid-template-columns: 56px minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.4fr); }
        .boss-nx { display: none; }
      }
      .boss-tr.iv { grid-template-columns: minmax(120px, 1.2fr) 84px 84px minmax(110px, 1fr) 70px minmax(90px, .9fr) minmax(110px, 1fr); }
      .boss-co { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .boss-sub { font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .boss-line { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
      .boss-tx { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
      .boss-nx { font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .boss-sal { display: inline-block; margin-left: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .boss-chipd { display: inline-block; padding: 0 7px; border-radius: 9px; font-size: 11px; line-height: 16px; border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .boss-chipd[data-tone="hot"] { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); font-weight: 600; }
      .boss-chipd[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); background: var(--dsw-alias-bg-layer-2); font-weight: 600; }
      .boss-chipd[data-tone="ok"] { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); background: var(--dsw-alias-bg-layer-2); }
      /* 不再用 opacity 弱化：叠在浅色底上只剩 2.3:1，过期面试会被当成待办（a11y 评审 #7）。 */
.boss-chipd[data-tone="past"], .boss-chipd[data-tone="tbd"] { border-style: dashed; color: var(--dsw-alias-label-secondary); }
      .boss-date-warning { display: block; margin-top: 2px; color: var(--dsw-alias-state-warn-primary); font-size: 12px; line-height: 18px; font-weight: 600; }
      .boss-conflict-banner { border: 1px solid var(--dsw-alias-state-warn-primary); border-left-width: 3px; border-radius: 10px; padding: 11px 14px; color: var(--dsw-alias-state-warn-primary); background: var(--dsw-alias-bg-layer-1); font-size: 12px; line-height: 18px; }
      .boss-conflict-banner strong { display: block; margin-bottom: 3px; font-size: 13px; }
      .boss-conflict-row { color: var(--dsw-alias-label-primary); }
      .boss-audit { border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 8px 12px; background: var(--dsw-alias-bg-layer-1); display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 12px; line-height: 18px; }
      .boss-audit-title { font-weight: 600; margin-right: 2px; }
      .boss-audit-note { color: var(--dsw-alias-label-secondary); }
      .boss-track { display: inline-block; margin-top: 4px; padding: 0 6px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 17px; }
      .boss-error { border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 10px; padding: 10px 14px; font-size: 12px; color: var(--dsw-alias-state-error-primary); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .boss-days { display: flex; gap: 4px; flex-wrap: wrap; }
      .boss-day { border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; padding: 2px 8px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .boss-day[data-zero="false"] { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
      .boss-kv-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0 24px; }
      .boss-kv { display: flex; gap: 8px; font-size: 13px; line-height: 20px; }
      .boss-kv-key { flex: 0 0 64px; color: var(--dsw-alias-label-secondary); }
      .boss-kv-val { flex: 1 1 auto; min-width: 0; word-break: break-word; }
      .boss-chat { margin-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; max-height: 24vh; overflow: auto; }
      .boss-cm { font-size: 13px; line-height: 20px; padding: 6px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); word-break: break-word; }
      .boss-cm[data-mine="true"] { margin-left: 32px; border-left: 2px solid var(--dsw-alias-brand-primary); }
      .boss-cm[data-mine="false"] { margin-right: 32px; }
      .boss-cm-tag { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-right: 6px; }

      /* —— 审批队列（概览内嵌）与审批弹窗 —— */
      .boss-aq-head { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); margin: 4px 0 8px; display: flex; gap: 10px; flex-wrap: wrap; }
      .boss-aq-tags { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
      .boss-aq-badge { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }

      /* 待审批条 + 最近发送：一个容器、每行两栏（依据 / 动作），不用表格以免和「等你回复」看串 */
      .boss-section-hint { margin: 0 0 2px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
      .boss-aq-list { display: flex; flex-direction: column; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
      .boss-aq-item { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .boss-aq-item:last-child { border-bottom: 0; }
      .boss-aq-item[data-clickable="true"] { cursor: pointer; }
      .boss-aq-item[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-aq-item[data-status="approved"] { box-shadow: inset 2px 0 0 var(--dsw-alias-state-success-primary); }
      .boss-aq-item[data-status="failed"] { box-shadow: inset 2px 0 0 var(--dsw-alias-state-error-primary); }
      .boss-aq-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .boss-aq-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; min-width: 0; }
      .boss-aq-co { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .boss-aq-job { font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .boss-aq-meta { font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .boss-aq-state { font-size: 12px; color: var(--dsw-alias-label-secondary); padding-left: 8px; border-left: 1px solid var(--dsw-alias-border-l2); }
      .boss-aq-draft { font-size: 12px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
      .boss-aq-acts { display: flex; align-items: center; gap: 6px; flex: none; }
      .boss-aq-log .boss-aq-item { padding: 8px 12px; }
      .boss-ap-notice { color: var(--dsw-alias-brand-primary); }
      .boss-ap-line { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
      .boss-ap-line b { color: var(--dsw-alias-label-primary); font-weight: 500; }
      .boss-ap-gap { color: var(--dsw-alias-state-warn-primary); }
      .boss-ap-result { color: var(--dsw-alias-state-error-primary); }
      .boss-ap-draft-block { margin-top: 10px; }
      .boss-ap-draft { font-size: 13px; line-height: 20px; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); white-space: pre-wrap; word-break: break-word; }
      .boss-ap-acts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .boss-ap-skip { color: var(--dsw-alias-state-error-primary); }
      .boss-ap-jd-p { margin: 0 0 8px; }
      .boss-ap-jd-p:last-child { margin-bottom: 0; }
      .boss-ap-jd { margin: 0; font-size: 13px; line-height: 20px; tab-size: 4; white-space: pre-wrap; word-break: break-word; max-height: 24vh; overflow: auto; background: var(--dsw-alias-bg-layer-2); border-radius: 8px; padding: 10px 12px; }
      .boss-ap-link { font-size: 12px; color: var(--dsw-alias-brand-primary); text-decoration: none; }

      /* —— 今天：一行数字 + 等我回 + 待发 + 已发折叠 —— */
      .boss-today { display: flex; flex-direction: column; gap: 14px; }
      .boss-kpi { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .boss-kpi-item { display: inline-flex; align-items: baseline; gap: 5px; }
      button.boss-kpi-item { appearance: none; border: 0; background: none; padding: 0; font: inherit; color: inherit; cursor: pointer; border-radius: 4px; }
      button.boss-kpi-item:hover { color: var(--dsw-alias-brand-primary); }
      button.boss-kpi-item:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
      .boss-kpi-sub { font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .boss-kpi-bad b { color: var(--dsw-alias-label-danger); }
      .boss-degraded { margin: 8px 0 2px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .boss-today-interview { margin: 10px 0 2px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); font-size: 13px; }
      .boss-section-head { display: flex; align-items: baseline; gap: 8px; }
      .boss-fail-rows { margin-top: 10px; border: 1px solid var(--dsw-alias-label-danger); border-radius: 8px; padding: 8px 12px; }
      .boss-fail-title { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-danger); margin-bottom: 6px; }
      .boss-fail-row { display: grid; grid-template-columns: minmax(0, 1.2fr) auto minmax(0, 1.6fr) auto; gap: 8px; align-items: center; font-size: 13px; padding: 4px 0; }
      .boss-fail-why { color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .boss-aq-more { padding: 8px 0 0; }
      .boss-ap-coverage { margin: 6px 0 8px; padding: 4px 8px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .boss-wait-consent { display: inline-block; margin-top: 4px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--dsw-alias-label-warning); color: var(--dsw-alias-label-warning); font-size: 12px; }
      .boss-upcoming-tbd .boss-upcoming-row { opacity: .95; }
      .boss-kpi-item b { font-size: 16px; font-weight: 600; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }
      .boss-kpi-sep { color: var(--dsw-alias-label-tertiary); }
      .boss-more { padding-top: 2px; }
      .boss-wait { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
      .boss-wait-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .boss-wait-row:last-child { border-bottom: none; }
      .boss-wait-row[data-clickable="true"] { cursor: pointer; }
      .boss-wait-row[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-wait-main { min-width: 0; }
      .boss-wait-who { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
      .boss-wait-who > * { flex: none; }
      .boss-wait-who > .boss-co { flex: 1 1 auto; }
      .boss-wait-msg { margin-top: 3px; font-size: 13px; line-height: 18px; color: var(--dsw-alias-label-primary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .boss-sent-line { display: flex; align-items: baseline; gap: 8px; padding: 8px 2px; cursor: pointer; border-radius: 6px; min-width: 0; }
      .boss-sent-line:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-sent-title { font-size: 13px; font-weight: 500; color: var(--dsw-alias-label-primary); flex: 0 0 auto; }
      .boss-sent-meta { font-size: 12px; color: var(--dsw-alias-label-secondary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .boss-sent-toggle { margin-left: auto; font-size: 11px; color: var(--dsw-alias-label-secondary); }
      .boss-ap-foot-hint { font-size: 12px; color: var(--dsw-alias-label-secondary); }

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
      .boss-dist-item { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary); }
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

    // 可点击行统一走这里：Tab 可达 + Enter/Space + 动作词明确的 label，别只给鼠标用户用。
    // 用 role=group 而不是 button：行里本来就有真按钮（「去回」「发送」），
    // button 套 button 会让 VoiceOver 把内层念成外层的子项（a11y 评审 #18）。
    const clickProps = (onActivate, label) => ({
      'data-clickable': 'true',
      role: 'group',
      tabIndex: 0,
      'aria-label': label,
      onClick: onActivate,
      onKeyDown: (event) => {
        // 行里有真按钮（「去回」「发送」「重发」）：焦点在它们身上时把 Enter 让给原生激活，
        // 否则行 handler 会 preventDefault 吞掉点击并弹出详情（工程评审 #10）。
        if (event && event.target && event.target !== event.currentTarget) return
        if (event && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault?.()
          onActivate?.()
        }
      },
    })

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
      const chatRef = React.useRef(null)
      React.useEffect(() => {
        const el = chatRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, [msgs.length])
      const shownMsgs = msgs.slice(-30)
      const olderCount = msgs.length - shownMsgs.length

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
          ...clickProps(() => onOpen(item.company), `${item.company} ${item.who || ''} 打开详情`),
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
                item.track
                  ? h(
                      'span',
                      {
                        className: 'boss-track',
                        tabIndex: 0,
                        title: item.track.evidence,
                        'aria-label': `${item.track.label}：${item.track.evidence || ''}`,
                      },
                      item.track.label,
                    )
                  : null,
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
        { className: 'boss-audit', role: 'group', 'aria-label': t('agentGuard') },
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

    function ApprovalQueue({ approvals, t, onOpen, onDecide, busyId, notice, limit = 0 }) {
      // 旧宿主（index.js 未重载）的快照里没有 approvals 字段：说清楚，别让人以为是空池。
      if (!approvals) {
        return h('div', { className: 'boss-action-empty' }, h(UI.EmptyState, null, t('approvalStale')))
      }
      // 失败条目单独一列（带「重新发送」），不再混进待决定的队列里冒充「还要我点」。
      const all = (approvals.items ?? []).filter(
        (item) => item.status === 'pending' || item.status === 'approved',
      )
      const rows = limit > 0 ? all.slice(0, limit) : all
      const rest = all.length - rows.length
      const head = notice ? h('div', { className: 'boss-aq-head' }, h('span', { className: 'boss-ap-notice' }, notice)) : null
      if (!all.length) return null
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
                'data-status': item.status,
                ...clickProps(() => onOpen(item.id), `${item.company} ${item.jobTitle || ''} 打开审批详情`),
              },
              h(
                'div',
                { className: 'boss-aq-body' },
                h(
                  'div',
                  { className: 'boss-aq-top' },
                  h(UI.Tag, { tone: item.tier === 'A' ? 'success' : 'info' }, item.tier || t('tierUnknown')),
                  item.status === 'pending'
                    ? null
                    : h(
                        UI.Tag,
                        { tone: APPROVAL_TONE[item.status] ?? 'outline' },
                        t(APPROVAL_LABEL[item.status] ?? 'approvalStatusPending'),
                      ),
                  h('span', { className: 'boss-aq-co', title: item.company }, item.company || '—'),
                  h('span', { className: 'boss-aq-job' }, item.jobTitle || ''),
                  item.status === 'pending' && item.sendResult?.status === 'fact_blocked'
                    ? h(UI.Tag, { tone: 'warning' }, t('approvalFactBlocked'))
                    : h('span', { className: 'boss-aq-meta' }, [item.salary, item.city].filter(Boolean).join(' · ')),
                  item.threadState
                    ? h('span', { className: 'boss-aq-state' }, `${item.threadState}${item.threadTime ? ' · ' + item.threadTime : ''}`)
                    : null,
                  // JD 里有「必须有卡牌实战」这类一票否决时，在点之前就摆出来。
                  item.hardGate
                    ? h('span', { className: 'boss-aq-gate', title: item.hardGate }, t('hardGateChip'))
                    : null,
                ),
                item.hardGate
                  ? h('div', { className: 'boss-aq-gate-text' }, `${t('hardGateWarn')}：${item.hardGate}`)
                  : null,
                h('div', { className: 'boss-aq-draft', title: item.draft || '' }, clip(item.draft || item.gap || '')),
              ),
              h('div', { className: 'boss-aq-acts' }, acts),
            )
          }),
        ),
        rest > 0
          ? h(
              'div',
              { className: 'boss-aq-more' },
              h(
                UI.Button,
                { variant: 'ghost', size: 'sm', onClick: () => setTab('threads') },
                t('approvalMore', { n: rest }),
              ),
            )
          : null,
      )
    }

    /** JD 按空行切段，读屏能一段段跳，低视力用户不会被一整块 12px 长文砸（a11y 评审 #11）。 */

    /** JD 按空行切段，读屏能一段段跳，低视力用户不会被一整块 12px 长文砸（a11y 评审 #11）。 */
    function jdParagraphs(text) {
      return String(text || '')
        .split(/\n\s*\n+/)
        .map((x) => x.trim())
        .filter(Boolean)
    }

    /** 最近发送：把已发/失败/跳过摊开，解决「发出去的看不到去向」。 */
    /**
     * 「等我回」：只放球在我这边的会话（对方最后一句、状态是待回复/待你决定）。
     * 首屏第一块，因为这是唯一需要用户动手的地方。
     */
    function WaitRows({ items, t, onOpen }) {
      if (!items.length) {
        return h('div', { className: 'boss-action-empty' }, h(UI.EmptyState, null, t('waitEmpty')))
      }
      return h(
        'div',
        { className: 'boss-wait' },
        items.map((item) => {
          const key = `${item.company}|${item.who}`
          return h(
            'div',
            {
              key,
              className: 'boss-wait-row',
              ...clickProps(() => onOpen(item.company), `${item.company} ${item.who || ''} 打开详情`),
            },
            h(
              'div',
              { className: 'boss-wait-main' },
              h(
                'div',
                { className: 'boss-wait-who' },
                h('span', { className: 'boss-co' }, item.company || '—'),
                h('span', { className: 'boss-aq-meta' }, item.who || ''),
                item.job ? h('span', { className: 'boss-aq-job' }, item.job) : null,
                item.salary ? h('span', { className: 'boss-sal' }, item.salary) : null,
              ),
              h('div', { className: 'boss-wait-msg' }, item.last || '—'),
              item.consent
                ? h('span', { className: 'boss-wait-consent' }, t('consentNeeded'))
                : null,
              h(
                'div',
                { className: 'boss-aq-meta' },
                [item.days === 0 ? t('today') : item.days != null ? t('daysAgo', { n: item.days }) : '']
                  .filter(Boolean)
                  .join(' · '),
              ),
            ),
            h(
              UI.Button,
              {
                variant: 'primary',
                size: 'sm',
                title: t('goReplyHint'),
                onClick: (event) => {
                  event?.stopPropagation?.()
                  openBossChat(item.company)
                },
              },
              t('goReply'),
            ),
          )
        }),
      )
    }

    /**
     * 「发出去了，等回复」：默认只占一行，点开才展开最近 8 条。
     * 之前整块摊在首屏，400px 全是历史，把真正要回的消息挤到折叠线以下。
     */
    function SentSummary({ approvals, t, onOpen }) {
      const [expanded, setExpanded] = React.useState(false)
      // 只算真发出去的：skipped 是「不发」，把它算进「等回复」会让用户以为球在对方手上（审计 #4）。
      const items = (approvals?.items ?? []).filter((item) => item.status === 'sent')
      if (!items.length) return null
      const waiting = items.filter((item) => item.threadState === '等对方').length
      const replied = items.filter((item) => item.threadFrom === '对方').length
      const sorted = [...items].sort((a, b) =>
        String(b.sentAt || b.decidedAt || '').localeCompare(String(a.sentAt || a.decidedAt || '')),
      )
      const last = formatWhen(sorted[0]?.sentAt || sorted[0]?.decidedAt)
      const missing = items.filter((item) => !item.threadState).length
      const headline = missing
        ? t('sentLineMissing', { n: items.length, wait: waiting, missing, time: last })
        : t('sentLine', { n: items.length, wait: waiting, time: last })
      return h(
        'div',
        { className: 'boss-section' },
        h(
          'div',
          {
            className: 'boss-sent-line',
            'aria-expanded': expanded ? 'true' : 'false',
            ...clickProps(() => setExpanded((v) => !v), t('sentTitle')),
          },
          h(
            'span',
            { className: 'boss-sent-title' },
            replied ? t('sentTitle') : t('sentTitleNone'),
          ),
          (() => {
            const known = items.filter((item) => item.readState === 'read' || item.readState === 'delivered')
            if (!known.length) return null
            const read = known.filter((item) => item.readState === 'read').length
            return h(
              'span',
              { className: 'boss-sent-meta' },
              t('sentLineRead', { read, unread: known.length - read }),
            )
          })(),
          h(
            'span',
            { className: 'boss-sent-meta' },
            headline,
          ),
          h('span', { className: 'boss-sent-toggle' }, expanded ? '▾' : '▸'),
        ),
        expanded ? h(SentLog, { approvals, t, onOpen }) : null,
      )
    }

    // sendResult 可能是 {status, ok, detail, tail, fit} 对象，直接 String() 会渲染成 [object Object]。
    const sendText = (item) => {
      const r = item?.sendResult
      if (!r) return ''
      if (typeof r === 'string') return r
      const parts = [r.status, r.at, r.tail, r.detail, r.fit].filter((x) => typeof x === 'string' && x)
      // sent 但 tail 为空 = 发出去了但没拿到送达回执，别装作送达了（审计 #6）。
      if (item?.status === 'sent' && !r.tail) parts.push('送达未复核')
      return parts.join(' · ')
    }

    function SentLog({ approvals, t, onOpen }) {
      const items = (approvals?.items ?? [])
        // 失败的要留（用户要看到哪条没发出去），「跳过」的留着只会冒充已发。
        .filter((item) => item.status === 'sent' || item.status === 'failed')
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
              ...clickProps(() => onOpen?.(item.id), `${item.company} ${item.jobTitle || ''} 打开审批详情`),
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
                h('span', { className: 'boss-aq-meta' }, humanTime(item.sentAt || item.decidedAt)),
                item.status === 'sent'
                  ? h(
                      UI.Tag,
                      { tone: item.readState === 'read' ? 'success' : 'outline' },
                      item.readState === 'read' ? t('readYes') : t('readNo'),
                    )
                  : null,
                item.threadState
                  ? null
                  : h(UI.Tag, { tone: 'warn', title: t('threadMissingHint') }, t('threadMissing')),
              ),
              sendText(item)
                ? h('div', { className: 'boss-aq-draft' }, sendText(item).slice(0, 120))
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
            if (APPROVAL_DETAIL_CACHE.size > 8) {
              const oldest = APPROVAL_DETAIL_CACHE.keys().next().value
              if (oldest !== cacheKey) APPROVAL_DETAIL_CACHE.delete(oldest)
            }
            if (alive) setState({ loading: false, data: value, error: null })
          })
          .catch((error) => {
            if (alive) setState({ loading: false, data: null, error: error?.message || String(error) })
          })
        return () => {
          alive = false
        }
      }, [id, cacheKey])

      const data = state.data ?? item ?? {}
      const status = item?.status ?? data.status ?? 'pending'
      // 字段固定、空值写「未采集」：不允许有的条目少一行、有的条目多一行，
      // 用户看到的每个空格都应该是一个明确的「没采到」，而不是让人猜。
      const MISSING = t('notCollected')
      const orMissing = (value) => (value ? String(value) : MISSING)
      const companyLine = [data.companyDetail?.industry, data.companyDetail?.stage, data.companyDetail?.scale]
        .filter(Boolean)
        .join(' · ')
      const kv = [
        ['job', orMissing(data.jobTitle)],
        ['salary', orMissing(data.salary)],
        ['city', orMissing(data.city)],
        ['recruiter', orMissing([data.recruiter, data.recruiterTitle].filter(Boolean).join(' / '))],
        ['ab', orMissing(data.tier)],
        ['company', orMissing(companyLine)],
      ]
      const filled = (data.coverage ? Object.values(data.coverage).filter(Boolean).length : 0)
      const total = data.coverage ? Object.keys(data.coverage).length : 0
      const missingLabels = (data.missing ?? []).map((key) => t(`field_${key}`)).join('、')
      const msgs = data.msgs ?? []
      const coverageLine = data.coverage
        ? t('coverageLine', { filled, total, missing: missingLabels || t('coverageComplete') })
        : null

      const acts = []
      if (status === 'pending') {
        acts.push(
          h(
            UI.Button,
            { variant: 'primary', disabled: busy, onClick: () => onDecide(item, 'approved', data.draftHash) },
            t('approvalApprove'),
          ),
        )
        acts.push(
          h(
            UI.Button,
            { variant: 'ghost', className: 'boss-ap-skip', disabled: busy, onClick: () => onDecide(item, 'skipped') },
            t('approvalSkip'),
          ),
        )
      } else if (item && status !== 'sent') {
        acts.push(
          h(UI.Button, { variant: 'outline', disabled: busy, onClick: () => onDecide(item, 'pending') }, t('approvalRevoke')),
        )
      }
      acts.push(h(UI.Button, { variant: 'ghost', onClick: onClose }, t('close')))
      if (status === 'pending') {
        acts.push(h('span', { className: 'boss-ap-foot-hint' }, t('approvalSendHint')))
      }

      return h(
        UI.Modal,
        {
          open: true,
          size: 'lg',
          title: data.company || data.jobTitle || '',
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
              data.draft
                ? h(
                    'div',
                    { className: 'boss-ap-draft-block' },
                    h(UI.SectionTitle, null, t('approvalDraft')),
                    h('div', { className: 'boss-ap-draft' }, data.draft),
                  )
                : null,
              coverageLine
                ? h('div', { className: 'boss-ap-coverage' }, coverageLine)
                : null,
              kv.length
                ? h(
                    'div',
                    { className: 'boss-kv-grid' },
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
              h(UI.SectionTitle, { style: { marginTop: 14 } }, t('approvalChat')),
              msgs.length
                ? h(
                    'div',
                    {
                      className: 'boss-chat',
                      role: 'region',
                      tabIndex: 0,
                      ref: chatRef,
                      'aria-label': `${t('approvalChat')}（${msgs.length}）`,
                    },
                    olderCount > 0
                      ? h('div', { className: 'boss-ap-line' }, t('chatOlder', { n: olderCount }))
                      : null,
                    shownMsgs.map((entry, index) =>
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
                ? h(
                    'div',
                    {
                      className: 'boss-ap-jd',
                      role: 'region',
                      tabIndex: 0,
                      'aria-label': t('approvalJd'),
                    },
                    jdParagraphs(data.jdText).map((para, index) =>
                      h('p', { key: index, className: 'boss-ap-jd-p' }, para),
                    ),
                  )
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
              ...clickProps(() => onOpen(item.company), `${item.company} ${item.when || ''} 打开详情`),
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
        { value: 'today', label: t('tabToday') },
        { value: 'threads', label: t('tabAll') },
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
      const [tab, setTab] = React.useState(() => props.initialTab ?? 'today')
      const [query, setQuery] = React.useState('')
      const [picked, setPicked] = React.useState([])
      // 「全部会话」默认先只看该你回的，810 行一次性摊开等于没排序（UX #8）。
      const [onlyWait, setOnlyWait] = React.useState(true)
      const [openCompany, setOpenCompany] = React.useState(null)
      const [approvalNotice, setApprovalNotice] = React.useState('')
      const [approvalOpen, setApprovalOpen] = React.useState(null)
      // 看过内容才允许行内一键发：不读 JD/对话直接点「发送」等于盲发（安全评审 #6）。
      const [approvalSeen, setApprovalSeen] = React.useState(() => new Set())
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
        // 用户没手动筛状态时，默认只留「球在我这边」的：810 行全摊开等于没排序。
        if (onlyWait && pickedSet.size === 0 && !(item.owed || /待你决定|待回复/.test(item.state || ''))) {
          return false
        }
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
      // 真正还能点的：只有 pending/approved。已发/已跳过属于「最近发送」，不在这里重复。
      const approvalActionable = (approvalsView?.items ?? []).filter(
        (item) => item.status === 'pending' || item.status === 'approved',
      )

      // 已通过但后台还没发：超过 20 分钟基本是发送器没在跑，得让人看见，别一条卡一天。
      const stuckApproved = approvalActionable.filter(
        (item) =>
          item.status === 'approved' &&
          item.approvedAt &&
          Date.now() - Date.parse(item.approvedAt) > 20 * 60 * 1000,
      )

      // 「今天」只算真正会出现在首屏的三件事：今天发出、等我回、面试。
      // 口径与宿主对齐：本地日 + approvals ∪ contacted 去重，别在前端再自算一个「今天」。
      const sentToday = data?.daily?.todayOutreach ?? 0
      const allApprovals = data?.approvals?.items ?? []
      const approvalsTotal = allApprovals.length
      const failedItems = allApprovals.filter((item) => item.status === 'failed')
      const failedToday = data?.daily?.todayFailed ?? failedItems.length
      const stats = data?.approvals?.stats ?? {}
      const approvalCounts = {
        total: stats.total ?? allApprovals.length,
        sent: stats.sent ?? 0,
        skipped: stats.skipped ?? 0,
        todo: (stats.pending ?? 0) + (stats.approved ?? 0),
      }
      const tbdCount = data?.interviewStats?.tbd ?? 0
      const todayFirst = (data?.interviews ?? []).find((item) => item.dayDiff === 0)
      // 「有人理吗」：发出去且对方已回（线程末条来自对方）。没有这个数，用户只能逐条点开看。
      const repliedCount = data?.approvals?.replied ?? 0
      // 球在我这边 = 对方最后一句 + 状态是待回复/待你决定。之前只看「待你决定」，
      // 结果 4 条真正在等他回的消息一条都不显示（用户原话「那些等着回复的呢？？？」）。
      const waitRows = (data?.threads ?? [])
        .filter((item) => item.lastFrom === '对方' && (item.state === '待回复' || item.state === '待你决定'))
        // BOSS 的「您正在与Boss某某沟通」是系统占位符，不是对方在问我（审计 #5）。
        .filter((item) => !/^您正在与Boss/.test(String(item.last ?? '').trim()))
        .sort((a, b) => (b.days ?? -1) - (a.days ?? -1))

      const interviews = data?.interviews ?? []
      const conflictInterviews = interviews.filter((item) => item.dateWarning)
      // 同一家公司不管从哪个列表点进来，看到的都该是同一个弹窗：
      // 有审批条目的（面板里的候选 / 已发 / 已跳过）→ 审批弹窗（JD·公司·完整聊天·状态）；
      // 没有审批条目的老会话 → 原来的公司详情弹窗。
      const open = (company) => {
        const hit = (data?.approvals?.items ?? []).find((item) => item.company === company)
        if (hit) {
          openApproval(hit.id)
          return
        }
        setOpenCompany(company)
      }

      // 审批回写：只改本地状态机，不触发发送 —— 发送由 agent 侧 runner 轮询 approved 完成。
      const openApproval = (id) => {
        if (!id) return
        setApprovalSeen((prev) => (prev.has(id) ? prev : new Set([...prev, id])))
        setApprovalOpen(id)
      }

      // 行内「发送」前必须打开过一次详情（JD/对话/草稿全文都在弹窗里）：
      // 没看过就点，等于替用户批准了他没读过的文案。
      const decideFromRow = (item, status) => {
        if (status === 'approved' && !approvalSeen.has(item.id)) {
          setApprovalNotice(t('approvalPeekFirst'))
          openApproval(item.id)
          return
        }
        return decideApproval(item, status)
      }

      const decideApproval = async (item, status) => {
        setApprovalBusy(true)
        setApprovalBusyId(item.id)
        try {
          await callHost({ op: 'approval_decide', id: item.id, status, draftHash: item.draftHash })
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
          const message = String(error?.message || error)
          setApprovalNotice(
            /stale_draft/.test(message)
              ? t('approvalStaleDraft')
              : t('approvalFailed', { message }),
          )
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


          loading ? h(UI.EmptyState, null, t('loading')) : null,
          !loading && !data ? h(UI.EmptyState, null, t('empty')) : null,

          !loading && data
            ? (() => {
                const dq = data.dataQuality ?? {}
                const openN = (data.approvals?.items ?? []).filter(
                  (it) => it.status === 'pending' || it.status === 'approved',
                ).length
                const stale = dq.runnerStaleMin != null && dq.runnerStaleMin > 90 && openN > 0
                if (!dq.approvalsCorrupt && !stale) return null
                return h(
                  'div',
                  { className: 'boss-degraded', role: 'status' },
                  dq.approvalsCorrupt ? h('div', null, t('approvalsCorrupt')) : null,
                  stale ? h('div', null, t('runnerStale', { n: dq.runnerStaleMin })) : null,
                )
              })()
            : null,

          !loading && data ? h(TabBar, { tab, setTab, t }) : null,

          // —— 今天：只放需要动手的事，0 条的区块整块消失 ——
          !loading && data && tab === 'today'
            ? h(
                'div',
                { className: 'boss-today', role: 'tabpanel', 'aria-label': t('tabToday') },
                h(
                  'div',
                  { className: 'boss-kpi' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'boss-kpi-item',
                      onClick: () => scrollToSection('boss-sec-approval'),
                    },
                    t('kpiToday'),
                    h('b', null, String(sentToday)),
                  ),
                  h('span', { className: 'boss-kpi-sep', 'aria-hidden': 'true' }, '·'),
                  h(
                    'span',
                    { className: 'boss-kpi-item', title: t('kpiRepliedHint', { n: repliedCount }) },
                    t('kpiReplied'),
                    h('b', null, String(repliedCount)),
                  ),
                  h('span', { className: 'boss-kpi-sep', 'aria-hidden': 'true' }, '·'),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'boss-kpi-item',
                      onClick: () => scrollToSection('boss-sec-wait'),
                    },
                    t('kpiWait'),
                    h('b', null, String(waitRows.length)),
                  ),
                  h('span', { className: 'boss-kpi-sep', 'aria-hidden': 'true' }, '·'),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'boss-kpi-item',
                      onClick: () => scrollToSection('boss-sec-interview'),
                    },
                    t('kpiInterview'),
                    h('b', null, String(interviews.length)),
                    tbdCount ? h('span', { className: 'boss-kpi-sub' }, `· ${t('kpiTbd', { n: tbdCount })}`) : null,
                  ),
                  failedToday
                    ? [
                        h('span', { key: 'sep-f', className: 'boss-kpi-sep', 'aria-hidden': 'true' }, '·'),
                        h(
                          'span',
                          { key: 'kpi-f', className: 'boss-kpi-item boss-kpi-bad' },
                          t('kpiFailed'),
                          h('b', null, String(failedToday)),
                        ),
                      ]
                    : null,
                ),

                // 今天有面试时置顶提醒一句，别让它被后面的候选压到屏幕外。
                todayFirst
                  ? h(
                      'div',
                      { className: 'boss-today-interview', role: 'status' },
                      `${t('todayInterview')} ${todayFirst.when || ''} ${todayFirst.mode || ''}：${todayFirst.company}`,
                    )
                  : null,

                // 面试放在待发首触之前：真有 16:30 电话的那天，不能被 20 行候选挤到屏外。
                (() => {
                  const stats = data?.interviewStats ?? {}
                  const closedA = stats.cancelled ?? 0
                  const closedB = stats.past ?? 0
                  const tbdRows = data?.tbdInterviews ?? []
                  if (!interviews.length && !tbdRows.length && !closedA && !closedB) return null
                  return h(
                    'div',
                    { className: 'boss-section', id: 'boss-sec-interview' },
                    h(
                      'div',
                      { className: 'boss-section-top' },
                      h(UI.SectionTitle, null, `${t('upcoming')}（${interviews.length}）`),
                    ),
                    interviews.length
                      ? h(UpcomingList, { interviews, t, onOpen: open })
                      : h('div', { className: 'boss-action-empty' }, h(UI.EmptyState, null, t('interviewNone'))),
                    tbdRows.length
                      ? h(
                          'div',
                          { className: 'boss-upcoming boss-upcoming-tbd' },
                          tbdRows.map((item, index) =>
                            h(
                              'div',
                              {
                                key: `${item.company}|tbd|${index}`,
                                className: 'boss-upcoming-row',
                                ...clickProps(() => open(item.company), `${item.company} 打开详情`),
                              },
                              h('span', { className: 'boss-chipd', 'data-tone': 'tbd' }, t('interviewTbdChip')),
                              h(
                                'div',
                                { className: 'boss-upcoming-main' },
                                h('div', { className: 'boss-co' }, item.company || '—'),
                                h('div', { className: 'boss-sub' }, item.job || item.who || '—'),
                              ),
                              h('span', { className: 'boss-sub' }, item.state || '—'),
                              h('span', { className: 'boss-nx' }, item.next || '—'),
                            ),
                          ),
                        )
                      : null,
                    closedA || closedB
                      ? h(
                          'div',
                          { className: 'boss-section-hint' },
                          t('interviewClosed', { a: closedA, b: closedB }),
                        )
                      : null,
                  )
                })(),

                h(
                  'div',
                  { className: 'boss-section', id: 'boss-sec-wait' },
                  h(
                    'div',
                    { className: 'boss-section-top' },
                    h(UI.SectionTitle, null, `${t('waitTitle')}（${waitRows.length}）`),
                    h('span', { className: 'boss-section-hint' }, t('waitSub')),
                  ),
                  h(WaitRows, { items: waitRows, t, onOpen: open }),
                ),

                // 待发首触常驻：0 条也要有一行「今日候选 12（11 发 / 1 不发 / 0 待定）」，
                // 否则用户分不清「做完了」和「agent 没跑」（UX 评审第 5 条）。
                h(
                      'div',
                      { className: 'boss-section', id: 'boss-sec-approval' },
                      h(
                        'div',
                        { className: 'boss-section-head' },
                        h(UI.SectionTitle, null, t('approvalTitle')),
                        h('span', { className: 'boss-section-count' }, t('approvalCounts', approvalCounts)),
                      ),
                      approvalActionable.length
                        ? h('span', { className: 'boss-section-hint' }, t('approvalSub'))
                        : h('span', { className: 'boss-section-hint' }, t('approvalAllDone')),
                      stuckApproved.length
                        ? h(
                            'div',
                            { className: 'boss-aq-notice' },
                            t('approvalStuck', { n: stuckApproved.length }),
                          )
                        : null,
                      approvalNotice ? h('div', { className: 'boss-aq-notice' }, approvalNotice) : null,
                      approvalActionable.length
                        ? h(ApprovalQueue, {
                            approvals: approvalsView,
                            t,
                            onOpen: openApproval,
                            onDecide: decideFromRow,
                            busyId: approvalBusy ? approvalBusyId : null,
                            notice: approvalNotice,
                            limit: 5,
                          })
                        : null,
                      // 失败必须露头：否则「点了 5 条全失败」的一天，面板看起来什么都没发生。
                      failedItems.length
                        ? h(
                            'div',
                            { className: 'boss-fail-rows' },
                            h('div', { className: 'boss-fail-title' }, t('failedTitle', { n: failedItems.length })),
                            failedItems.slice(0, 5).map((item) =>
                              h(
                                'div',
                                { key: `${item.id}|fail`, className: 'boss-fail-row' },
                                h('span', { className: 'boss-co' }, item.company || '—'),
                                h('span', { className: 'boss-aq-meta' }, formatWhen(item.decidedAt || item.addedAt)),
                                h('span', { className: 'boss-fail-why' }, sendText(item).slice(0, 80) || '—'),
                                h(
                                  UI.Button,
                                  {
                                    variant: 'outline',
                                    size: 'sm',
                                    disabled: approvalBusy && approvalBusyId === item.id,
                                    onClick: (event) => {
                                      event?.stopPropagation?.()
                                      decideApproval(item, 'approved')
                                    },
                                  },
                                  t('resend'),
                                ),
                              ),
                            ),
                          )
                        : null,
                    ),

                h(SentSummary, { approvals: data.approvals, t, onOpen: setApprovalOpen }),

                h(
                  'div',
                  { className: 'boss-more' },
                  h(
                    UI.Button,
                    { variant: 'ghost', size: 'sm', onClick: () => setTab('threads') },
                    t('allLink', { n: counts.threadRows ?? data?.threads?.length ?? 0 }),
                  ),
                ),
              )
            : null,

          // —— 会话列表 ——
          !loading && data && tab === 'threads'
            ? h(
                'div',
                { role: 'tabpanel', 'aria-label': t('tabAll') },
                h(
                  'div',
                  { className: 'boss-section' },
                  h(UI.SectionTitle, null, t('sectionThreads')),
                  h(
                    'span',
                    { className: 'boss-section-count' },
                    t('threadsCount', {
                      rows: counts.threadRows ?? threads.length,
                      companies: counts.companies ?? '—',
                    }),
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
                    'aria-label': t('search'),
                  }),
                  h(
                    UI.Pill,
                    { active: onlyWait, onClick: () => setOnlyWait((v) => !v) },
                    t('filterWait'),
                    h('span', null, String((data.threads ?? []).filter((it) => it.owed || /待你决定|待回复/.test(it.state || '')).length)),
                  ),
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
                h('div', { className: 'boss-section' }, h(UI.SectionTitle, null, t('recentDaysTitle'))),
                h('div', { className: 'boss-section-hint' }, t('recentDaysSub')),
                h(
                  'div',
                  { className: 'boss-days', style: { marginTop: 10, marginBottom: 12 } },
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
                h(
                  'div',
                  { className: 'boss-table' },
                  h(ThreadHead, { t }),
                  threads.length
                    ? threads.map((item, index) =>
                        h(ThreadRow, {
                          // index 不进 key：筛选/排序变化时它会让行按位置复用，内容被就地改写（工程评审 #10）。
                          key: `${item.company}|${item.who}|${item.time || ''}|${item.jobId || ''}`,
                          item,
                          t,
                          onOpen: open,
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

/**
 * dsh-panel ui-kit — v1
 * ----------------------------------------------------------------------------
 * Shared UI atoms for hand-rolled DSH sidebar/center panels.
 *
 * Source: copied (markup + CSS) from @deepseek-ai/dsh-client-ui-primitives
 *   lib/index.js + lib/*.module.css (v0.2.1-rc.3), per
 *   cordis-plugin-development/references/practices.md §UI which requires a
 *   plugin to copy primitives in (NOT require them), rename classes under its
 *   own prefix, and keep only --dsw-alias-* / --dsw-* token references.
 *
 * What it gives a panel:
 *   Button, Tag, Pill, StateDot, SegmentedTabs, SearchInput, Switch,
 *   Modal, useToast, EmptyState, StatCard, SectionTitle  +  one CSS string.
 *
 * Usage (inside a window.__ModuleLoader__ factory that already did
 *   `const React = require('react'); const h = React.createElement`):
 *
 *   // 1. paste this whole file above your component code
 *   const UI = createUiKit(React)
 *   // 2. inject the stylesheet ONCE, merged into the panel's own <style>
 *   //    (one tag only — panels' tests read the first style's children):
 *   h('style', { key: 'my-panel-css' }, UI.CSS + '\n' + OWN_CSS)
 *   // 3. use atoms: UI.Button({variant:'primary', onClick}, '保存')
 *
 * Both consumers (dsh-boss-panel, dsh-noagent-schedule) inline this file, so
 * edits here must be re-copied into both client.js — there is no require().
 *
 * Every class is prefixed `dp-` and every color/spacing/radius rides a host
 * token, so the panel follows the active theme (light/dark/skins) with zero
 * hardcoded values. Behavior copied from the primitives: Modal focus+Esc+
 * outside-click+restore, Switch keys off aria-checked, SegmentedTabs has the
 * sliding indicator, Toast fades on a `--dp-toast-hold` timer.
 *
 * License: MIT (mirrors the upstream primitives).
 */

// eslint-disable-next-line
export function createUiKit(React) {
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
.dp-tabs { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; padding: 4px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-module-platform); }
.dp-tabs-indicator { position: absolute; top: 4px; bottom: 4px; left: 4px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-3); transition: transform 180ms ease, width 180ms ease; pointer-events: none; }
.dp-tab { position: relative; justify-content: center; height: 34px; padding: 0 12px; border-radius: var(--dsw-radius-md); border: none; background: transparent; color: var(--dsw-alias-label-secondary); transition: color 180ms ease; cursor: pointer; font: inherit; }
.dp-tab:hover, .dp-tab[aria-selected='true'] { background: transparent; color: var(--dsw-alias-label-primary); }
.dp-tab[aria-selected='true'] { font-weight: 600; }
.dp-tab:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; border-radius: 8px; }
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
    // 筛选胶囊：选中状态只靠颜色/阴影，读屏听不出来（a11y 评审 #19）。
    const a11y = onClick ? { 'aria-pressed': active ? 'true' : 'false' } : {}
    return h('button', { type, className: cls, onClick, ...a11y }, children)
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
      // roving tabindex + 左右方向键：tablist 的标准键盘模型（a11y 评审 #12）。
      tabs.map((t, i) => h('button', {
        key: t.value, role: 'tab', type: 'button',
        className: 'dp-tab', 'aria-selected': t.value === value,
        tabIndex: t.value === value ? 0 : -1,
        onClick: () => onChange(t.value),
        onKeyDown: (e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
          e.preventDefault()
          const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
          onChange(next.value)
          const el = ref.current?.querySelector(`.dp-tab[data-value="${next.value}"]`)
          el?.focus?.()
        },
        'data-value': t.value,
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

    // onClose 一律是调用方的内联箭头，面板每 15s 轮询就换一个新函数。
    // 若把它写进依赖，effect 会反复重跑：焦点被抢回第一个按钮、关闭后焦点掉到 body。
    // 所以 onClose 走 ref，effect 只在 open 真正变化时执行（2026-10-28 a11y 评审 #4）。
    const closeRef = useRef(onClose)
    closeRef.current = onClose
    useEffect(() => {
      if (!open) return
      prevFocus.current = document.activeElement
      const el = dialogRef.current
      const focusables = () => (el ? Array.from(el.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )).filter((n) => !n.disabled && n.offsetParent !== null) : [])
      const first = focusables()[0]
      ;(first || el)?.focus?.()
      const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.(); return }
        if (e.key !== 'Tab' || !el) return
        // 焦点陷阱：Tab 在弹窗内部循环，不许漏到背后的面板行上。
        const list = focusables()
        if (!list.length) { e.preventDefault(); el.focus?.(); return }
        const head = list[0]
        const tail = list[list.length - 1]
        if (e.shiftKey && (document.activeElement === head || !el.contains(document.activeElement))) {
          e.preventDefault(); tail.focus?.()
        } else if (!e.shiftKey && (document.activeElement === tail || !el.contains(document.activeElement))) {
          e.preventDefault(); head.focus?.()
        }
      }
      document.addEventListener('keydown', onKey, true)
      const restore = prevFocus.current
      return () => {
        document.removeEventListener('keydown', onKey, true)
        // 只有原来那个元素还在文档里才回焦，否则焦点会被丢到 body。
        try { if (restore && restore.isConnected !== false) restore.focus?.() } catch { /* ignore */ }
      }
    }, [open])

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
      // 3000ms 常比读屏念完一句还短，改成 6000ms（2026-10-28 a11y 评审 #21）。
      const hold = opts.hold || 6000
      setItems(xs => [...xs, { id, text, tone, hold }])
      setTimeout(() => setItems(xs => xs.filter(x => x.id !== id)), hold + 1100)
      return id
    }, [])
    const dismiss = useCallback((id) => setItems(xs => xs.filter(x => x.id !== id)), [])
    const iconFor = (tone) => tone === 'success' ? h(IconCheck) : tone === 'info' ? h(IconInfo) : h(IconWarn)
    // aria-live：审批「发送/不发」这类不可逆动作的唯一反馈就是 toast，
    // 没有 live region 时读屏用户完全不知道点没点生效（2026-10-28 a11y 评审 #5）。
    const node = items.map(it =>
      h('div', { key: it.id, className: 'dp-toast', role: 'status', 'aria-live': 'polite', style: { '--dp-toast-hold': `${it.hold}ms` } },
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

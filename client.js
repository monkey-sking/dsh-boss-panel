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
      upcoming: '近期面试',
      noUpcoming: '近期没有已安排的面试',
      contactsDays: '最近 14 天首触',
      colWhen: '时间',
      colMode: '形式',
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
      upcoming: 'Upcoming interviews',
      noUpcoming: 'No interviews scheduled soon',
      contactsDays: 'Outreach in last 14 days',
      colWhen: 'When',
      colMode: 'Mode',
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
      .boss-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 5px 12px; font-size: 12px; line-height: 18px; cursor: pointer; font-family: inherit; }
      .boss-btn:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-btn:disabled { opacity: .5; cursor: default; }
      .boss-daily { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 10px; padding: 10px 14px; font-size: 12.5px; line-height: 20px; }
      .boss-daily b { font-variant-numeric: tabular-nums; }
      .boss-daily-sep { color: var(--dsw-alias-label-secondary); margin: 0 6px; }
      .boss-fail { color: var(--dsw-alias-state-warn-primary); }
      .boss-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
      .boss-card { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 10px; padding: 10px 13px; display: flex; flex-direction: column; gap: 2px; }
      .boss-card-num { font-size: 19px; line-height: 25px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .boss-card-num[data-kind="warn"] { color: var(--dsw-alias-state-warn-primary); }
      .boss-card-num[data-kind="error"] { color: var(--dsw-alias-state-error-primary); }
      .boss-card-num[data-kind="success"] { color: var(--dsw-alias-state-success-primary); }
      .boss-card-label { font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary); }
      .boss-section { display: flex; align-items: center; gap: 8px; font-size: 14px; line-height: 20px; font-weight: 600; margin: 6px 0 0; }
      .boss-section-count { font-size: 12px; font-weight: 400; color: var(--dsw-alias-label-secondary); }
      .boss-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .boss-input { flex: 1 1 200px; min-width: 120px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 5px 10px; font-size: 12px; line-height: 18px; font-family: inherit; }
      .boss-input:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
      .boss-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .boss-chip { appearance: none; font-family: inherit; font-size: 12px; line-height: 16px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); cursor: pointer; }
      .boss-chip:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-chip[data-on="true"] { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
      .boss-chip-n { opacity: .7; font-variant-numeric: tabular-nums; margin-left: 4px; }
      .boss-table { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
      .boss-tr { display: grid; gap: 10px; align-items: start; padding: 9px 13px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .boss-tr:last-child { border-bottom: none; }
      .boss-tr[data-clickable="true"] { cursor: pointer; }
      .boss-tr[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-th { font-size: 11.5px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); font-weight: 500; }
      .boss-tr.threads { grid-template-columns: 82px minmax(120px, 1fr) minmax(120px, 1.1fr) minmax(160px, 1.9fr) 96px; }
      .boss-tr.iv { grid-template-columns: minmax(120px, 1.2fr) 84px 84px minmax(110px, 1fr) 70px minmax(90px, .9fr) minmax(110px, 1fr); }
      .boss-badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; line-height: 17px; white-space: nowrap; border: 1px solid transparent; }
      .boss-badge[data-kind="warn"] { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
      .boss-badge[data-kind="error"] { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
      .boss-badge[data-kind="brand"] { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
      .boss-badge[data-kind="success"] { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
      .boss-badge[data-kind="idle"] { color: var(--dsw-alias-label-secondary); border-color: var(--dsw-alias-border-l1); }
      .boss-co { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .boss-sub { font-size: 11.5px; line-height: 16px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .boss-line { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
      .boss-who { flex: 0 0 auto; font-size: 10.5px; line-height: 15px; padding: 0 5px; border-radius: 5px; border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); }
      .boss-who[data-side="me"] { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
      .boss-tx { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
      .boss-nx { font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .boss-sal { display: inline-block; margin-left: 6px; font-size: 11.5px; color: var(--dsw-alias-brand-primary); }
      .boss-chipd { display: inline-block; padding: 0 7px; border-radius: 9px; font-size: 11px; line-height: 16px; border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .boss-chipd[data-tone="hot"] { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); font-weight: 600; }
      .boss-chipd[data-tone="past"], .boss-chipd[data-tone="tbd"] { opacity: .7; }
      .boss-empty { padding: 22px 14px; text-align: center; font-size: 12px; color: var(--dsw-alias-label-secondary); border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
      .boss-error { border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 10px; padding: 10px 14px; font-size: 12px; color: var(--dsw-alias-state-error-primary); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .boss-days { display: flex; gap: 4px; flex-wrap: wrap; }
      .boss-day { border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; padding: 2px 8px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .boss-day[data-zero="false"] { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
      .boss-mask { position: fixed; inset: 0; background: var(--dsw-alias-bg-overlay); z-index: 60; }
      .boss-modal { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(680px, 92vw); max-height: 82vh; overflow: auto; z-index: 61; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px; box-shadow: 0 18px 50px rgba(0, 0, 0, .28); padding: 16px 20px 20px; }
      .boss-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
      .boss-modal-title { margin: 0; font-size: 16px; line-height: 22px; font-weight: 600; }
      .boss-kv { display: flex; gap: 8px; font-size: 12.5px; line-height: 19px; }
      .boss-kv-key { flex: 0 0 74px; color: var(--dsw-alias-label-secondary); }
      .boss-kv-val { flex: 1 1 auto; min-width: 0; word-break: break-word; }
      .boss-chat { margin-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; max-height: 40vh; overflow: auto; }
      .boss-cm { font-size: 12.5px; line-height: 19px; padding: 6px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); word-break: break-word; }
      .boss-cm[data-mine="true"] { margin-left: 32px; border-left: 2px solid var(--dsw-alias-brand-primary); }
      .boss-cm[data-mine="false"] { margin-right: 32px; }
      .boss-cm-tag { font-size: 10.5px; color: var(--dsw-alias-label-secondary); margin-right: 6px; }

      /* —— 概览仪表盘 —— */
      .boss-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--dsw-alias-border-l1); padding-bottom: 0; }
      .boss-tab { appearance: none; font-family: inherit; font-size: 13px; line-height: 20px; padding: 6px 14px; border: none; border-bottom: 2px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; margin-bottom: -1px; }
      .boss-tab:hover { color: var(--dsw-alias-label-primary); }
      .boss-tab[data-on="true"] { color: var(--dsw-alias-brand-primary); border-bottom-color: var(--dsw-alias-brand-primary); font-weight: 500; }
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
      .boss-dist-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
      .boss-dist-dot[data-kind="warn"] { background: var(--dsw-alias-state-warn-primary); }
      .boss-dist-dot[data-kind="error"] { background: var(--dsw-alias-state-error-primary); }
      .boss-dist-dot[data-kind="brand"] { background: var(--dsw-alias-brand-primary); }
      .boss-dist-dot[data-kind="success"] { background: var(--dsw-alias-state-success-primary); }
      .boss-dist-dot[data-kind="idle"] { background: var(--dsw-alias-border-l2); }
      .boss-split { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; align-items: start; }
      .boss-split-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .boss-action { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
      .boss-action-row { display: grid; grid-template-columns: 82px minmax(90px, 1.1fr) minmax(80px, .9fr) minmax(120px, 1.6fr); gap: 10px; align-items: center; padding: 9px 13px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .boss-action-row:last-child { border-bottom: none; }
      .boss-action-row[data-clickable="true"] { cursor: pointer; }
      .boss-action-row[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-action-main { min-width: 0; }
      .boss-action-nx { min-width: 0; }
      .boss-action-msg { font-size: 12px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .boss-action-empty { border: none; padding: 14px 4px; text-align: left; }
      .boss-upcoming { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
      .boss-upcoming-row { display: grid; grid-template-columns: 74px minmax(110px, 1.3fr) minmax(90px, 1fr) 62px; gap: 10px; align-items: center; padding: 9px 13px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .boss-upcoming-row:last-child { border-bottom: none; }
      .boss-upcoming-row[data-clickable="true"] { cursor: pointer; }
      .boss-upcoming-row[data-clickable="true"]:hover { background: var(--dsw-alias-bg-layer-2); }
      .boss-upcoming-main { min-width: 0; }
    `

    function StyleTag() {
      return h('style', { 'data-boss-panel': 'true' }, CSS)
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
        React.Fragment,
        null,
        h('div', { className: 'boss-mask', onClick: onClose }),
        h(
          'div',
          { className: 'boss-modal', role: 'dialog', 'aria-label': t('detailTitle') },
          h(
            'div',
            { className: 'boss-modal-head' },
            h('h3', { className: 'boss-modal-title' }, company),
            h('button', { type: 'button', className: 'boss-btn', onClick: onClose }, t('close')),
          ),
          state.loading ? h('div', { className: 'boss-empty' }, t('loading')) : null,
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
          h('div', { className: 'boss-section', style: { marginTop: 14 } }, t('chat')),
          h(
            'div',
            { className: 'boss-chat' },
            msgs.length
              ? msgs.map((item, index) =>
                  h(
                    'div',
                    {
                      key: index,
                      className: 'boss-cm',
                      'data-mine': item.mine ? 'true' : 'false',
                    },
                    h('span', { className: 'boss-cm-tag' }, item.mine ? t('fromMe') : t('fromThem')),
                    item.text,
                  ),
                )
              : h('div', { className: 'boss-cm', 'data-mine': 'false' }, t('chatEmpty')),
          ),
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
          h(
            'span',
            { className: 'boss-badge', 'data-kind': STATE_KIND[item.state] ?? 'idle' },
            item.state,
          ),
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
              )
            : h('span', { className: 'boss-sub' }, t('jobHint')),
        ),
        h(
          'span',
          null,
          h(
            'div',
            { className: 'boss-line' },
            h('span', { className: 'boss-who', 'data-side': side }, sideLabel),
            h('span', { className: 'boss-tx', title: item.last }, clip(item.last)),
          ),
          meta ? h('div', { className: 'boss-sub' }, meta) : null,
        ),
        h('span', { className: 'boss-nx' }, item.next || '—'),
      )
    }

    function InterviewRow({ item, t }) {
      const chip = dayChip(item.dayDiff, t)
      return h(
        'div',
        { className: 'boss-tr iv' },
        h('span', null, h('div', { className: 'boss-co' }, item.company), h('span', { className: 'boss-chipd', 'data-tone': chip.tone }, chip.text)),
        h('span', { className: 'boss-sub' }, item.who || '—'),
        h('span', { className: 'boss-sub' }, item.job || '—'),
        h('span', { className: 'boss-sub' }, item.when || '—'),
        h('span', { className: 'boss-sub' }, item.mode || '—'),
        h('span', { className: 'boss-sub' }, item.state || '—'),
        h('span', { className: 'boss-nx' }, item.next || '—'),
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
              h('i', { className: 'boss-dist-dot', 'data-kind': STATE_KIND[entry.state] ?? 'idle' }),
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
        return h('div', { className: 'boss-empty boss-action-empty' }, t('actionEmpty'))
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
            h(
              'span',
              { className: 'boss-badge', 'data-kind': STATE_KIND[item.state] ?? 'idle' },
              item.state,
            ),
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
        return h('div', { className: 'boss-empty boss-action-empty' }, t('pendingEmpty'))
      }
      return h(
        'div',
        { className: 'boss-action boss-pending' },
        rows.map((item) =>
          h(
            'div',
            { key: item.id, className: 'boss-action-row boss-pending-row' },
            h(
              'span',
              { className: 'boss-badge', 'data-kind': 'pending' },
              item.conf === null ? 'review' : String(Math.round(item.conf * 100) / 100),
            ),
            h(
              'div',
              { className: 'boss-action-main' },
              h(
                'div',
                { className: 'boss-co', title: item.company },
                h('span', {
                  'data-clickable': 'true',
                  style: { cursor: 'pointer' },
                  onClick: () => onOpen(item.company),
                }, `${item.name || '—'} · ${item.company}`),
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
                'button',
                {
                  type: 'button',
                  className: 'boss-btn boss-btn-mini',
                  onClick: () => onMark(item.id, 'sent'),
                },
                t('pendingSent'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'boss-btn boss-btn-mini',
                  onClick: () => onMark(item.id, 'dismissed'),
                },
                t('pendingDrop'),
              ),
            ),
          ),
        ),
      )
    }

    /** 概览页「近期面试」：还没过去的面试，最多 4 条。 */
    function UpcomingList({ interviews, t, onOpen }) {
      const upcoming = (interviews ?? []).filter(
        (item) => item.dayDiff === null || item.dayDiff >= 0,
      )
      if (!upcoming.length) {
        return h('div', { className: 'boss-empty boss-action-empty' }, t('noUpcoming'))
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
            h('span', { className: 'boss-sub' }, item.when || '—'),
            h('span', { className: 'boss-sub' }, item.mode || '—'),
          )
        }),
      )
    }

    function TabBar({ tab, setTab, t }) {
      const tabs = [
        { key: 'overview', label: t('tabOverview') },
        { key: 'interviews', label: t('tabInterview') },
        { key: 'threads', label: t('tabThreads') },
      ]
      return h(
        'div',
        { className: 'boss-tabs' },
        tabs.map((tab_) =>
          h(
            'button',
            {
              key: tab_.key,
              type: 'button',
              className: 'boss-tab',
              'data-on': tab === tab_.key ? 'true' : 'false',
              onClick: () => setTab(tab_.key),
            },
            tab_.label,
          ),
        ),
      )
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
      const [tab, setTab] = React.useState(props.initialTab ?? 'overview')
      const [query, setQuery] = React.useState('')
      const [picked, setPicked] = React.useState([])
      const [openCompany, setOpenCompany] = React.useState(null)
      const [pendingHidden, setPendingHidden] = React.useState(() => new Set())
      const [notice, setNotice] = React.useState('')

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
      const open = (company) => setOpenCompany(company)

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
                'button',
                {
                  type: 'button',
                  className: 'boss-btn',
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
                  'button',
                  { type: 'button', className: 'boss-btn', onClick: () => void props.refresh() },
                  t('retry'),
                ),
              )
            : null,

          loading ? h('div', { className: 'boss-empty' }, t('loading')) : null,
          !loading && !data ? h('div', { className: 'boss-empty' }, t('empty')) : null,

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
                    h(
                      'div',
                      { key: card.label, className: 'boss-card' },
                      h(
                        'span',
                        { className: 'boss-card-num', 'data-kind': card.kind ?? undefined },
                        String(card.value),
                      ),
                      h('span', { className: 'boss-card-label' }, card.label),
                    ),
                  ),
                ),
                pending.filter((item) => !pendingHidden.has(item.id)).length
                  ? h(
                      'div',
                      null,
                      h(
                        'div',
                        { className: 'boss-section' },
                        t('pendingTitle'),
                        h('span', { className: 'boss-section-count' }, t('pendingSub')),
                      ),
                      h(PendingRows, {
                        items: pending.filter((item) => !pendingHidden.has(item.id)),
                        t,
                        onOpen: open,
                        onMark: markPending,
                      }),
                    )
                  : null,
                h('div', { className: 'boss-section' }, t('stateDist')),
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
                      t('actionTitle'),
                      h('span', { className: 'boss-section-count' }, t('actionSub')),
                    ),
                    h(ActionRows, { threads: data.threads ?? [], t, onOpen: open }),
                  ),
                  h(
                    'div',
                    { className: 'boss-split-col' },
                    h('div', { className: 'boss-section' }, t('upcoming')),
                    h(UpcomingList, { interviews, t, onOpen: open }),
                  ),
                ),
                h('div', { className: 'boss-section' }, t('contactsDays')),
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
                  t('sectionInterview'),
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
                        h(InterviewRow, { key: `${item.company}|${index}`, item, t }),
                      )
                    : h(
                        'div',
                        { className: 'boss-empty', style: { border: 'none', borderRadius: 0 } },
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
                  t('sectionThreads'),
                  h(
                    'span',
                    { className: 'boss-section-count' },
                    `${threads.length} / ${counts.threads ?? 0}`,
                  ),
                ),
                h(
                  'div',
                  { className: 'boss-toolbar' },
                  h('input', {
                    className: 'boss-input',
                    type: 'search',
                    value: query,
                    placeholder: t('search'),
                    onChange: (event) => setQuery(event.target.value),
                  }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'boss-chip',
                      'data-on': picked.length === 0 ? 'true' : 'false',
                      onClick: () => setPicked([]),
                    },
                    t('filterAll'),
                    h('span', { className: 'boss-chip-n' }, String(counts.threads ?? 0)),
                  ),
                ),
                h(
                  'div',
                  { className: 'boss-chips' },
                  ORDER.map((state) =>
                    h(
                      'button',
                      {
                        key: state,
                        type: 'button',
                        className: 'boss-chip',
                        'data-on': pickedSet.has(state) ? 'true' : 'false',
                        onClick: () => togglePick(state),
                      },
                      state,
                      h('span', { className: 'boss-chip-n' }, String(byState[state] ?? 0)),
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
                    : h(
                        'div',
                        { className: 'boss-empty', style: { border: 'none', borderRadius: 0 } },
                        t('noMatch'),
                      ),
                ),
              )
            : null,
        ),

        openCompany
          ? h(DetailModal, { company: openCompany, onClose: () => setOpenCompany(null), t })
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

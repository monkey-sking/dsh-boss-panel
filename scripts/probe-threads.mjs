import * as mod from '../index.js'
const s = await mod.buildSnapshot({})
for (const t of s.threads) if (['已读不回','已面试','已约面试'].includes(t.state)) console.log(t.state,'|',t.company,'|',t.who,'|',t.time,'| from=',t.lastFrom,'deliv=',t.delivery,'|',String(t.last||'').slice(0,80))

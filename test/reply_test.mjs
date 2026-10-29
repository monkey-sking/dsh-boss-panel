import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildSnapshot, normalizeReplyDrafts, queueReply } from '../index.js'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-reply-'))
const cmdFile = path.join(tmp, 'boss_reply_command.json')
const threadsFile = path.join(tmp, 'boss_threads.json')

// 会话仍该我回：对方最后发言，且不是拒信/系统卡。
fs.writeFileSync(threadsFile, JSON.stringify({
  rows: [
    { company: '示例公司', name: '王女士', time: '11:00', last: '您好，有作品链接吗？', lastFrom: '对方', state: 'WAIT', owed: 'True' },
    { company: '已拒公司', name: '李女士', time: '10:00', last: '不好意思，不太合适哦', lastFrom: '对方', state: 'WAIT', owed: 'False' },
    { company: '我末条公司', name: '张先生', time: '09:00', last: '好的，等您回复', lastFrom: '我', state: 'WAIT', owed: 'False' },
  ],
}))

// 1) 面板点「发送」写的是指令文件，不是直接调用浏览器：runner 下一轮才发。
const res = await queueReply('示例公司', '您好，我整理了一份能力拆解，发您看看。', { replyCmdFile: cmdFile, dataDir: tmp })
assert.equal(res.ok, true)
const doc = JSON.parse(fs.readFileSync(cmdFile, 'utf8'))
assert.equal(doc.items.length, 1)
assert.equal(doc.items[0].status, 'queued')
assert.equal(doc.items[0].company, '示例公司')
assert.equal(fs.statSync(cmdFile).mode & 0o777, 0o600, '指令文件必须是 0600')

// 2) 空回复 / 超长回复要被挡下，不能把空消息排进发件箱。
await assert.rejects(() => queueReply('示例公司', '   ', { replyCmdFile: cmdFile, dataDir: tmp }), /empty_reply|空的/)
await assert.rejects(() => queueReply('示例公司', 'a'.repeat(301), { replyCmdFile: cmdFile, dataDir: tmp }), /too_long|300/)

// 3) 二次校验：会话不存在 / 对方没新消息 / 已拒 都不能排进发件箱。
await assert.rejects(() => queueReply('不存在的公司', '您好', { replyCmdFile: cmdFile, dataDir: tmp }), /thread_missing|找不到/)
await assert.rejects(() => queueReply('我末条公司', '您好', { replyCmdFile: cmdFile, dataDir: tmp }), /thread_not_waiting|新消息/)
await assert.rejects(() => queueReply('已拒公司', '您好', { replyCmdFile: cmdFile, dataDir: tmp }), /thread_closed|已结束/)

// 4) 快照必须带 replyDrafts（前端 去回复 的草稿来源），缺了会退化成「空白手打」。
const snap = await buildSnapshot({})
assert.ok(snap.replyDrafts, 'snapshot.replyDrafts missing')
assert.ok(Array.isArray(snap.replyDrafts.items))

// 5) 草稿展示闸门：只显示「对方末条 + 待你决定/待回复 + stamp 匹配」的草稿。
const filtered = normalizeReplyDrafts(
  { items: [
    { company: 'A', draft: '好', stamp: '10:00|你好，有作品链接吗？' },
    { company: 'B', draft: '好', stamp: '10:01|不好意思，不太合适哦' },
    { company: 'C', draft: '好', stamp: '10:02|旧消息' },
    { company: 'D', draft: '好', stamp: '10:03|你好' },
  ] },
  [
    { company: 'A', state: '待回复', lastFrom: '对方', time: '10:00', last: '你好，有作品链接吗？' },
    { company: 'B', state: '已结束', lastFrom: '对方', time: '10:01', last: '不好意思，不太合适哦' },
    { company: 'C', state: '待回复', lastFrom: '对方', time: '10:02', last: '新消息' },
    { company: 'D', state: '等对方', lastFrom: '对方', time: '10:03', last: '你好' },
  ],
)
assert.deepEqual(filtered.items.map((it) => it.company), ['A'])

// 6) 源码契约：去回复 打开弹窗、发送走 reply_send。
const src = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
assert.ok(src.includes('function ReplyModal('), 'ReplyModal missing')
assert.ok(/op: 'reply_send'/.test(src), 'reply_send call missing')
assert.ok(/onReply: \(company\) => setReplyOpen\(company\)/.test(src), '去回复 must open the composer')

console.log('REPLY OK: queueReply → 0600；空/超长/会话失效被拦；草稿按会话状态过滤；去回复走弹窗')

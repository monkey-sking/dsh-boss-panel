import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildSnapshot, queueReply } from '../index.js'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-reply-'))
const cmdFile = path.join(tmp, 'boss_reply_command.json')

// 1) 面板点「发送」写的是指令文件，不是直接调用浏览器：runner 下一轮才发。
const res = await queueReply('示例公司', '您好，我整理了一份能力拆解，发您看看。', { replyCmdFile: cmdFile })
assert.equal(res.ok, true)
const doc = JSON.parse(fs.readFileSync(cmdFile, 'utf8'))
assert.equal(doc.items.length, 1)
assert.equal(doc.items[0].status, 'queued')
assert.equal(doc.items[0].company, '示例公司')
assert.equal(fs.statSync(cmdFile).mode & 0o777, 0o600, '指令文件必须是 0600')

// 2) 空回复 / 超长回复要被挡下，不能把空消息排进发件箱。
await assert.rejects(() => queueReply('示例公司', '   ', { replyCmdFile: cmdFile }), /empty_reply|空的/)
await assert.rejects(() => queueReply('示例公司', 'a'.repeat(301), { replyCmdFile: cmdFile }), /too_long|300/)

// 3) 快照必须带 replyDrafts（前端 去回复 的草稿来源），缺了会退化成「空白手打」。
const snap = await buildSnapshot({})
assert.ok(snap.replyDrafts, 'snapshot.replyDrafts missing')
assert.ok(Array.isArray(snap.replyDrafts.items))

// 4) 源码契约：去回复 打开弹窗、发送走 reply_send（重入组件测不出点击，只能锁源码形态）。
const src = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
assert.ok(src.includes('function ReplyModal('), 'ReplyModal missing')
assert.ok(/op: 'reply_send'/.test(src), 'reply_send call missing')
assert.ok(/onReply: \(company\) => setReplyOpen\(company\)/.test(src), '去回复 must open the composer')

console.log('REPLY OK: queueReply → 0600 command file；空/超长被拦；快照带草稿；去回复走弹窗')

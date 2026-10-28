/**
 * 状态机一致性：面板（index.js markApproval）与 CLI（boss_approvals.py mark）必须对
 * 同一对 (from, to) 给出同样的结果。
 *
 * 为什么值得一条专门的测试：这两套规则曾经各写各的 —— CLI 只挡 sent→approved，
 * 一条 `mark --status pending` 就能把已发出的条目拉回待发队列再发一遍；
 * 而面板那套严格规则从来没被测过。
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { markApproval } from '../index.js'

const SCRIPT = '/Users/runking/.local/share/dsh-runtime/scripts/boss_approvals.py'
const STATUSES = ['pending', 'approved', 'sent', 'skipped', 'failed']

let ok = true
const check = (name, pass, extra = '') => {
  console.log((pass ? '✓ ' : '✗ ') + name + (pass ? '' : ' ' + extra))
  if (!pass) ok = false
}

function seed(status) {
  const dir = mkdtempSync(path.join(tmpdir(), 'boss-matrix-'))
  const item = {
    id: 'm1',
    company: '示例公司',
    jobTitle: '战斗策划',
    status,
    draft: '您好，做过敌人 AI，附一页拆解，发您看看。',
    draftHash: 'deadbeefdeadbeef',
  }
  writeFileSync(path.join(dir, 'boss_approvals.json'), JSON.stringify({ items: [item] }))
  return { dir, item }
}

function cliMark(status, to) {
  const { dir } = seed(status)
  const r = spawnSync('python3', [SCRIPT, 'mark', '--id', 'm1', '--status', to], {
    env: { ...process.env, BOSS_DATA_DIR: dir },
    encoding: 'utf8',
  })
  const allowed = r.status === 0 && /^MARK /m.test(r.stdout)
  rmSync(dir, { recursive: true, force: true })
  return { allowed, out: (r.stdout || r.stderr || '').trim() }
}

async function panelMark(status, to) {
  const { dir, item } = seed(status)
  try {
    await markApproval('m1', to, { dataDir: dir, draftHash: item.draftHash })
    return { allowed: true, out: '' }
  } catch (e) {
    return { allowed: false, out: `${e?.code || ''}: ${e?.message || e}` }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// 面板能落的状态只有这三个；sent/failed 由 runner/CLI 负责，不在面板可选项里。
const PANEL_TARGETS = ['pending', 'approved', 'skipped']

for (const from of STATUSES) {
  for (const to of PANEL_TARGETS) {
    const a = cliMark(from, to)
    const b = await panelMark(from, to)
    check(
      `${from} → ${to}：CLI 与面板一致（${a.allowed ? '允许' : '拒绝'}）`,
      a.allowed === b.allowed,
      `CLI=${a.allowed}(${a.out.slice(0, 60)}) 面板=${b.allowed}(${b.out.slice(0, 60)})`,
    )
  }
}

// sent 是终态：任何目标都必须被 CLI 拒绝（没有 --force 时）。
for (const to of STATUSES) {
  if (to === 'sent') continue
  const a = cliMark('sent', to)
  check(`sent → ${to}：CLI 拒绝（防重发）`, !a.allowed, a.out.slice(0, 80))
}

// 已经发过的条目在面板上也不能被改回任何状态（面板没有 sent 入口）。
for (const to of PANEL_TARGETS) {
  const b = await panelMark('sent', to)
  check(`sent → ${to}：面板拒绝`, !b.allowed, b.out.slice(0, 80))
}

console.log(ok ? 'MATRIX OK' : 'MATRIX INCOMPLETE')
process.exit(ok ? 0 : 1)

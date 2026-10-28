// 端到端：一条首触从「待决定」走到「已发出」，面板快照要跟着变。
// 覆盖 JS 宿主（buildSnapshot）与 Python 发送侧（boss_approvals.py）之间的契约，
// 这是此前唯一没有自动验证的一段（两边各自测过，合起来没测）。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import os, { tmpdir } from 'node:os'
import path from 'node:path'

const PY = process.env.BOSS_PY || 'python3'
const SCRIPT =
  process.env.BOSS_APPROVALS ||
  path.join(os.homedir(), '.local/share/dsh-runtime/scripts/boss_approvals.py')
const { buildSnapshot } = await import('../index.js')

const dir = await mkdtemp(path.join(tmpdir(), 'boss-e2e-'))
const run = (...args) =>
  execFileSync(PY, [SCRIPT, ...args], {
    env: { ...process.env, BOSS_DATA_DIR: dir },
    encoding: 'utf8',
  })

try {
  const item = {
    id: 'e2e-001',
    company: '示例科技',
    jobTitle: '战斗策划',
    salary: '20-30K',
    city: '上海',
    jobId: 'e2eJobId',
    tier: 'A',
    draft: '您好，看到岗位在做敌人 AI。我做过三种性格化战斗 AI，想先发一份拆解给您。',
    jdText: '负责怪物 AI 与行为树设计。',
  }
  const itemPath = path.join(dir, 'item.json')
  await import('node:fs/promises').then(({ writeFile }) =>
    writeFile(itemPath, JSON.stringify([item])),
  )
  run('add', '--json', itemPath)

  let snap = await buildSnapshot({ dataDir: dir })
  assert.equal(snap.approvals.stats.pending, 1, '新候选应落在待决定')
  assert.equal(snap.daily.todayOutreach, 0, '没发出去之前不算今天发出')

  run('mark', '--id', 'e2e-001', '--status', 'approved')
  snap = await buildSnapshot({ dataDir: dir })
  assert.equal(snap.approvals.stats.approved, 1, '面板点通过后应是待发出')

  const queuePath = path.join(dir, 'queue.json')
  const queued = JSON.parse(run('queue', '--out', queuePath))
  assert.equal(queued.queue, 1, '待发出的条目要进队列')
  const queue = JSON.parse(await readFile(queuePath, 'utf8'))
  assert.equal(queue[0].job, '战斗策划｜20-30K｜上海', '队列要带 job 字段（首触闸门要求）')
  assert.ok(queue[0].jd, '队列要带 jd 字段')

  const at = new Date().toISOString()
  const resultPath = path.join(dir, 'result.json')
  await import('node:fs/promises').then(({ writeFile }) =>
    writeFile(resultPath, JSON.stringify([{ id: 'e2e-001', status: 'sent', at }])),
  )
  run('settle', '--result', resultPath)

  snap = await buildSnapshot({ dataDir: dir })
  const sent = snap.approvals.items.find((x) => x.id === 'e2e-001')
  assert.equal(sent.status, 'sent', '结算后应是已发出')
  assert.equal(snap.approvals.stats.sent, 1)
  assert.equal(snap.daily.todayOutreach, 1, '今天发出要算上审批链发出的这一条')

  // —— TTL：批准 30 分钟后失效，必须退回「待决定」，不能隔夜偷发 ——
  const stale = { ...item, id: 'e2e-002', company: '示例网络', draft: '您好，想发一份战斗 AI 拆解给您看。' }
  const stalePath = path.join(dir, 'item2.json')
  await import('node:fs/promises').then(({ writeFile }) =>
    writeFile(stalePath, JSON.stringify([stale])),
  )
  run('add', '--json', stalePath)
  run('mark', '--id', 'e2e-002', '--status', 'approved')
  const { readFile: readF, writeFile: writeF } = await import('node:fs/promises')
  const file = path.join(dir, 'boss_approvals.json')
  const doc = JSON.parse(await readF(file, 'utf8'))
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  doc.items.find((x) => x.id === 'e2e-002').approvedAt = twoHoursAgo
  await writeF(file, JSON.stringify(doc))
  const expired = JSON.parse(run('queue', '--out', path.join(dir, 'queue2.json')))
  assert.equal(expired.queue, 0, '过期批准不能进队列')
  snap = await buildSnapshot({ dataDir: dir })
  assert.equal(
    snap.approvals.items.find((x) => x.id === 'e2e-002').status,
    'pending',
    '过期批准要退回待决定',
  )

  // —— 批准后草稿被改写：hash 对不上就不能发（防「发的不是我点的那版」）——
  run('mark', '--id', 'e2e-002', '--status', 'approved')
  const doc2 = JSON.parse(await readF(file, 'utf8'))
  doc2.items.find((x) => x.id === 'e2e-002').draft = '您好，这是批准之后偷偷改掉的一版文案。'
  await writeF(file, JSON.stringify(doc2))
  const changed = JSON.parse(run('queue', '--out', path.join(dir, 'queue3.json')))
  assert.equal(changed.queue, 0, '草稿改动后不能进队列')

  console.log('E2E OK: pending → approved → queue → sent → 今日发出=1；过期批准与改动草稿都被拦')
} finally {
  await rm(dir, { recursive: true, force: true })
}

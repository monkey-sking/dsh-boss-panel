// 端到端：一条首触从「待决定」走到「已发出」，面板快照要跟着变。
// 覆盖 JS 宿主（buildSnapshot）与 Python 发送侧（boss_approvals.py）之间的契约，
// 这是此前唯一没有自动验证的一段（两边各自测过，合起来没测）。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const PY = process.env.BOSS_PY || 'python3'
const SCRIPT =
  process.env.BOSS_APPROVALS ||
  '/Users/runking/.local/share/dsh-runtime/scripts/boss_approvals.py'
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

  console.log('E2E OK: pending → approved → queue → sent → 面板今日发出=1')
} finally {
  await rm(dir, { recursive: true, force: true })
}

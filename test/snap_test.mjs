// snap_test.mjs — 冒烟测试：buildSnapshot 对空数据目录和真实数据目录都不崩。
// 空目录这条是 CI 可用性的关键：没有本机求职数据时也必须能跑通。
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { buildSnapshot } from '../index.js'

const empty = await mkdtemp(path.join(tmpdir(), 'boss-snap-'))
try {
  const s = await buildSnapshot({ dataDir: empty })
  assert.equal(typeof s, 'object', 'buildSnapshot should return an object')
  assert.ok(Array.isArray(s.threads ?? []), 'threads should be an array')
  console.log('SNAP OK (empty dir): threads =', (s.threads ?? []).length)
} finally {
  await rm(empty, { recursive: true, force: true })
}

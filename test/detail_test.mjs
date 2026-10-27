// detail_test.mjs — 冒烟测试：buildDetail 对空数据目录返回结构完整，不崩、不返回 undefined。
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { buildDetail } from '../index.js'

const empty = await mkdtemp(path.join(tmpdir(), 'boss-detail-'))
try {
  const d = await buildDetail('__不存在的公司__', { dataDir: empty })
  assert.equal(typeof d, 'object', 'buildDetail should return an object')
  assert.ok(Array.isArray(d.msgs ?? []), 'msgs should be an array')
  console.log('DETAIL OK (empty dir): msgs =', (d.msgs ?? []).length)
} finally {
  await rm(empty, { recursive: true, force: true })
}

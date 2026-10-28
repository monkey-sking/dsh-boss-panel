// 元数据一致性：面板版本号在两个地方各写一份，漂了界面就会说错版本。
// 2026-10-29 实际漂过：package.json 0.3.0，界面已经改了好几轮。
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PANEL_VERSION } from '../index.js'

const root = path.dirname(new URL(import.meta.url).pathname) + '/..'
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf-8'))
assert.equal(pkg.version, PANEL_VERSION, `package.json ${pkg.version} ≠ PANEL_VERSION ${PANEL_VERSION}`)

// 快照必须带宿主信息：界面靠它区分「新代码」和「没重启的旧宿主」。
const { buildSnapshot } = await import('../index.js')
const snap = await buildSnapshot({ dataDir: path.join(root, 'test', 'fixtures', 'empty') })
assert.equal(snap.host.version, PANEL_VERSION)
assert.ok(Date.parse(snap.host.bootAt) > 0, 'bootAt 必须是可解析的时间')

console.log('META OK')

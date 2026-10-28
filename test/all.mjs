// 一次跑完所有测试：node test/all.mjs（或 npm test）。
// 之前是 shell for 循环，漏跑一个文件不会有任何提示；这里缺文件也算失败。
import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const dir = path.dirname(new URL(import.meta.url).pathname)
const files = (await readdir(dir))
  .filter((f) => f.endsWith('_test.mjs'))
  .sort()

if (!files.length) {
  console.error('NO_TESTS 没找到 *_test.mjs')
  process.exit(1)
}

const failed = []
for (const f of files) {
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(dir, f)], { stdio: 'inherit' })
    child.on('exit', (c) => resolve(c ?? 1))
    child.on('error', () => resolve(1))
  })
  if (code !== 0) failed.push(f)
}

console.log(`\n${files.length - failed.length}/${files.length} passed`)
if (failed.length) {
  console.error('FAILED:', failed.join(', '))
  process.exit(1)
}
console.log('ALL TESTS OK')

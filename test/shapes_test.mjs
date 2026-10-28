/**
 * 真实数据的脏形状：空字段、超长文案、UTC 与本地时间混用、薪资混进岗位名。
 * 这些都不是理论问题 —— 采集链路会把它们原样写进 boss_approvals.json。
 */
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildSnapshot, buildApprovalDetail } from '../index.js'

let ok = true
const check = (name, pass, extra = '') => {
  console.log((pass ? '✓ ' : '✗ ') + name + (pass ? '' : ' ' + extra))
  if (!pass) ok = false
}

const dir = mkdtempSync(path.join(tmpdir(), 'boss-shapes-'))
copyFileSync(new URL('./fixtures/shapes.json', import.meta.url), path.join(dir, 'boss_approvals.json'))

const snap = await buildSnapshot({ dataDir: dir })
const items = snap.approvals?.items ?? []
check('脏形状不崩、两条都在', items.length === 2, `got ${items.length}`)
const a = items.find((i) => i.id === 'shape-001')
check('空字段有 coverage 标记', a?.coverage && Object.values(a.coverage).includes(false))
check('齐全度是分数而不是空白', /^\d+\/\d+$/.test(String(a?.completeness || '')), String(a?.completeness))
check('超长草稿原样保留（截断交给 UI）', (a?.draft || '').length > 110)
check('界面不会拿到 undefined 公司名', items.every((i) => typeof i.company === 'string' && i.company.length > 0))
check('混用时间格式都能落到日期桶', (snap.recentDays || []).every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)))

const detail = await buildApprovalDetail('shape-001', { dataDir: dir })
check('详情缺字段时也有兜底对象', detail && detail.companyDetail && typeof detail.jdText === 'string')

rmSync(dir, { recursive: true, force: true })
console.log(ok ? 'SHAPES OK' : 'SHAPES INCOMPLETE')
process.exit(ok ? 0 : 1)

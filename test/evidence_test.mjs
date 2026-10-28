import { buildAgentAudit, interviewDateWarning, roleTrack } from '../index.js'
import fs from 'node:fs'

let fail = 0
const check = (name, pass, detail = '') => {
  console.log(`${pass ? 'OK  ' : 'FAIL'}  ${name}${pass ? '' : `  ${detail}`}`)
  if (!pass) fail++
}

const badDate = interviewDateWarning('周四 2026-10-30 14:00', '2026-10-30')
check('周字段与日期冲突', badDate.includes('实际是周五'), badDate)
check(
  'when/date 日期冲突',
  interviewDateWarning('2026-10-29 14:00', '2026-10-30').includes('when 写 2026-10-29'),
)
check(
  '一致日期不报警',
  interviewDateWarning('周四 2026-10-29 14:00', '2026-10-29') === '',
)

const clientSource = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
check(
  '日期冲突在面板顶部显示横幅',
  clientSource.includes("className: 'boss-conflict-banner'")
    && clientSource.includes('conflictInterviews.length'),
)

check('敌人 AI 轨道', roleTrack('敌人AI策划').code === 'GAME_AI')
check('研发工具轨道', roleTrack('UE技术策划（工具方向）').code === 'GAME_DEV_TOOL')
check('泛化战斗策划只待核实', roleTrack('战斗策划').code === 'NEEDS_JD')
check('泛化 UE 技术策划只待核实', roleTrack('UE技术策划').code === 'NEEDS_JD')
check('普通小游戏错配风险', roleTrack('休闲小游戏执行策划').code === 'MISMATCH')
check('AI 产品只标待核实', roleTrack('AI产品经理').code === 'AI_PRODUCT_VERIFY')

const audit = buildAgentAudit({
  threads: [
    { company: 'A', track: roleTrack('敌人AI策划') },
    { company: 'B', track: roleTrack('UE技术策划（工具方向）') },
    { company: 'C', track: roleTrack('休闲小游戏执行策划') },
    { company: 'D', track: roleTrack('AI产品经理') },
    { company: 'F', track: roleTrack('战斗策划') },
  ],
  interviews: [{ company: 'E', when: '周四 2026-10-30 14:00', date: '2026-10-30', dateWarning: '日期冲突' }],
  resumeVersions: {
    resumes: {
      '旧版.pdf': { track: 'GAME_AI', approved_for_send: false, review_required_reason: '旧版' },
      '已复核.pdf': { track: 'AI_PRODUCT', approved_for_send: true },
    },
  },
  factGateInstalled: true,
  resumeGateInstalled: true,
})
check('护栏汇总：轨道计数', audit.trackCounts.GAME_AI === 1 && audit.trackCounts.GAME_DEV_TOOL === 1)
check(
  '护栏汇总：错配与待核实',
  audit.trackCounts.MISMATCH === 1
    && audit.trackCounts.AI_PRODUCT_VERIFY === 1
    && audit.trackCounts.UNVERIFIED === 1,
)
check('护栏汇总：未复核简历阻断', audit.blockedResumes.length === 1 && audit.blockedResumes[0].name === '旧版.pdf')
check('护栏汇总：日程冲突', audit.scheduleConflicts.length === 1)

console.log(fail === 0 ? 'PASS evidence' : `FAIL evidence (${fail})`)
process.exit(fail === 0 ? 0 : 1)

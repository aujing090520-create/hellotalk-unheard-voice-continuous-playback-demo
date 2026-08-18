# 验收矩阵

| Area | Source | Required Checks | Result | Evidence |
| --- | --- | --- | --- | --- |
| Product goal | FR-001 | 从未听接收语音起连续播放后续未处理语音 | Pass | Playwright: 起播队列为 4 条，2.5 秒后为 3 条；`output/playwright/continuous-start-final.png` |
| Queue boundaries | FR-001 | 跳过已听、已转文字、删除与不可播放语音；点击其他语音重建队列 | Pass | 初始队列仅包含 voice-1/3/5/6；已听与已转文字语音可单条播放 |
| Playback state | FR-002 | 完整播放标记已听；暂停不跳下一条；退出会话停止 | Pass | Playwright: 暂停 2.6 秒后仍是当前条，退出后聊天列表路由存在 |
| Transcript and error | FR-003 | 转文字保留展示且跳过；失败跳过后续可继续 | Pass | Playwright: 5 秒后失败条已跳过，连续队列剩余 1 条；转文字可切换且文本保留 |
| Feature flag | FR-004 | 开关关闭时保持单条播放 | Pass | Playwright: 关闭后显示“单条播放”，2.5 秒后停止且无后续队列 |
| Page completeness | Route map | 使用 `chat.thread.default` 页面族；返回路径回聊天列表 | Pass | 聊天线程与聊天列表均可进入、退出、重进；首页第一条真实聊天行可点击进入线程 |
| Visual system | Design system + extracted assets | 375x812、紧凑聊天、白色导航、紫色操作态；首页按真实切片拼接 | Pass | `output/playwright/linfan-redo-home-v3.png`、`output/playwright/linfan-redo-home-return-v3.png`、`output/playwright/linfan-redo-continuous-v3.png` |
| Visual fidelity | Packaged HelloTalk assets | 首页状态栏、顶部功能区、聊天行、底部 Tab 使用内置真实切片，不依赖技能目录或本机绝对路径 | Pass | `public/ht-assets/status_chat_home.png`、`chat_home_header.png`、`chat_home_row_1..6.png`、`bottom_tab_chat_active.png` |
| Review traceability | Demo workflow | Review 模式规则与界面双向定位，关闭后无残留 | Pass | Review 开启：4 条规则、5 个标记、4 条连线；FR-003 标记可选中规则；关闭后规则/标记/连线均为 0 |
| Robustness | Demo workflow | 无控制台错误、无布局溢出、主要操作可重复 | Pass | `npm run build`；Playwright console: 0 errors / 0 warnings；移动端 `scrollWidth = clientWidth` |

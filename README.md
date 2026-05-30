# 视频网站播放控制脚本

## 项目简介
这是一个 Tampermonkey 用户脚本，统一提供多站点视频快捷键控制，包含倍速、超限音量、全屏/剧场模式和 91Porn 的方向键控制。

## 脚本文件
- `video_play_control.user.js`

## 支持站点
- `https://www.youtube.com/*`
- `https://www.bilibili.com/video/*`
- `https://live.bilibili.com/*`
- `https://www.huya.com/*`
- `https://91porn.com/view_video.php*`
- `https://www.91porn.com/view_video.php*`

## 快捷键
| 按键 | 功能 | 站点范围 | 说明 |
|---|---|---|---|
| `+` / `=` | 提高播放速度 | 全部支持站点 | 按 `speedIncrement` 增加，受 `minSpeed/maxSpeed` 限制 |
| `-` / `_` | 降低播放速度 | 全部支持站点 | 按 `speedIncrement` 减少，受 `minSpeed/maxSpeed` 限制 |
| `]` | 提高超限音量 | 全部支持站点 | 仅在原生音量已到 100% 或已进入超限状态时生效 |
| `[` | 降低超限音量 | 全部支持站点 | 降到 `1x` 时自动回归原生音量链路 |
| `M` | 静音/取消静音 | 虎牙、B站直播、91Porn | 91Porn 直接切 `video.muted` |
| `F` | 全屏切换 | 虎牙、B站直播、91Porn | 91Porn 优先点击播放器内置全屏按钮，失败时回退原生全屏 |
| `P` | 剧场模式/网页全屏 | 虎牙、B站直播 | 虎牙触发网页全屏按钮；B站直播触发剧场模式按钮 |
| `ArrowLeft` | 后退 | 仅 91Porn | 每次后退 `seekStepSeconds` 秒 |
| `ArrowRight` | 前进 | 仅 91Porn | 每次前进 `seekStepSeconds` 秒 |
| `ArrowUp` | 增加音量 | 仅 91Porn | 每次增加 `volumeStep`，上限 100% |
| `ArrowDown` | 减少音量 | 仅 91Porn | 每次减少 `volumeStep`，下限 0% |
| `Space` | 播放/暂停 | 仅 91Porn | 切换当前视频播放状态 |

## 配置参数
`config` 位于脚本顶部，可直接修改：

| 参数名 | 说明 | 默认值 |
|---|---|---|
| `speedIncrement` | 倍速每次调整步进 | `0.25` |
| `seekStepSeconds` | 91Porn 左右方向键步进秒数 | `10` |
| `volumeStep` | 91Porn 上下方向键音量步进 | `0.1` |
| `minSpeed` | 最小播放速度 | `0.25` |
| `maxSpeed` | 最大播放速度 | `5.0` |
| `showNotification` | 是否显示屏幕通知 | `true` |
| `notificationDuration` | 通知显示时长（毫秒） | `1000` |

## 安装
1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 新建脚本并粘贴 `video_play_control.user.js` 内容后保存。
3. 打开支持站点的视频页面后自动生效。

## 行为说明
- 在 `input`、`textarea`、可编辑元素中不会响应快捷键，避免输入时误触发。
- 视频元素使用缓存查询，页面路由切换（如 YouTube）会重置缓存并重新初始化。
- 超限音量通过 Web Audio `GainNode` 实现，回落到 `1x` 时恢复原生音量路径。

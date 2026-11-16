# 几猫联网对战服务端（V54 / 协议 2.0）

V37「质量修复」服务器侧实现，V39 完成联机收尾，V53 完成数据安全与权威模拟收口。保留 V31/V32 的 JSON 协议与全部旧事件；
在 V36 的二进制快照、输入回放、延迟补偿、逐武器权威结算、比赛状态机、据点争夺、机器人
补位、安全边界、Profile 账号与指标之上，修复 ACK、真实 RTT、respawn/roundStart 武器字段、
roundEnd 据点分、未知模式、命令队列溢出、无输入滑行、全 bin 序列化与运维安全等问题。
V39 新增：profiles.json 单进程锁、浏览器双客户端 e2e（tools/test_v39_mp_e2e2.mjs）、
限速回归脆弱用例修正。

V53 新增：坏档隔离/有效备份恢复、锁心跳、单消息命令上限与审计限频、房间级隔离、
maps.json 损坏 fatal、共享 `packages/sim/movement.stepPlayer`、tick 基准模拟时钟、
有界输入追赶、XFF/代理校验、档案上限/TTL/IP 脱敏/武器等级校验、`shotRejected` 回带
`shotSeq`、慢漂移强制快照；服务器回归 64 + 31 + 110 项。

## 已实现

- **HTTP + WebSocket 同端口**（默认 9100）：/healthz、/metrics、/api/profile、可选静态托管。
- **协议 2.0**：join 携带 caps:['bin'] 时，服务器用 packages/net/protocol.js 的
  encodeSnapshot 发送 WebSocket 二进制快照；未声明的客户端继续收到旧 JSON snap。
  两种输入都支持：二进制 encodeInput（18 字节）或旧 JSON {t:'input',...}。
- **V37 ACK**：每个 30Hz 快照 tick，对每个 bin 客户端单独发送 10 字节的
  SALT_NET.encodeAck(tick, lastSimSeq) 小帧；快照本身仍是每房共享编码，JSON 客户端继续从
  snap.players[].seq/ack 读取 ack。
- **60Hz 模拟 / 30Hz 快照**（TICK_HZ=60、SNAP_HZ=30）。二进制快照按玩家变更增量，
  首个快照全量，之后每 2 秒强制一次全量以从丢包中恢复；JSON 快照保持全量兼容。
- **输入回放**：每名玩家缓存 <=120 条命令；seq 去重、乱序丢弃、命令速率限制；每个模拟步
  只消费一条。队列空时在 500ms 内重复上次的移动轴与视角，但 **buttons=0**（不会持续开火/
  换弹/跳）；超过 500ms 没有新输入则移动轴清零（视角保留），避免掉线滑行/踩点。
  队列满时**拒绝新命令**（不 shift 已接受命令，lastQueuedSeq 不推进），cmdDropped++。
  快照里的 seq/ack 是“已模拟到”的最新命令序号。
- **延迟补偿**：每名玩家保存最近 1 秒命中体姿态（位置/蹲姿）。每 2 秒用
  ws.ping(Buffer.from(String(Date.now()))) 测真实 RTT，ws.on('pong') 按 EWMA 0.7/0.3 更新
  p.rtt；开火时 rewindMs = clamp(p.rtt/2 + 100, 0, 250) 回滚目标位置做射线。客户端 ping.ts
  只用于显示/兼容（pong.clientRtt），不再作为回滚依据。命中事件带 lagcomp 毫秒数。
- **逐武器权威结算**：武器数据唯一来源 packages/data/weapons/*.json（六把：pac9 / smg /
  dmr / lmg / breaker12 / sidearm）。服务器校验武器 id、射速、弹匣、换弹时间、方向；结算
  伤害、距离衰减、护甲（最多吸收 65% 且消耗护甲）、爆头/四肢倍率、霰弹多弹丸、穿透。
- **比赛状态机**：warmup(默认 8s) -> live -> roundEnd(默认 8s) -> next；计时结束或比分到顶
  都结束回合；平分先进入一次加时（默认 60s），加时仍平分判平局。roundStart / overtime /
  roundEnd / score 等旧事件字段保留。V37 起 roundEnd.teams 是本模式比分（据点模式为据点分），
  击杀数单独放 roundEnd.kills；roundStart 与 respawn 额外携带当前玩家的
  slot/wpn/mag/reserve 及两把枪的 slots[]。
- **模式**：tdm（团队死斗）、chaos（大乱战）、domination（据点争夺：每图 3 个据点，
  占领/中立化/争夺，据点每秒给分，默认 200 分胜）。据点优先读地图 modePoints.domination，
  缺失时用中继站/区域中心/边界推导。join.mode 显式传入未知模式时返回
  error{code:'mode_unsupported'} 并关闭连接，不再静默回退 tdm；未传 mode 才默认 tdm。
- **机器人**：BOTS>0 时低人数补到 4v4（BOTS=8 为例）；BOTS=0 关闭（默认关闭，避免旧回归测试人数断言变化）。
  机器人使用同一套 sim 移动、简单避障寻路、同一套武器权威路径与 Command；名字 BOT-*，
  快照 bot:true，不写 Profile、不计真人排行。真人加入时会顶掉机器人。
- **安全**：Origin 白名单、名字/房间/模式白名单、消息大小上限、全局限速、每 IP 连接数上限、
  5 秒 join 超时、可选 PROFILE_TOKEN 加入令牌；MP_DEV_TOKEN 未配置时 dev 指令全部拒绝。
- **账号**：POST /api/profile 创建 token，GET /api/profile?token= 返回 XP/等级/解锁；
  server/profiles.json 改为**异步串行写队列**（fs.promises.writeFile 临时文件 + rename），
  合并短时间内的多次变更，避免 tick 线程同步全量写。联机击杀给 XP（普通 20 / 爆头 30）。
- **单进程保护（V39）**：启动时对 PROFILES_FILE 用 `wx` 原子创建 `<PROFILES_FILE>.lock`，
  内容为 `{pid, at/time, token, file}`。同一 PROFILES_FILE 已有锁且未超过 30 秒时，第二个
  server.cjs 实例打印 `[fatal] PROFILES_FILE 已被另一个实例占用，拒绝启动（单进程保护）`
  并以 exit=1 退出；锁的 at/time 超过 30 秒视为陈旧（例如旧进程被 SIGKILL），新实例会
  重新核对 token/inode 后回收并接管。SIGTERM/SIGINT/正常退出会删除自己持有的锁，避免
  两个进程同时内存写同一个 profiles.json。
- **可观测性**：/healthz 扩展（协议、tick/快照率、真人/机器人、房间状态、指标摘要），
  roomsDetail 仅在 ?detail=1 或内网（回环/RFC1918）时返回；/metrics Prometheus 文本
  （tick_ms、tick_ms_p99、snap_kbps、players、rooms、lagcomp_hits、ACK、队列丢弃、
  被拒射击、审计、速率限制等）。设置 METRICS_TOKEN 后 /metrics 必须带
  ?token= 或 Authorization: Bearer；未设置时仅 127.0.0.1 可访问。
- **CORS**：JSON 响应不再默认下发 Access-Control-Allow-Origin: *；按 ORIGIN_WHITELIST
  回显具体 Origin，未授权 Origin/无 Origin 不下发 ACAO。
- **性能**：快照广播先探测接收者类型；房间内所有玩家都是 bin 客户端时跳过
  room.snapshot()/JSON.stringify，仅编码一次二进制增量（ACK 另发小帧）。
- **健壮性**：单步模拟异常被捕获并记录，进程不退出；最后一名真人离开时机器人一并清理并释放房间；
  SIGTERM 保存 Profile 后优雅退出。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| PORT / HOST | 9100 / 0.0.0.0 | 监听地址 |
| TICK_HZ | 60 | 模拟频率（20–120）。旧 unit 若写死 30，需要删掉或改 60 才能得到 60/30 |
| SNAP_HZ | 30 | 快照频率（5–TICK_HZ） |
| MAX_PLAYERS | 12 | 每房间硬上限（还会与模式上限取小） |
| MAX_ROOMS | 128 | 房间总数上限 |
| MAX_CONNS_PER_IP | 32 | 每 IP WebSocket 连接上限 |
| MAX_MSG_RATE | 240 | 每玩家每秒消息上限 |
| MAX_CMD_RATE | 240 | 每玩家每秒命令上限 |
| MAX_CMD_QUEUE | 120 | 每玩家命令队列深度 |
| MAX_MESSAGE_BYTES | 16384 | 单条消息/WS 载荷上限（超大消息断开） |
| JOIN_TIMEOUT_MS | 5000 | 未 join 连接超时 |
| RESPAWN_MS | 3000 | 死亡重生时间 |
| WARMUP_SECONDS | 8 | 热身时长。兼容规则：未显式设置且设置了 ROUND_SECONDS 时按 0 处理（旧回合测试） |
| ROUND_SECONDS | 0 | 覆盖模式回合秒数；0 = 模式默认（tdm 300 / chaos 360 / domination 300） |
| SCORE_LIMIT | 0 | 覆盖模式比分上限；0 = 模式默认（tdm 50 / chaos 75 / domination 200） |
| OVERTIME_SECONDS | 60 | 平分加时长度 |
| ROUND_END_MS | 8000 | 回合结束到下一回合的窗口 |
| BOTS | 0 | 机器人补位：0 关闭；>0 时补到 4v4（BOTS=8 为例，受模式/MAX_PLAYERS 限制） |
| BOT_SKILL | 1 | 机器人难度 0/1/2（反应时间与瞄准误差） |
| DOM_CAPTURE_SECONDS | 6 | 单点占领时间（多人加速，最多 3 倍） |
| DOM_SCORE_INTERVAL_MS | 1000 | 每个已占点给分间隔（默认每秒 1 分） |
| DOM_SCORE_LIMIT | 200 | 据点模式胜利分数 |
| MP_DEV_TOKEN | 未设置 | 未设置时所有 dev 指令拒绝；设置后消息需携带相同 token |
| PROFILE_TOKEN | 未设置 | 设置后 join 必须携带相同 token（访问令牌，非玩家账号 token） |
| METRICS_TOKEN | 未设置 | 设置后 /metrics 需要 ?token=、X-Metrics-Token 或 Authorization: Bearer；未设置时仅 127.0.0.1 可访问 |
| ORIGIN_WHITELIST | 空 | 逗号分隔的允许 Origin。空 = 浏览器同 Host / localhost；非浏览器客户端无 Origin 直接放行 |
| TRUST_PROXY | 0 | 为 1 时从 X-Forwarded-For 取 IP（仅在前置可信反代后开启） |
| LOG_JSON | 0 | 1 输出 JSON 行日志 |
| MAP_DATA_DIR | ../packages/data/maps | 四张图玩法数据目录 |
| WEAPON_DATA_DIR | ../packages/data/weapons | 武器数据目录 |
| PROFILES_FILE | server/profiles.json | Profile 存储文件；生产需可写并纳入备份。同目录会创建 `<PROFILES_FILE>.lock`（单进程锁，stale 30s） |
| MAPS_FILE / MAP_FILE | maps.json / map_boxes.json | 地图回退数据 |
| STATIC_DIR | 未设置 | 可选静态托管目录 |

## 协议

握手：join 可带 caps:['bin']、loadout:{primary,secondary}、profileToken、token。
welcome 始终是 JSON，包含旧字段并新增：nid（二进制快照里的数值 id）、protocol:2、
caps、binary、state、snapRate、warmupSeconds、weapons、loadout、map.domination。
welcome.players 与快照里的机器人带 bot:true 和 nid。

客户端 -> 服务器（缩进即代码块）：

    {t:"join", name?, room?, map?, mode?, team?, token?, caps?, loadout?, profileToken?}
    {t:"input", seq, tick?, move:{x,y} | mx,my, yaw, pitch, jump?, sprint?, crouch?, ads?, buttons?, slot?}
    {t:"input", cmds:[{seq,tick,mx,my,yaw,pitch,buttons,slot}, ...]}   // 冗余抗丢包
    二进制输入：SALT_NET.encodeInput({seq,tick,mx,my,yaw,pitch,buttons,slot})  // 18B
    {t:"fire", dir:{x,y,z}, wpn?}
    {t:"reload"}  {t:"switch", slot:0|1}  {t:"vote", map}  {t:"ping", ts}
    {t:"dev", token, cmd:"tp"|"round"|"live"|"team", x?, z?, y?, team?}
    {t:"leave"}

服务器 -> 客户端（旧事件字段不删）：

    {t:"welcome", id, nid, name, room, roomKey, mapId, mode, state, protocol, caps, binary,
     tick, tickRate, snapRate, team, serverTime, warmupSeconds, weapons, loadout, map, players}
    {t:"snap", tick, ts, serverTime, state, players:[{id,nid,name,x,y,z,yaw,pitch,hp,armor,
     alive,team,kills,deaths,onGround,crouch,sprinting,spawnProtect,seq,ack,ping,bot,wpn,mag,reserve,reloading}]}
    二进制快照：SALT_NET.encodeSnapshot(tick,baseline,players,prev)（首帧 baseline=0 全量，
    之后仅变化玩家；每 2 秒强制全量；id 为 nid；seq 仍是 ack 的低 8 位）
    二进制 ACK：SALT_NET.encodeAck(tick,lastSimSeq)（10B，type=5；每个快照 tick 单独发给
    每个 bin 客户端，不参与快照增量判定）
    {t:"fire", by, name, wpn, slot, origin, dir, ammo, reserve, pellets, hits, raw, lagcomp, bot}
    {t:"hit", by, victim, dmg, raw, absorbed, hp, armor, part, hs, wpn, dist, lagcomp, point, from, bot}
    {t:"kill", by, victim, hs, wpn, byName, victimName, team, dist, lagcomp, bot, victimBot, warmup}
    {t:"reloadStart"|"reloadDone"|"reloadDenied"|"shotRejected", ...}
    {t:"score", timeLeft, overtime, mapId, mode, state, teams, kills, cmdDropped, points, players}
    {t:"roundStart", teams, kills, mapId, mode, state, slot, wpn, mag, reserve, slots}
    {t:"roundEnd", winnerTeam, teams, score, kills, winner, reason, draw, mapId, mode, points}
    {t:"overtime", seconds, teams, mapId, mode, state}
    {t:"matchState", state, timeLeft, overtime, teams, kills, points, warmupSeconds}
    {t:"pointCaptured"|"pointNeutralized"|"domination", ...}
    {t:"join", player, bot?}  {t:"leave", id, bot?}  {t:"error", code, message}
    {t:"respawn", id, x, y, z, yaw, hp, armor, slot, wpn, mag, reserve, slots}
    {t:"weapon", id, slot, wpn, mag, reserve, slots}       // 换枪统一广播
    {t:"weaponSwitch", ...同上}                             // 旧客户端兼容别名
    {t:"teamChange"|"voteStart"|"mapChange"|"pong", ...}

说明：

- join.caps 不含 bin 时服务器不会向该连接发送二进制帧；客户端仍可发送二进制输入。
- 二进制快照的 baseline 是上次发送快照的 tick；客户端按 welcome.players[].nid 映射到字符串 id。
  服务器每 2 秒发一次 baseline=0 的全量帧；丢包导致的增量链断裂最迟 2 秒恢复。
- snap.players[].seq / 二进制 seq 是 **已模拟到的命令 seq**（ack），不是“已收到”。
- **ACK**：bin 客户端每个快照 tick 会额外收到一个二进制 ACK 帧：
  type=5, version=2, tick u32, seq u32（10 字节，SALT_NET.decodeAck）。seq 是服务器
  “已模拟到”的最后一个命令，不是“已收到”。JSON 客户端继续读 snap.players[].seq/ack。
- 无命令时 500ms 内重复移动轴但按钮清零；超过 500ms 移动轴也清零（视角保留），因此
  按住开火后停止发输入不会持续射击，掉线也不会滑行/踩点。
- 射速、弹药、换弹全部由服务器判定；fire 只是“该 tick 扣了扳机”的声明。方向必须与命令视角
  夹角 < 0.06rad，否则 shotRejected: aim_mismatch。
- 伤害字段：raw 是护甲前伤害，dmg 是实际扣血，absorbed 是被护甲吸收量。
- lagcomp = clamp(服务端实测 RTT/2 + 100, 0, 250) 毫秒；客户端 ping.ts 只回显为
  pong.clientRtt，不影响回滚。
- roundEnd.teams 是本模式比分（domination 为据点分），roundEnd.kills 是击杀数；
  roundEnd.score 与 teams 相同（旧字段兼容）。winnerTeam 为 0/1，平局 -1；
  reason 为 score/time/dev。
- respawn / roundStart 带 slot（当前槽位）、wpn、mag、reserve，以及
  slots:[{slot,wpn,mag,reserve},...]（当前两把枪）。客户端可直接写回本地武器状态。
- 换枪广播统一为 {t:'weapon', id, slot, wpn, mag, reserve, slots}；同时保留
  {t:'weaponSwitch', ...} 旧别名供旧客户端兼容。
- 旧客户端忽略新增事件即可；score.timeLeft 在加时期间是加时剩余秒数。

## HTTP API

    GET  /healthz                  # ok/tick/tickRate/snapRate/rooms/players/humans/bots/state/metrics
    GET  /healthz?detail=1         # 额外返回 roomsDetail（内网默认也返回）
    GET  /metrics                  # Prometheus text；METRICS_TOKEN 设置后需 token
    POST /api/profile              # {"name":"..."} -> {"ok":true,"token":"...","profile":{...}}
    GET  /api/profile?token=...    # {"ok":true,"profile":{uid,name,xp,level,unlocks,kills,deaths,...}}

Profile 等级：level = 1 + floor(sqrt(xp/100))，上限 50；解锁为外观/武器体验清单，
不提供数值付费内容。击杀普通 +20 XP、爆头 +30 XP。profiles.json 通过异步串行队列
file.tmp + rename 原子写（同一时刻只有一个写入者，后到变更合并成下一次写），
写入失败会记录 ioErrors 与错误日志，并清理临时文件。

## 指标

/metrics 关键行（Prometheus 文本）：

    saltline_tick_ms 0.048
    saltline_tick_ms_p99 0.403
    saltline_snap_kbps 41.7
    saltline_players 2
    saltline_humans 2
    saltline_bots 0
    saltline_rooms 1
    saltline_lagcomp_hits 1
    saltline_shots_rejected 12
    saltline_commands_dropped 8
    saltline_command_queue_full 8
    saltline_acks_sent 900
    saltline_json_snap_encodes 120
    saltline_audit_events 3
    saltline_rate_limited 160

另含 saltline_shot_reject_reason{reason=...} 与 saltline_audit_reason{reason=...} 计数器。
saltline_json_snap_encodes 可用于确认“全 bin 房间没有序列化 JSON 全量快照”。

## 测试

串行执行（都会起子进程，避免并发抢 CPU）：

    node tools/test_v39_mp_e2e.mjs # V39 浏览器双客户端 e2e + 单进程锁（约 1–2 分钟）
    node server/test_round.cjs     # 旧回归 31 项
    node server/test_net2.cjs      # V39 验收 87 项（57 旧 + 30 新增，保持 87）

test_net2.cjs 在随机端口启动 4 个子进程（核心 / 机器人 / 安全 / 运维），使用 JSON 与二进制
ws 客户端，覆盖：二进制解码与增量、逐客户端 ACK 小帧、seq/ack、乱序丢弃、蹲下/换枪增量、
无命令按钮归零、500ms 无输入停走、射速/弹药/换弹、武器 id 与方向校验、逐武器伤害、霰弹、
衰减、护甲、爆头、友军免伤、击杀队分与 XP、真实 RTT 回滚与伪造 ping.ts 防护、延迟补偿、
respawn/roundStart 武器字段、warmup 不计分、domination 占点得分与 roundEnd 据点分、bot
补位/移动/开火、未知模式报错、Origin/PROFILE_TOKEN/名字房间地图/消息大小与速率/CORS、
healthz roomsDetail、METRICS_TOKEN、命令队列溢出、全 bin 不序列化 JSON、Profile 并发
创建与异步串行原子写。消息限速用例改为按 1s 窗口小批发送（每次 260 条、最多 4 批），
不再一次灌 420 条跨窗口，避免 CI 慢机上窗口重置导致 rate_limited 偶发为 0。

`tools/test_v39_mp_e2e.mjs` 用 Playwright + 本仓库 game.html：

- 随机端口启动 `server/server.cjs`（`BOTS=0`、`MP_DEV_TOKEN=v39-e2e-dev-token`、
  `STATIC_DIR=仓库根`），页面走 `http://127.0.0.1:<port>/game.html`，避免 file://
  Origin 被安全策略拒绝；页面通过 `window.__MP_DEV_TOKEN` 使用 dev 指令。
- 两个页面**串行**加载（先等 A `window.__ready===true`，再加载 B），规避 SwiftShader
  并发导致的加载超时；每条等待失败都会先打印 `__ready/__fatal/__errors/__MP.state()/
  debug()/remotes()` 与服务端日志，然后 FAIL，不抛未捕获异常。
- 断言覆盖：双方接入同一 room、双方可见、自己不被当远端、二进制快照解码、id/nid 映射、
  dev 传送后位置同步、自动分队、开火命中（服务端 hit/扣血）、离开后远端删除、最后一人
  离开释放房间、无 pageerror；另验证锁创建、第二实例拒绝启动、主实例不受影响、stale
  锁回收、SIGTERM 优雅退出释放锁。

## 部署

V37 服务端依赖 packages/sim 与 packages/net/protocol.js，**不能只同步 server/**：

    rsync -az --exclude node_modules server/ nuc:~/fps-net/
    rsync -az --exclude node_modules packages/ nuc:~/fps-net/packages/
    ssh nuc 'systemctl --user daemon-reload && systemctl --user restart fps-mp'
    curl -s http://172.16.17.189:9100/healthz

systemd unit 需要同步调整（fps-mp.service 的变更不在本次 WP 的改动文件范围内，部署时手工处理）：

- 删除 Environment=TICK_HZ=30 或改为 TICK_HZ=60（否则模拟仍是 30Hz、快照也是 30Hz）。
- WorkingDirectory=/home/zhouyou/fps-net 下需有 packages/，且 profiles.json 可写。
- 生产建议增加：

      Environment=BOTS=8
      Environment=ORIGIN_WHITELIST=https://你的域名
      Environment=LOG_JSON=1
      Environment=METRICS_TOKEN=换成长随机串   # Prometheus 抓取用；不设则仅 127.0.0.1
      # EnvironmentFile=-/home/zhouyou/fps-net/mp-dev.env   # MP_DEV_TOKEN 联调用，勿入库

- 反向代理终止 TLS 后转发到 127.0.0.1:9100；ORIGIN_WHITELIST 必填你的站点 Origin。
  反代后服务端看到的源地址是回环，/metrics 与 /healthz 的“内网”判断会按回环处理；
  若要从公网抓指标，请设置 METRICS_TOKEN 并让抓取端带 token。
- CORS 现在按 ORIGIN_WHITELIST 回显具体 Origin；如果你的大厅页面与 WS 不同源，必须把页面
  Origin 加进白名单，否则浏览器拿不到 ACAO（WS 也会被 Origin 校验拒绝）。
- profiles.json 纳入每日备份；多 worker 时每个 worker 必须使用独立 PROFILES_FILE 或改共享存储，
  当前实现仍是单进程内存 + 单文件。异步写队列只保证单进程内串行与原子替换。
- **不要用同一个 PROFILES_FILE 启动两个 server.cjs**：V39 起第二个实例会被
  `<PROFILES_FILE>.lock` 拒绝（exit=1）。确认旧进程已退出但仍残留锁时，删除该 .lock 或
  等待 30 秒让新实例自动回收；不要手工删除一个仍在运行实例的锁。

**升级注意**：

- TICK_HZ 默认从 30 改为 60；依赖旧 30Hz 数值的运维脚本请显式设置 TICK_HZ=30。
- WARMUP_SECONDS 默认 8；如果只设置了 ROUND_SECONDS 而未设置 WARMUP_SECONDS，按 0 处理以兼容
  旧回合测试。线上要热身请显式写 WARMUP_SECONDS=8。
- BOTS 默认 0（关闭）。要 4v4 补位请设 BOTS=8；机器人会顶替真人，最后一名真人离开后房间立即释放。
- JSON 协议字段保持兼容；旧客户端可继续连接，只是拿不到二进制快照的带宽收益。
- 联机大厅客户端建议声明 caps:['bin'] 并用 nid 映射二进制快照；未声明时行为与 V31 一致。
- **V37 升级注意**：bin 客户端现在每个快照 tick 还会收到 type=5 的 10 字节 ACK 帧，
  客户端二进制消息循环必须先按首字节分发（SNAP=1 / ACK=5），不要直接把 ACK 丢给
  decodeSnapshot。客户端应优先使用 ACK.seq 做预测回滚，snap 内 seq 仍保留兼容。
- respawn/roundStart 新增 slot/wpn/mag/reserve/slots；客户端收到后应写回本地武器状态，
  否则换弹/换枪后的 HUD 可能与服务器不一致。
- 换枪事件以 t:'weapon' 为准，t:'weaponSwitch' 仅旧别名；新客户端只处理 weapon，
  或对两个事件做去重，避免重复音效。
- 未知模式不再回退 tdm：显式传错 mode 的客户端会收到 mode_unsupported 并断开；请从
  服务端 welcome/healthz 或本文档获取可用模式（tdm/chaos/domination）。
- 依赖客户端命令队列深度的旧脚本：队列满现在拒绝新命令而不是丢最旧命令，lastQueuedSeq
  不会因溢出跳到最新 seq。

## 已知限制

- 未实现 WebTransport 数据报（保留 WebSocket；二进制 + 输入冗余缓解队头阻塞）。
- 二进制增量以“服务器上次发送快照”为 baseline，未实现客户端逐包 ack 的精确 baseline；
  丢包最迟 2 秒由全量帧恢复。
- 未实现兴趣管理/反透视 PVS：快照发送房间内所有玩家。WP36-6 的可见性过滤仍是后续工作。
- 机器人寻路是射线采样避障（非导航网格），复杂拐角可能绕路；不参与 Profile 统计。
- 未做击杀回放、云存档、每日任务与匹配撮合；Profile 仅 XP/等级/解锁与战绩计数。
- TLS 由反向代理终止；服务自身不监听 wss。

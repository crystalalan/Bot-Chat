# 云端 / 常开设备部署说明

让 bot 在电脑关机后也能持续运行，需要把运行环境放到不随你关机停止的设备上：云服务器，或家里常年通电的设备（树莓派 / 软路由 / 旧手机 Termux）。以下以云服务器为例。

## 1. 环境准备

```bash
# 服务器上安装 Node 18+（建议 20 LTS）与 pm2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2
```

## 2. 上传项目

把本项目目录上传到服务器（git clone 或 scp），然后安装依赖：

```bash
cd bot-chat
npm install
cp .env.example .env        # 填入全部 API Key
cp config.example.json config.json   # 按需修改
mkdir -p knowledge logs     # 知识库目录与 pm2 日志目录
```

## 3. 迁移微信登录态（关键，避免异地重新扫码）

web 协议登录态保存在 `bot-chat.memory-card.json`。在**本机已扫码成功**的前提下，把该文件从本机拷到服务器的项目目录：

```bash
scp bot-chat.memory-card.json 用户名@服务器IP:/path/to/bot-chat/
```

若没有这个文件，服务器首次启动时扫码一次即可（之后 pm2 重启都不会再要求扫码）。

## 4. 启动并守护

```bash
pm2 start ecosystem.config.cjs    # 用项目自带的进程守护配置
pm2 save                          # 保存进程列表
pm2 startup                       # 按输出执行生成的命令，实现开机自启
pm2 logs bot-chat                 # 查看日志
pm2 restart bot-chat              # 手动重启
```

守护配置说明（`ecosystem.config.cjs`）：

- `autorestart: true`：进程崩溃或退出自动重启
- `restart_delay: 5000`：重启前等 5 秒，避免快速崩溃导致无限重启
- `max_memory_restart: '500M'`：内存超限自动重启
- 日志写入 `logs/bot.out.log` 与 `logs/bot.err.log`

## 5. 日常维护

- 微信登录态被微信端定期踢出时（web 协议特性），机器人会掉线但进程仍在运行。此时查看日志发现登录/登出记录后，需重新扫码：
  ```bash
  pm2 restart bot-chat -- --relogin   # 清除旧会话强制重新扫码
  pm2 logs bot-chat                   # 按提示扫码
  ```
- 服务器重启后 pm2 会自动拉起 bot，登录态由 memory-card 恢复，无需干预。

## 6. 关于协议与掉线的说明

- 本项目使用 wechaty web 协议（wechat4u）。微信会不定期踢出网页版登录，登录态一般维持几天到几周，掉线后需人工扫码。
- 若要求长期无人值守，可改用 iPad 协议（如 wechaty-puppet-padlocal，需购买 token），登录稳定、掉线率大幅降低。
- 任何非官方接入方式都有封号风险，建议使用小号运行。

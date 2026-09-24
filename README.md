# Northstar Blog

Northstar 是一个自托管、单管理员、内容优先的现代个人博客。前台、管理后台、SSR 页面与 API 都运行在同一个 Nuxt/Nitro Node.js 进程中；持久数据使用 MySQL 8，文件默认保存在本机目录。生产部署不需要 Docker。

## 功能

- Markdown 内容、草稿/发布/私密/定时发布、自动保存、版本快照与旧 URL 301
- 首次初始化、Argon2id 密码、数据库会话、HttpOnly Cookie、CSRF、登录与评论限速
- 评论提交和审核、媒体库、图片 EXIF 清理与 WebP 转换、统一存储接口
- MySQL FULLTEXT 索引与短关键词回退搜索
- SSR、SEO 元数据、Sitemap、robots.txt、RSS、Atom、JSON Feed、llms.txt 与公开 Markdown
- 响应式前台和后台、Light/Dark/System 外观、PWA Manifest
- 数据模型涵盖分类、标签、系列、导航、友链、跳转、统计聚合和备份记录
- mysqldump 数据库备份、上传目录归档、PM2 与 Nginx 示例

## 环境要求

- Node.js 22+（推荐 Node.js 24 LTS）
- pnpm 11+
- MySQL 8.0/8.4，字符集 `utf8mb4`
- 数据库备份需要系统 PATH 中存在 `mysqldump`

## 快速开始

```bash
pnpm install --frozen-lockfile
cp .env.example .env
# 在 .env 中设置独立的数据库密码、SESSION_SECRET 和 ENCRYPTION_SECRET。
pnpm db:migrate
# 首次运行 seed 前，另行在当前 shell 或 Secret Manager 设置 SEED_ADMIN_PASSWORD（至少 12 位）。
pnpm db:seed
pnpm dev
```

打开 `http://localhost:3000`。若未执行 seed，访问 `http://localhost:3000/admin/setup` 创建唯一管理员；一旦管理员存在，该入口自动关闭。Seed 使用 `admin@example.com` 作为示例管理员邮箱，首次创建管理员时必须由部署者提供 `SEED_ADMIN_PASSWORD`；源码不包含默认密码，也不会输出密码。已有管理员不会被 seed 重置。

## MySQL 初始化

使用具备创建用户权限的 MySQL 管理账号执行：

```sql
CREATE DATABASE northstar_blog CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'blog_user'@'127.0.0.1' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON northstar_blog.* TO 'blog_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

然后配置：

```text
DATABASE_URL=mysql://blog_user:password@127.0.0.1:3306/northstar_blog
```

密码中的特殊字符需要 URL 编码。应用内部和数据库连接均使用 UTC；显示时区由 `SITE_TIMEZONE` 控制。

### 可选的开发数据库

`docker-compose.dev.yml` **仅用于本地开发 MySQL，不用于生产部署**：

```bash
docker compose -f docker-compose.dev.yml up -d
```

已有本机 MySQL 时完全不需要 Docker。
运行上述开发数据库前，先在本机环境设置互不相同的 `BLOG_DEV_DB_PASSWORD` 与 `BLOG_DEV_ROOT_PASSWORD`；Compose 配置不包含固定密码。应用 `.env` 中的 `DATABASE_URL` 密码须与前者一致。不要把本机 `.env` 提交到 Git。

## 环境变量

复制 `.env.example` 后，用密码管理器分别生成数据库密码、`SESSION_SECRET` 和 `ENCRYPTION_SECRET`，不要复用示例占位值或将真实值提交到仓库。两个应用密钥各至少 32 个随机字符，可分别运行以下命令生成：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`UPLOAD_DIR` 和 `BACKUP_DIR` 可使用绝对路径；Node 进程必须有读写权限。生产环境请设置正确的 `SITE_URL`，仅在可信 Nginx 后方运行时设置 `TRUST_PROXY=true`。S3 字段为兼容存储适配器预留；默认且完整可用的实现为 `STORAGE_DRIVER=local`。

## 数据库与升级

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

升级前先备份数据库和上传文件，拉取代码并执行 `pnpm install --frozen-lockfile && pnpm db:migrate && pnpm build`，最后平滑重启 Node 进程。数据库结构只通过 `prisma/migrations` 更新，应用启动不会偷偷改表。

## 生产部署（无 Docker）

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
NODE_ENV=production pnpm start
```

服务默认监听 `127.0.0.1:3000`。Windows PowerShell 可先执行 `$env:NODE_ENV='production'`。

### PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

PM2 不是运行依赖，直接 `pnpm start` 同样可用。

### systemd

```ini
[Unit]
Description=Northstar Blog
After=network.target mysql.service

[Service]
Type=simple
User=blog
WorkingDirectory=/srv/northstar
EnvironmentFile=/srv/northstar/.env
ExecStart=/usr/bin/node /srv/northstar/.output/server/index.mjs
Restart=on-failure
RestartSec=5
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
```

Nitro 会处理 SIGINT/SIGTERM，停止 Scheduler 并断开数据库连接。

### Nginx 与 HTTPS

复制 `deploy/nginx.conf`，修改域名后启用。它传递 Host、真实 IP 与协议头，并为构建资源设置长期缓存。使用 Certbot 或服务商证书启用 TLS，HTTPS 站点的 Session Cookie 自动使用 Secure。可在 Nginx 开启 gzip；若模块可用也可启用 Brotli。

## 备份与恢复

```bash
pnpm backup:db
pnpm backup:site
```

数据库备份调用标准 MySQL `mysqldump`，凭据由 `DATABASE_URL` 读取且不会出现在进程参数中。恢复：

```bash
mysql -h 127.0.0.1 -u blog_user -p northstar_blog < data/backups/database-YYYY-MM-DD-HHmm.sql
```

站点归档包含 Local Uploads 与环境变量参考。恢复上传时解压到 `UPLOAD_DIR`。备份目录不应放在公开 Web 根目录，建议同步到异机加密存储。

管理后台的「备份」页面会生成包含 `database.sql`、`metadata.json` 和（Local Storage 模式下）`uploads/` 的 ZIP；也可在「导入 / 导出」页迁移 JSON 内容与 Markdown。网页备份需要运行 Node 的机器已安装 MySQL Client Tools（提供 `mysqldump`），并在 PATH 中可执行；Windows 安装 MySQL Installer 的 MySQL Server/Client 工具，Linux 安装发行版的 `mysql-client`/`mariadb-client` 包。若 Node 在容器内运行，需在该运行环境中提供兼容的 `mysqldump`。缺少工具时页面会返回明确的配置错误。

恢复网页 ZIP 时先解压到临时目录，确认目标库与站点后运行：

```bash
mysql -h 127.0.0.1 -u blog_user -p northstar_blog < database.sql
```

Linux 可用 `unzip backup.zip -d /tmp/northstar-restore`；Windows 可用 PowerShell `Expand-Archive` 解压。Local Storage 部署将归档内的 `uploads/` 内容复制回配置的 `UPLOAD_DIR`，保留文件权限后重启 Node。S3 模式下备份不会下载桶对象，需另行用对象存储服务的生命周期/复制能力备份 Bucket。不要在未核对环境和数据库的情况下覆盖生产数据；建议先在隔离库演练恢复。

## 安全运维

- 生产环境必须使用 HTTPS、强随机 Secret、独立最小权限数据库用户，并限制 `.env` 权限。
- 上传文件随机命名、验证 MIME/扩展名、限制 25MB；Nginx 同步设置 `client_max_body_size 25m`。
- 管理 API 禁止缓存；安全响应头、CSP、点击劫持防护与输入校验默认启用。
- 定期更新依赖、检查 `/api/health`，并演练备份恢复。不要把 `data/`、`.env` 或数据库端口暴露到公网。

## 常用命令

```bash
pnpm dev
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm start
```

运行 E2E 时请使用隔离的测试数据库，并在运行进程的环境中设置 `DATABASE_URL`、`E2E_ADMIN_PASSWORD`；后者必须与该测试库中 `admin@example.com` 的密码一致。测试代码不会内置或输出该密码。

## 目录

- `pages/`, `components/`, `layouts/`：前台与管理后台
- `server/api/`, `server/routes/`, `server/utils/`：API、Feed、存储、安全和业务服务
- `prisma/`：Schema、Migration、Seed
- `scripts/`：数据库与站点备份
- `data/`：运行时上传、备份和临时文件（不提交）
- `deploy/`：Nginx 示例
- `tests/`：单元和端到端测试

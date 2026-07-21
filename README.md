# CodeDiff

在线代码差分比较工具 — 基于 Monaco Editor 的并行差分展示、一键分享、AES-256 加密。

<p align="center">
  <img src="https://img.shields.io/badge/Nuxt-4.4-00DC82?logo=nuxt.js" />
  <img src="https://img.shields.io/badge/Monaco-0.55-1E8BCB?logo=visualstudiocode" />
  <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflarepages" />
</p>

## 功能

- **并行差分** — Monaco Editor 并排 diff，语法高亮
- **一键分享** — AES-256-GCM 加密，密码嵌入 URL，无限文件数
- **有效期设置** — 1〜30 天，到期自动清理（JST 00:00）
- **压缩传输** — pako deflate 压缩后加密，节省 50〜80% 体积
- **分享履历** — 本地保存历史记录，可查看、复制、取消分享
- **权限保护** — 仅创建者可取消分享（owner token 验证）
- **拖拽上传** — 拖拽文件即可比较
- **多语言** — 日本語 / 中文 / English
- **深色模式** — 纯黑 `#000` 背景

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Nuxt 4 + Vue 3 |
| UI | Nuxt UI v4 (Tailwind CSS v4) |
| 编辑器 | Monaco Editor 0.55 |
| 数据库 | Cloudflare D1 |
| 托管 | Cloudflare Pages |
| 加密 | Web Crypto API (AES-256-GCM + PBKDF2) |
| 压缩 | pako (deflate) |
| 清理 | GitHub Actions (cron) |

## 本地开发

```bash
pnpm install
pnpm dev        # → http://localhost:4040
pnpm build      # → dist/
```

## 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `CRON_SECRET` | ✅ | 清理 API 的认证密钥 |
| `APP_URL` | ✅ | GitHub Actions 用，部署后的 URL |

```bash
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env
```

## 部署

### 1. 创建 D1 数据库

```bash
npx wrangler d1 create codediff-db
```

### 2. 配置 wrangler.toml

```toml
name = "codediff"
compatibility_date = "2025-07-15"

[[d1_databases]]
binding = "DB"
database_name = "codediff-db"
database_id = "your-database-id"
```

### 3. 创建 Pages 项目并部署

```bash
npx wrangler pages project create codediff --production-branch main
pnpm build
cd dist && npx wrangler pages deploy
```

Cloudflare Dashboard → Workers & Pages → `codediff` → Settings → Functions：
- **D1 database bindings** 添加 `DB` → `codediff-db`

### 4. 环境变量

Cloudflare Dashboard → `codediff` → Settings → Variables：

| Variable | Value |
|---|---|
| `CRON_SECRET` | `openssl rand -hex 32` |

### 5. GitHub Secrets

GitHub → Repository → Settings → Secrets and variables → Actions：

| Name | Value |
|---|---|
| `APP_URL` | Cloudflare Pages URL |
| `CRON_SECRET` | 同上 |

### 6. 验证

```bash
curl "http://localhost:4040/api/cleanup?secret=YOUR_CRON_SECRET"
```

## 项目结构

```
├── app.vue                           # 应用外壳（Header、语言切换、国旗图标）
├── nuxt.config.ts                    # Nuxt 配置（i18n、Nitro、CSS）
├── wrangler.toml                     # Cloudflare D1 绑定
│
├── pages/
│   ├── index.vue                     # 主编辑页面
│   └── view/[id].vue                 # 分享查看页面（含有效期倒计时）
│
├── components/
│   ├── MonacoDiffEditor.client.vue   # Monaco 差分编辑器
│   ├── ShareDialog.vue               # 分享对话框（文件选择、过期设置、分段上传）
│   ├── ShareHistoryModal.vue         # 分享履历对话框（查看/复制/取消）
│   └── DiffFileList.vue              # 侧边栏文件列表
│
├── composables/
│   ├── useDiff.ts                    # 文件状态管理（IndexedDB 持久化）
│   ├── useCrypto.ts                  # AES-256-GCM 加密/解密 + pako 压缩
│   └── useShareHistory.ts            # 分享履历管理（IndexedDB）
│
├── server/
│   ├── api/
│   │   ├── diff/create.post.ts       # 创建分享（分段支持）
│   │   ├── diff/[id].get.ts          # 获取分享
│   │   ├── diff/[id].delete.ts       # 删除分享（ownerToken 鉴权）
│   │   ├── diff/group/[shareGroup].get.ts  # 获取分段列表
│   │   └── cleanup.get.ts            # 定时清理（cron）
│   └── utils/
│       ├── db.ts                     # D1 数据库操作（含本地内存回退）
│       └── db-init.sql               # 初始 Schema
│
├── i18n/locales/
│   ├── ja.json                       # 日本語
│   ├── zh.json                       # 中文
│   └── en.json                       # English
│
├── assets/css/main.css               # 全局样式
│
├── layouts/
│   └── view.vue                      # 查看页布局
│
├── docs/
│   └── LANGUAGE-DROPDOWN.md          # 语言下拉组件文档
│
└── .github/workflows/
    └── cleanup.yml                   # 每日清理 (JST 00:00)
```

## 数据库 Schema

```sql
CREATE TABLE diffs (
  id              TEXT PRIMARY KEY,
  encrypted_data  TEXT NOT NULL,
  iv              TEXT NOT NULL,
  salt            TEXT NOT NULL,
  file_count      INTEGER DEFAULT 0,
  expires_at      TEXT,              -- ISO 8601 (JST 23:59:59)
  share_group     TEXT,              -- 分段分享组 ID
  segment_index   INTEGER DEFAULT 0, -- 分段索引
  total_segments  INTEGER DEFAULT 1, -- 总分段数
  owner_token     TEXT,              -- 创建者令牌（删除鉴权）
  created_at      TEXT DEFAULT (datetime('now'))
);
```

## 加密流程

```
原始 JSON 数据
  → pako.deflate() 压缩
  → AES-256-GCM 加密 (PBKDF2 派生密钥)
  → Base64 编码
  → 上传至 D1
```

## 分段分享

每个文件独立加密为一条数据库记录，同组分享共用 `share_group`：

```
文件列表 (N 个)
  ├─ 文件1 → 加密 → POST /api/diff/create (segmentIndex=0, shareGroup=xxx)
  ├─ 文件2 → 加密 → POST /api/diff/create (segmentIndex=1, shareGroup=xxx)
  └─ 文件3 → 加密 → POST /api/diff/create (segmentIndex=2, shareGroup=xxx)

查看时：
  GET /api/diff/:id → 发现 shareGroup
  GET /api/diff/group/:shareGroup → 拉取全部分段
  解密合并 → 完整文件列表
```

## 定期清理

每天 **JST 00:00 (UTC 15:00)** GitHub Actions 触发：

```
GitHub Actions (cron: 0 15 * * *)
  └─ curl /api/cleanup?secret=$CRON_SECRET
       └─ DELETE FROM diffs WHERE expires_at < now
```

过期时间存储为 JST 23:59:59（≈ UTC 14:59:59），确保清理时被正确删除。

## 许可证

MIT
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

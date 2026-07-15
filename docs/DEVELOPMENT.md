# CodeDiff - 在线代码差分高亮网站

## 项目概述

CodeDiff 是一个基于 **Nuxt 4** + **Cloudflare D1** 的在线代码差分对比高亮工具。支持左右并列同步滚动、一键生成加密分享链接、拖拽上传文件、多文件差分管理。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Nuxt | 4.x | 全栈框架 (SSR + API) |
| Vue | 3.5 | 前端 UI 框架 |
| @nuxt/ui | 4.x | UI 组件库 (基于 Tailwind CSS + Reka UI) |
| Monaco Editor | 0.55 | 代码编辑器 + 差分对比 |
| Cloudflare D1 | - | 分布式 SQLite 数据库 |
| @nuxthub/core | 0.10 | Nuxt ↔ Cloudflare 集成 |
| Web Crypto API | - | 客户端 AES-256-GCM 加密 |
| nanoid | 6.x | 唯一 ID 生成 |

## 项目结构

```
CodeDiff/
├── app.vue                    # 应用根组件
├── app.config.ts              # Nuxt UI 主题配置
├── nuxt.config.ts             # Nuxt 配置
├── wrangler.toml              # Cloudflare Wrangler 配置
├── package.json               # 依赖管理
├── tsconfig.json              # TypeScript 配置
│
├── pages/
│   ├── index.vue              # 主页 - 差分编辑器
│   └── view/
│       └── [id].vue           # 分享查看页 - 只读差分视图
│
├── components/
│   ├── AppHeader.vue          # 顶部导航栏 (标题/主题切换/分享)
│   ├── DiffFileList.vue       # 左侧文件列表侧边栏
│   ├── DiffViewer.vue         # 只读差分查看器 (带文件标签切换)
│   ├── MonacoDiffEditor.client.vue  # Monaco 编辑器封装 (客户端渲染)
│   └── ShareDialog.vue        # 分享对话框 (加密/生成链接)
│
├── composables/
│   ├── useDiff.ts             # 差分文件状态管理
│   └── useCrypto.ts           # 客户端加密/解密工具
│
├── types/
│   └── diff.ts                # TypeScript 类型定义
│
├── utils/
│   └── monaco-setup.ts        # Monaco Editor Worker 配置
│
├── server/
│   ├── api/
│   │   └── diff/
│   │       ├── create.post.ts # POST /api/diff/create - 创建分享
│   │       └── [id].get.ts    # GET /api/diff/[id] - 获取分享
│   └── utils/
│       └── db.ts              # D1 数据库初始化 & 访问
│
├── assets/
│   └── css/
│       └── main.css           # Tailwind CSS 导入
│
├── public/
│   └── favicon.svg            # 网站图标
│
└── docs/
    └── DEVELOPMENT.md         # 本开发文档
```

## 功能架构

### 1. 差分编辑器 (主页 `/`)

```
┌──────────┬──────────────────────────────────────────┐
│ 文件列表  │  [AppHeader: 标题 | 主题 | 添加 | 分享]   │
│          ├──────────────┬──────────────┬────────────┤
│ ┌──────┐ │  原始 路径    │  修改 路径    │            │
│ │文件1 │ │ [path input] │ [path input] │            │
│ │文件2 │ ├──────────────┼──────────────┤            │
│ │文件3 │ │              │              │            │
│ │  +   │ │  Monaco      │  Monaco      │            │
│ └──────┘ │  DiffEditor  │  DiffEditor  │            │
│          │  (可编辑)     │  (可编辑)     │            │
│          │              │              │            │
│          ├──────────────┴──────────────┴────────────┤
│          │  [拖拽区域: 支持从文件系统拖入代码文件]      │
└──────────┴──────────────────────────────────────────┘
```

**特性:**
- 左右并列 Monaco Editor，内建 diff 高亮
- 左右各自独立的路径输入框
- 同步滚动 (Monaco diff editor 内建)
- 可编辑左右两侧代码
- 支持拖拽 `.ts`, `.js`, `.py` 等文件到左右面板
- 支持点击上传按钮选择文件
- 语言根据文件扩展名自动识别

### 2. 分享机制

**流程图:**

```
用户点击「一键分享」
    │
    ▼
[客户端] 生成随机 16 位密码
    │
    ▼
[客户端] PBKDF2 派生 AES-256 密钥 (盐值随机)
    │
    ▼
[客户端] AES-256-GCM 加密差分数据 (IV 随机)
    │
    ▼
POST /api/diff/create
  Body: { encryptedData, iv, salt, fileCount }
    │
    ▼
[服务端] 生成 12 位 nanoid
[服务端] 存入 D1: id | encrypted_data | iv | salt | file_count | created_at
    │
    ▼
返回 { id, url: "/view/{id}" }
    │
    ▼
[客户端] 构建完整分享 URL:
  https://example.com/view/abc123#pwd=randomPassword
    │
    ▼
显示 URL + 复制按钮
```

**查看流程:**

```
被分享者打开 URL
    │
    ▼
GET /api/diff/{id}
    │
    ▼
[客户端] 从 URL hash 提取密码 (#pwd=xxx)
    │
    ▼
[客户端] 使用密码解密 AES-256-GCM 数据
    │
    ▼
渲染只读 Monaco Diff Editor
```

### 3. 安全模型

- **密码不在服务端**: 密码仅存在于 URL hash 片段中，不会发送到服务器
- **数据库加密存储**: D1 中仅存储加密后的数据，即使数据库泄露也无法解密
- **AES-256-GCM**: 认证加密，防篡改
- **PBKDF2 密钥派生**: 10 万次迭代，防暴力破解
- **随机盐值 + IV**: 每次加密使用新的随机值

> ⚠️ **安全提醒**: 密码嵌入 URL 意味着任何拥有完整链接的人都能查看内容。请通过安全渠道（如加密聊天）发送链接。

## 数据库设计 (Cloudflare D1)

```sql
CREATE TABLE IF NOT EXISTS diffs (
  id TEXT PRIMARY KEY,              -- nanoid 12 位唯一 ID
  encrypted_data TEXT NOT NULL,     -- Base64 编码的 AES-GCM 密文
  iv TEXT NOT NULL,                 -- Base64 编码的初始化向量
  salt TEXT NOT NULL,               -- Base64 编码的 PBKDF2 盐值
  file_count INTEGER NOT NULL DEFAULT 0,  -- 差分文件数量
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diffs_created_at ON diffs(created_at);
```

## API 文档

### POST /api/diff/create

创建新的代码差分分享。

**请求体:**
```json
{
  "encryptedData": "base64-encoded-ciphertext",
  "iv": "base64-encoded-iv",
  "salt": "base64-encoded-salt",
  "fileCount": 3
}
```

**响应:**
```json
{
  "id": "abc123def456",
  "url": "/view/abc123def456"
}
```

**错误响应:**
- `400` - 缺少必要字段
- `413` - 内容过大 (>500KB)

### GET /api/diff/[id]

获取差分数据（加密状态）。

**响应:**
```json
{
  "id": "abc123def456",
  "encryptedData": "base64-encoded-ciphertext",
  "iv": "base64-encoded-iv",
  "salt": "base64-encoded-salt",
  "fileCount": 3,
  "createdAt": "2025-07-15 12:00:00"
}
```

**错误响应:**
- `400` - 缺少 ID
- `404` - 差分不存在

## 类型定义

```typescript
interface DiffFile {
  id: string
  leftPath: string        // 原始文件路径
  rightPath: string       // 修改后文件路径
  leftContent: string     // 原始代码内容
  rightContent: string    // 修改后代码内容
  language: string        // Monaco 语言标识 (typescript, python, etc.)
}
```

支持的语言: `typescript`, `javascript`, `html`, `css`, `scss`, `json`, `xml`, `yaml`, `markdown`, `python`, `ruby`, `go`, `rust`, `java`, `kotlin`, `swift`, `c`, `cpp`, `csharp`, `php`, `sql`, `shell`, `dockerfile`, `ini`, `plaintext`

## 本地开发

### 环境要求

- **Node.js** >= 20.x
- **pnpm** >= 10.x
- **Wrangler** (Cloudflare CLI) >= 3.x

### 安装 & 启动

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 浏览器访问
open http://localhost:3000
```

### D1 本地调试

```bash
# 创建本地 D1 数据库
npx wrangler d1 create codediff-db

# 本地开发时, NuxtHub 会自动使用 wrangler.toml 中的 D1 配置
# D1 绑定名: DB
```

## 部署到 Cloudflare Pages

### 前置准备

1. 创建 Cloudflare D1 数据库:
```bash
npx wrangler d1 create codediff-db
```

2. 初始化数据库表:
```bash
npx wrangler d1 execute codediff-db --file=./server/utils/db-init.sql
```

### 部署步骤

```bash
# 1. 构建项目
pnpm run build

# 2. 部署到 Cloudflare Pages
npx wrangler pages deploy .output/public

# 3. 绑定 D1
npx wrangler pages deployment tail
```

或使用 NuxtHub 一键部署:

```bash
npx nuxthub deploy
```

### wrangler.toml 配置

```toml
name = "codediff"
compatibility_date = "2025-07-15"

[[d1_databases]]
binding = "DB"
database_name = "codediff-db"
database_id = "your-database-id"  # 替换为实际的 D1 ID
```

## 已知限制

1. **文件大小**: 单次分享总内容限制 ~500KB (D1 TEXT 字段限制)
2. **并发**: D1 免费版有请求限制
3. **密码安全**: 密码在 URL 中，任何拥有链接的人都能查看
4. **过期策略**: 当前未实现自动过期，需手动清理旧记录
5. **Monaco 体积**: 首次加载约 2-3MB，后续由浏览器缓存

## 未来改进

- [ ] 支持文件夹级别的差分 (上传整个文件夹)
- [ ] 添加行内 diff 模式 (unified view)
- [ ] 支持 Git diff 格式导入
- [ ] 添加过期时间设置
- [ ] 添加访问统计
- [ ] 支持更多编程语言语法高亮
- [ ] PWA 离线支持
- [ ] 代码片段嵌入 (iframe embed)

## 维护者

CodeDiff - MIT License

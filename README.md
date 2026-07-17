# CodeDiff

オンライン差分比較ツール — Monaco Editor を使った並列差分表示、ワンクリック共有、AES-256 暗号化。

<p align="center">
  <img src="https://img.shields.io/badge/Nuxt-4.4-00DC82?logo=nuxt.js" />
  <img src="https://img.shields.io/badge/Monaco-0.55-1E8BCB?logo=visualstudiocode" />
  <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflarepages" />
</p>

## 功能

- **並列差分** — Monaco Editor サイドバイサイド diff、シンタックスハイライト対応
- **ワンクリック共有** — AES-256-GCM 暗号化、URL にパスワード埋め込み
- **有効期限設定** — 1〜999 時間、期限切れ自動削除（GitHub Actions 毎日 0 時）
- **ドラッグ & ドロップ** — ファイルをドロップするだけ
- **多言語** — 日本語 / 中文 / English（cookie 永続化）
- **ダークモード** — 純黒 `#000` 背景

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Nuxt 4 + Vue 3 |
| UI | Nuxt UI v4 (Tailwind CSS) |
| エディター | Monaco Editor 0.55 |
| データベース | Cloudflare D1 |
| ホスティング | Cloudflare Pages |
| 暗号化 | Web Crypto API (AES-256-GCM) |
| 定期クリーンアップ | GitHub Actions (schedule) |

## 本地开发

```bash
# インストール
pnpm install

# 開発サーバー起動
pnpm dev        # → http://localhost:4040

# 本番ビルド
pnpm build      # 出力先: dist/
```

## 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `CRON_SECRET` | ✅ | クリーンアップ API の認証キー |
| `APP_URL` | ✅ | GitHub Actions 用。デプロイ先 URL |

```bash
# .env を作成（gitignore 済み）
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env
```

## デプロイ手順

### 1. Cloudflare D1 データベースを作成

```bash
# D1 データベース作成
npx wrangler d1 create codediff-db

# 出力例:
# ✅ Created database 'codediff-db' with id 630b1244-...
```

### 2. wrangler.toml に D1 バインディングを設定

```toml
name = "codediff"
compatibility_date = "2025-07-15"

[[d1_databases]]
binding = "DB"                    # コード内で event.context.cloudflare.env.DB で参照
database_name = "codediff-db"
database_id = "上記で作成した database_id"
```

### 3. Cloudflare Pages プロジェクト作成

```bash
# Pages プロジェクト作成（初回のみ）
npx wrangler pages project create codediff --production-branch main
```

### 4. デプロイ

```bash
pnpm build
cd dist && npx wrangler pages deploy
```

Cloudflare Dashboard → Workers & Pages → `codediff` → Settings → Functions：
- **D1 database bindings** に `DB` → `codediff-db` を追加

### 5. 環境変数を設定

Cloudflare Dashboard → `codediff` → Settings → Variables → **Add**:

| Variable | Value |
|---|---|
| `CRON_SECRET` | `openssl rand -hex 32` で生成した値 |

### 6. GitHub Secrets を設定

GitHub → Repository → Settings → Secrets and variables → Actions → **New repository secret**:

| Name | Value |
|---|---|
| `APP_URL` | Cloudflare Pages の URL（`https://codediff.pages.dev`） |
| `CRON_SECRET` | 手順 5 と同じ値 |

### 7. 動作確認

```bash
# ローカル
curl "http://localhost:4040/api/cleanup?secret=あなたのCRON_SECRET"

# 本番
curl "https://あなたのドメイン.pages.dev/api/cleanup?secret=あなたのCRON_SECRET"
```

正常なら `{"result":"ok","deleted":0,"now":"..."}` または `{"result":"skipped"}` が返る。

GitHub Actions → Actions → Daily Cleanup → **Run workflow** で手動実行も可能。

## プロジェクト構造

```
├── app.vue                    # アプリケーションシェル（ヘッダー、言語切替）
├── nuxt.config.ts             # Nuxt 設定（i18n、Nitro、Vite）
├── wrangler.toml              # Cloudflare D1 バインディング
│
├── pages/
│   ├── index.vue              # メイン編集画面
│   └── view/[id].vue          # 共有リンク表示画面
│
├── components/
│   ├── MonacoDiffEditor.client.vue  # Monaco 差分エディター
│   ├── ShareDialog.vue              # 共有モーダル
│   └── DiffFileList.vue             # サイドバーファイル一覧
│
├── composables/
│   ├── useDiff.ts             # ファイル状態管理（IndexedDB 永続化）
│   └── useCrypto.ts           # AES-256-GCM 暗号化 / 復号
│
├── server/
│   ├── api/
│   │   ├── diff/create.post.ts   # 共有リンク作成
│   │   ├── diff/[id].get.ts      # 共有リンク取得
│   │   └── cleanup.get.ts        # 期限切れ削除（cron）
│   └── utils/db.ts               # D1 データベース操作
│
├── i18n/locales/
│   ├── ja.json                # 日本語
│   ├── zh.json                # 中文
│   └── en.json                # English
│
└── .github/workflows/
    └── cleanup.yml            # 毎日 0 時クリーンアップ
```

## データベース

```sql
-- Cloudflare D1 (自動マイグレーション)
CREATE TABLE diffs (
  id            TEXT PRIMARY KEY,
  encrypted_data TEXT NOT NULL,
  iv            TEXT NOT NULL,
  salt          TEXT NOT NULL,
  file_count    INTEGER DEFAULT 0,
  expires_at    TEXT,         -- ISO 8601 期限
  created_at    TEXT DEFAULT (datetime('now'))
);
```

## クリーンアップ（定期削除）

毎日 **JST 00:00** に GitHub Actions が Cloudflare API を呼び出し、`expires_at` を過ぎたデータを削除：

```
GitHub Actions (cron: 0 15 * * *)
    │
    └─ curl /api/cleanup?secret=$CRON_SECRET
         │
         └─ DELETE FROM diffs WHERE expires_at < now
```

## ライセンス

MIT
npm install

# pnpm
pnpm install

# yarn
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

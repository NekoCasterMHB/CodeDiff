# CodeDiff

オンラインコード差分比較ツール — Monaco Editor による並列差分表示、ワンクリック共有、AES-256 暗号化。

<p align="center">
  <img src="https://img.shields.io/badge/Nuxt-4.4-00DC82?logo=nuxt.js" />
  <img src="https://img.shields.io/badge/Monaco-0.55-1E8BCB?logo=visualstudiocode" />
  <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflarepages" />
</p>

## 機能

- **並列差分** — Monaco Editor サイドバイサイド diff、シンタックスハイライト対応
- **ワンクリック共有** — AES-256-GCM 暗号化、URL にパスワード埋め込み、ファイル数無制限
- **有効期限設定** — 1〜30 日、期限切れ自動削除（JST 00:00）
- **圧縮転送** — pako deflate 圧縮後に暗号化、50〜80% 削減
- **共有履歴** — ローカルに保存、閲覧・コピー・共有解除が可能
- **権限保護** — 作成者のみ共有解除可能（owner token 検証）
- **ファイル毎分割** — 各ファイルを独立して暗号化・保存、理論上無制限
- **ドラッグ & ドロップ** — ファイルをドロップするだけ
- **多言語** — 日本語 / 中文 / English
- **ダークモード** — 純黒 `#000` 背景

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Nuxt 4 + Vue 3 |
| UI | Nuxt UI v4 (Tailwind CSS v4) |
| エディター | Monaco Editor 0.55 |
| データベース | Cloudflare D1 |
| ホスティング | Cloudflare Pages |
| 暗号化 | Web Crypto API (AES-256-GCM + PBKDF2) |
| 圧縮 | pako (deflate) |
| 定期クリーンアップ | GitHub Actions (cron) |

## ローカル開発

```bash
pnpm install
pnpm dev        # → http://localhost:4040
pnpm build      # → dist/
```

## 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `CRON_SECRET` | ✅ | クリーンアップ API の認証キー |
| `APP_URL` | ✅ | GitHub Actions 用。デプロイ先 URL |

```bash
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env
```

## デプロイ手順

### 1. D1 データベースを作成

```bash
npx wrangler d1 create codediff-db
```

### 2. wrangler.toml を設定

```toml
name = "codediff"
compatibility_date = "2025-07-15"

[[d1_databases]]
binding = "DB"
database_name = "codediff-db"
database_id = "your-database-id"
```

### 3. Pages プロジェクト作成 & デプロイ

```bash
npx wrangler pages project create codediff --production-branch main
pnpm build
cd dist && npx wrangler pages deploy
```

Cloudflare Dashboard → Workers & Pages → `codediff` → Settings → Functions：
- **D1 database bindings** に `DB` → `codediff-db` を追加

### 4. 環境変数を設定

Cloudflare Dashboard → `codediff` → Settings → Variables：

| Variable | Value |
|---|---|
| `CRON_SECRET` | `openssl rand -hex 32` で生成 |

### 5. GitHub Secrets を設定

GitHub → Repository → Settings → Secrets and variables → Actions：

| Name | Value |
|---|---|
| `APP_URL` | Cloudflare Pages の URL |
| `CRON_SECRET` | 上記と同じ値 |

### 6. 動作確認

```bash
curl "http://localhost:4040/api/cleanup?secret=YOUR_CRON_SECRET"
```

## プロジェクト構造

```
├── app.vue                           # アプリケーションシェル（ヘッダー、国旗アイコン、言語切替）
├── nuxt.config.ts                    # Nuxt 設定（i18n、Nitro、CSS）
├── wrangler.toml                     # Cloudflare D1 バインディング
│
├── pages/
│   ├── index.vue                     # メイン編集画面
│   └── view/[id].vue                 # 共有画面（有効期限カウントダウン、差分自動結合）
│
├── components/
│   ├── MonacoDiffEditor.client.vue   # Monaco 差分エディター
│   ├── ShareDialog.vue               # 共有モーダル（ファイル選択、gzip サイズ表示、分割アップロード）
│   ├── ShareHistoryModal.vue         # 共有履歴モーダル（確認ダイアログ付き削除）
│   └── DiffFileList.vue              # サイドバーファイル一覧
│
├── composables/
│   ├── useDiff.ts                    # ファイル状態管理（IndexedDB）
│   ├── useCrypto.ts                  # AES-256-GCM 暗号化/復号 + pako 圧縮
│   └── useShareHistory.ts            # 共有履歴管理（IndexedDB）
│
├── server/
│   ├── api/
│   │   ├── diff/create.post.ts       # 共有作成（分割アップロード対応）
│   │   ├── diff/[id].get.ts          # 共有取得
│   │   ├── diff/[id].delete.ts       # 共有削除（ownerToken 認証）
│   │   ├── diff/group/[shareGroup].get.ts  # セグメント一覧取得
│   │   └── cleanup.get.ts            # 定期クリーンアップ（cron）
│   └── utils/
│       ├── db.ts                     # D1 操作（ローカルメモリーフォールバック付き）
│       ├── db-init.sql               # 初期スキーマ
│       └── db-migrate.sql            # マイグレーション用
│
├── i18n/locales/
│   ├── ja.json                       # 日本語
│   ├── zh.json                       # 中文
│   └── en.json                       # English
│
├── assets/css/main.css               # グローバルスタイル
│
├── layouts/
│   └── view.vue                      # 共有画面用レイアウト
│
├── docs/
│   ├── DEVELOPMENT.md                # 開発ドキュメント
│   └── LANGUAGE-DROPDOWN.md          # 言語切替コンポーネントドキュメント
│
└── .github/workflows/
    └── cleanup.yml                   # 日次クリーンアップ (JST 00:00)
```

## データベース Schema

```sql
CREATE TABLE diffs (
  id              TEXT PRIMARY KEY,
  encrypted_data  TEXT NOT NULL,
  iv              TEXT NOT NULL,
  salt            TEXT NOT NULL,
  file_count      INTEGER DEFAULT 0,
  expires_at      TEXT,              -- ISO 8601 (JST 23:59:59)
  share_group     TEXT,              -- 分割共有グループ ID
  segment_index   INTEGER DEFAULT 0, -- セグメントインデックス
  total_segments  INTEGER DEFAULT 1, -- 総セグメント数
  owner_token     TEXT,              -- 作成者トークン（削除認証用）
  created_at      TEXT DEFAULT (datetime('now'))
);
```

## 暗号化フロー

```
元の JSON データ
  → pako.deflate() で圧縮
  → AES-256-GCM で暗号化 (PBKDF2 で鍵生成)
  → Base64 エンコード
  → D1 にアップロード
```

## 分割共有 (Segmented Sharing)

各ファイルを独立して暗号化し、同じ `share_group` でリンク：

```
ファイル一覧 (N 個)
  ├─ ファイル1 → 暗号化 → POST /api/diff/create (segmentIndex=0, shareGroup=xxx)
  ├─ ファイル2 → 暗号化 → POST /api/diff/create (segmentIndex=1, shareGroup=xxx)
  └─ ファイル3 → 暗号化 → POST /api/diff/create (segmentIndex=2, shareGroup=xxx)

閲覧時：
  GET /api/diff/:id → shareGroup を検出
  GET /api/diff/group/:shareGroup → 全セグメントを取得
  復号して結合 → 完全なファイル一覧
```

## ファイルサイズ制限

- 各ファイルは暗号化 + base64 後に **最大約 2MB**
- pako deflate 圧縮により、コード/テキストファイルは 50〜95% 削減
- UI 上で **gzip** バッジとして圧縮後サイズを表示
- 超過ファイルは自動的に選択不可

## 定期的クリーンアップ

毎日 **JST 00:00 (UTC 15:00)** GitHub Actions が実行：

```
GitHub Actions (cron: 0 15 * * *)
  └─ curl /api/cleanup?secret=$CRON_SECRET
       └─ DELETE FROM diffs WHERE expires_at < now
```

有効期限は JST 23:59:59（≈ UTC 14:59:59）として保存され、JST 00:00 のクリーンアップで確実に削除されます。

## ライセンス

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

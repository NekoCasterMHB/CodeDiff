# 機能計画：ユーザー認証 & コード注釈システム

> ステータス：**計画段階**（コード未着手）

## 概要

差分比較エディターにユーザー認証とコード注釈機能を追加し、共有された差分に対してチームメンバーがコメント・レビューできるようにする。

---

## 1. ユーザー認証システム

### 1.1 全体フロー

```
ユーザーがログインボタンをクリック
  → メールアドレス入力モーダル
  → Cloudflare Email Routing 経由で 6 桁検証コードを送信
  → 検証コード入力モーダル
  → 初回ログインなら「ユーザー名設定」モーダル
  → ログイン完了（Cookie / LocalStorage にセッション保存）
```

### 1.2 必要なコンポーネント

| コンポーネント | パス | 役割 |
|---|---|---|
| `LoginModal.vue` | `components/` | ログインUI（メール入力→コード入力→ユーザー名設定の3段階） |
| `UserMenu.vue` | `components/` | ヘッダーメニュー（ログイン状態表示、ログアウト） |

### 1.3 必要な Composable

| Composable | パス | 役割 |
|---|---|---|
| `useAuth.ts` | `composables/` | ログイン状態管理、セッション永続化、認証チェック |

### 1.4 必要な API エンドポイント

| メソッド | パス | 役割 |
|---|---|---|
| `POST` | `/api/auth/send-code` | メールアドレスを受け取り、検証コードを生成・送信 |
| `POST` | `/api/auth/verify` | 検証コードを検証、セッショントークンを発行 |
| `POST` | `/api/auth/set-username` | 初回ログイン時にユーザー名を設定 |
| `GET` | `/api/auth/me` | 現在のセッションからユーザー情報を取得 |

### 1.5 データベース（D1）変更

```sql
-- 新規テーブル
CREATE TABLE users (
  id         TEXT PRIMARY KEY,          -- UUID
  email      TEXT NOT NULL UNIQUE,      -- メールアドレス
  username   TEXT,                      -- ユーザー名（初回ログイン後設定）
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE verification_codes (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  code       TEXT NOT NULL,             -- 6 桁コード
  expires_at TEXT NOT NULL,             -- 有効期限（発行から10分）
  used       INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,          -- セッショントークン
  user_id    TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 1.6 Cloudflare Email Routing 設定

- Cloudflare Dashboard → Email → Email Routing を有効化
- カスタムドメインで `noreply@<ドメイン>` を作成
- Worker 内で `EmailMessage` API を使用して送信
- 検証コードは `crypto.randomInt(100000, 999999)` で生成

### 1.7 セッション管理

- ログイン成功時、サーバーがセッショントークンを発行
- クライアントは LocalStorage にトークンを保存
- 後続リクエストは `Authorization: Bearer <token>` ヘッダーで送信
- 閲覧ページ（`view/[id].vue`）ではログイン不要（匿名閲覧可）
- 注釈機能はログイン必須

### 1.8 ヘッダー UI 変更

```
[CodeDiff]                    🌙 | 🌐 | [ログイン] | GitHub
                                          ↓ (ログイン後)
                              🌙 | 🌐 | [👤 ユーザー名 ▼] | GitHub
                                               ├ プロフィール
                                               └ ログアウト
```

---

## 2. コード注釈システム

### 2.1 全体フロー

```
編集者 / 閲覧者がコード行を選択
  → 右クリック → コンテキストメニュー「注釈を追加」
  → 注釈モーダルが開く
      ┌─────────────────────────────┐
      │ 選択されたコード（読み取り専用）  │
      │─────────────────────────────│
      │ 📝 注釈テキスト（Textarea）    │
      │                             │
      │ [キャンセル]  [保存]         │
      └─────────────────────────────┘
  → 保存後、該当行に吹き出しアイコン 💬 表示
  → アイコンクリックで注釈内容をポップオーバー表示
  → ツールバーのトグルで注釈の表示/非表示を切替
```

### 2.2 必要なコンポーネント

| コンポーネント | パス | 役割 |
|---|---|---|
| `AnnotationModal.vue` | `components/` | 注釈追加モーダル（コード表示 + テキスト入力） |
| `AnnotationBubble.vue` | `components/` | コード行上の吹き出し（注釈アイコン + ポップオーバー） |
| `AnnotationToggle.vue` | `components/` | ツールバーの注釈表示ON/OFFスイッチ |

### 2.3 必要な API エンドポイント

| メソッド | パス | 役割 |
|---|---|---|
| `POST` | `/api/annotations` | 注釈を作成（要認証） |
| `GET` | `/api/annotations?diffId=xxx&fileId=xxx` | 差分ファイルの注釈一覧を取得 |
| `DELETE` | `/api/annotations/:id` | 自分の注釈を削除 |

### 2.4 データベース（D1）変更

```sql
CREATE TABLE annotations (
  id          TEXT PRIMARY KEY,           -- UUID
  diff_id     TEXT NOT NULL,              -- 紐づく共有 diff の ID
  file_id     TEXT NOT NULL,              -- 紐づくファイルの ID
  user_id     TEXT NOT NULL,              -- 作成者
  username    TEXT NOT NULL,              -- 表示用ユーザー名
  start_line  INTEGER NOT NULL,           -- 選択開始行
  end_line    INTEGER NOT NULL,           -- 選択終了行
  code_text   TEXT NOT NULL,              -- 選択されたコード全文
  comment     TEXT NOT NULL,              -- 注釈テキスト
  created_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_annotations_diff ON annotations(diff_id, file_id);
```

### 2.5 コンテキストメニュー

- 使用コンポーネント：[`UContextMenu`](https://ui.nuxt.com/docs/components/context-menu)
- Monaco Editor の `onContextMenu` イベントで選択範囲を取得
- メニュー項目：
  - **注釈を追加**（ログイン時のみ表示）
  - その他、Monaco 標準のコピー/貼り付けなど

```ts
// 擬似コード
editor.onContextMenu((e) => {
  const selection = editor.getSelection()
  if (selection && !selection.isEmpty()) {
    // コンテキストメニューに「注釈を追加」を表示
  }
})
```

### 2.6 注釈のレンダリング

- 注釈データは diff ページロード時に API から一括取得
- Monaco Editor の `deltaDecorations` を使用して、注釈がある行に装飾アイコンを表示
- アイコンは行番号の右側（glyph margin）に 💬 またはバッジを配置
- クリックで `contentWidget` を用いて吹き出しを表示

```ts
// 擬似コード
const decorations = annotations.map(a => ({
  range: new monaco.Range(a.startLine, 1, a.startLine, 1),
  options: {
    glyphMarginClassName: 'annotation-glyph',
    glyphMarginHoverMessage: { value: `${a.username}: ${a.comment}` },
  },
}))
editor.deltaDecorations([], decorations)
```

### 2.7 ツールバートグル

- 位置：差分エディター上部ツールバー（ファイル名の右側）
- `USwitch` または `UButton` + アイコンで実装
- 状態：`showAnnotations`（LocalStorage または reactive state）
- ON：注釈アイコン/吹き出しを表示
- OFF：注釈を非表示（データは保持）

---

## 3. データフロー図

```
┌─────────────┐     認証      ┌──────────────┐
│  LoginModal │ ────────────→ │ API /auth/*  │
└─────────────┘               └──────┬───────┘
                                     │
                              D1 users / sessions
                              / verification_codes
                                     
┌──────────────────┐   注釈CRUD   ┌──────────────────┐
│ UContextMenu     │ ──────────→ │ API /annotations │
│ AnnotationModal  │ ←────────── │                  │
│ AnnotationBubble │             └──────┬───────────┘
└──────────────────┘                    │
                                 D1 annotations
```

---

## 4. セキュリティ考慮事項

| 項目 | 対策 |
|---|---|
| 検証コードのブルートフォース | 10分有効期限 / 同一メール宛にレート制限 |
| セッショントークン | UUID v4 / 7日有効期限 / HTTPS 必須 |
| 注釈の削除 | 作成者のみ削除可能（owner チェック） |
| XSS | 注釈テキストの HTML エスケープ / Monaco の安全なレンダリング |
| スパム対策 | 同一 IP からの検証コード送信回数制限 |

---

## 5. 実装優先順位

1. **フェーズ 1**：認証基盤
   - `useAuth.ts` composable
   - `/api/auth/*` エンドポイント
   - `LoginModal.vue` + `UserMenu.vue`
   - D1 テーブル作成

2. **フェーズ 2**：注釈基盤
   - D1 `annotations` テーブル
   - `/api/annotations` CRUD エンドポイント
   - `AnnotationModal.vue`

3. **フェーズ 3**：注釈 UI
   - コンテキストメニュー統合
   - `AnnotationBubble.vue` + `deltaDecorations` レンダリング
   - ツールバートグル

4. **フェーズ 4**：仕上げ
   - エラーハンドリング / ローディング状態
   - テスト / ドキュメント更新

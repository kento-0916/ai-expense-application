# Phase 3 — Gemini APIの手動設定

APIキーはブラウザに公開しません。`NEXT_PUBLIC_` を付けず、ローカルの `.env.local` にだけ保存します。

## 1. APIキーを作成

Google AI StudioでGemini APIキーを作成します。キーはこのチャットへ貼り付けないでください。

## 2. `.env.local` に追記

`expense-application/.env.local` の末尾へ次の2行を追加します。

```dotenv
GEMINI_API_KEY=作成したAPIキー
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_MODEL` は実装時点の公式モデル一覧と料金を確認して変更できます。APIキーには `NEXT_PUBLIC_` を付けません。

## 3. 開発サーバーを再起動

環境変数は起動時に読み込まれます。開発サーバーを停止してから、次を実行します。

```powershell
npm run dev
```

## 4. 本番公開時

VercelのEnvironment Variablesに同じ `GEMINI_API_KEY` と `GEMINI_MODEL` を登録します。値をGitHubへコミットしたり、画面へ表示したりしません。

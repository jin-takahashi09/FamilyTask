# FamilyTask

家族向け共有タスク管理アプリです。  
カレンダーで「誰が・何を・いつまでに」を共有し、リアルタイム同期とアプリ内通知で進捗を追いかけられます。

---

## アプリケーション概要

FamilyTask は、家庭内のタスクをメンバー同士で依頼・完了できる Web アプリです。

家族内のタスクを、誰が・いつまでに行うのかを分かりやすく共有できるように制作しました。

- グループ（家族）単位でのタスク共有
- カレンダー上でのタスク管理・依頼・完了
- 依頼・完了・締切接近のアプリ内通知
- 複数端末でのリアルタイム反映
- PC / スマホ対応 UI

---

## 主な機能

| 機能 | 内容 |
| --- | --- |
| 認証 | Firebase Authentication（メール / パスワード） |
| プロフィール | 表示名・アバター（GCS 署名 URL） |
| グループ管理 | 作成 / 招待コード参加 / 切替 / 退出 / 削除 / 所有権移譲。複数グループ所属に対応 |
| カレンダー・タスク | 月表示・日別表示。自分用タスクと家族への依頼、担当者・締切・完了・並び替え |
| 繰り返しタスク | 日 / 週 / 月 / 年単位。シリーズ削除（単発 / 以降 / 全体）に対応 |
| 通知 | 依頼・完了・締切約30分前のアプリ内通知。既読 / 全既読 |
| リアルタイム同期 | Laravel Reverb により、タスク・メンバー・通知を複数端末へ即時反映 |

---

## 技術スタック

| 区分 | 技術 |
| --- | --- |
| フロントエンド | ![REACT](https://img.shields.io/badge/REACT-2F2F2F?style=for-the-badge&logo=react&logoColor=61DAFB) ![NEXT.JS](https://img.shields.io/badge/NEXT.JS-2F2F2F?style=for-the-badge&logo=nextdotjs&logoColor=white) ![TYPESCRIPT](https://img.shields.io/badge/TYPESCRIPT-2F2F2F?style=for-the-badge&logo=typescript&logoColor=3178C6) ![TAILWINDCSS](https://img.shields.io/badge/TAILWINDCSS-2F2F2F?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8) |
| バックエンド | ![LARAVEL](https://img.shields.io/badge/LARAVEL-2F2F2F?style=for-the-badge&logo=laravel&logoColor=FF2D20) ![PHP](https://img.shields.io/badge/PHP-2F2F2F?style=for-the-badge&logo=php&logoColor=777BB4) |
| ログイン | ![FIREBASEAUTHENTICATION](https://img.shields.io/badge/FIREBASE_AUTHENTICATION-2F2F2F?style=for-the-badge&logo=firebase&logoColor=FFCA28) |
| データベース | ![CLOUDFIRESTORE](https://img.shields.io/badge/CLOUD_FIRESTORE-2F2F2F?style=for-the-badge&logo=googlecloud&logoColor=4285F4) |
| プロフィール画像 | ![GOOGLECLOUDSTORAGE](https://img.shields.io/badge/GOOGLE_CLOUD_STORAGE-2F2F2F?style=for-the-badge&logo=googlecloud&logoColor=4285F4) |
| リアルタイム通信 | ![LARAVELREVERB](https://img.shields.io/badge/LARAVEL_REVERB-2F2F2F?style=for-the-badge&logo=laravel&logoColor=FF2D20) |
| 開発ツール | ![GIT](https://img.shields.io/badge/GIT-2F2F2F?style=for-the-badge&logo=git&logoColor=F05032) ![GITHUB](https://img.shields.io/badge/GITHUB-2F2F2F?style=for-the-badge&logo=github&logoColor=white) |

---

## アプリの画面

### PC

| メイン画面（カレンダー） | タスク作成 |
| :---: | :---: |
| <img src="docs/screenshots/pc-home-calendar.png" alt="PCメイン画面（カレンダー）" width="100%"> | <img src="docs/screenshots/pc-task-create.png" alt="PCタスク作成" width="100%"> |
| 通知 | グループ・メンバー管理 |
| <img src="docs/screenshots/pc-notifications.png" alt="PC通知" width="100%"> | <img src="docs/screenshots/pc-family-manage.png" alt="PCグループ・メンバー管理" width="100%"> |

### スマホ

| メイン画面（カレンダー） | タスク作成 |
| :---: | :---: |
| <img src="docs/screenshots/sp-home-calendar.png" alt="スマホメイン画面（カレンダー）" width="100%"> | <img src="docs/screenshots/sp-task-create.png" alt="スマホタスク作成" width="100%"> |
| 通知 | グループ・メンバー管理 |
| <img src="docs/screenshots/sp-notifications.png" alt="スマホ通知" width="100%"> | <img src="docs/screenshots/sp-family-manage.png" alt="スマホグループ・メンバー管理" width="100%"> |

---

## ローカル起動

### 前提

- Node.js / npm
- PHP 8.3+ / Composer
- Firebase プロジェクト（Authentication・Firestore）
- Firebase Admin SDK のサービスアカウント JSON
- （任意）GCS バケット — プロフィール画像用
- （任意）締切接近通知用にスケジューラ実行

### 1. フロントエンド

```bash
cp .env.local.example .env.local
# Firebase Web SDK / API URL / Reverb の公開設定を記入

npm install
npm run dev
# http://localhost:3000
```

### 2. API

```bash
cd api
cp .env.example .env
# APP_KEY, GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_STORAGE_BUCKET,
# REVERB_* などを記入

composer install
php artisan key:generate
touch database/database.sqlite
php artisan migrate

php artisan serve          # http://127.0.0.1:8000
php artisan reverb:start   # WebSocket :8087
```

締切接近通知を使う場合:

```bash
php artisan schedule:work
```

### 環境変数のポイント

| ファイル | 主な項目 |
| --- | --- |
| `.env.local` | `NEXT_PUBLIC_FIREBASE_*` / `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_REVERB_*` |
| `api/.env` | `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_STORAGE_BUCKET` / `REVERB_*` / `BROADCAST_CONNECTION=reverb` |

`FIREBASE_STORAGE_BUCKET` は GCS のバケット名です（Firebase Web SDK の `*.appspot.com` とは別）。

---

## 今後の展望

- Push通知の実装
- 通知設定のカスタマイズ
- タスク検索機能

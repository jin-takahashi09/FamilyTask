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

## 今後の展望

- Push通知の実装
- 通知設定のカスタマイズ
- タスク検索機能

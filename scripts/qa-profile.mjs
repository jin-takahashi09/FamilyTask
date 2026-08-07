/**
 * Profile QA – run: npm run qa:profile
 */
import {
  applySavedProfile,
  mergeFirestoreProfile,
  profileFormToApiPayload,
  resolveLocalProfileImage,
} from "../src/lib/profile-utils.ts";
import {
  isProfileImageWithinSizeLimit,
  PROFILE_IMAGE_MAX_INPUT_BYTES,
  PROFILE_IMAGE_MAX_LONG_EDGE,
  PROFILE_IMAGE_TOO_LARGE_MESSAGE,
  scaleProfileImageDimensions,
} from "../src/lib/profile-image.ts";

const results = [];

function record(item, pass, detail = "") {
  results.push({ item, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${item}${detail ? ` — ${detail}` : ""}`);
}

console.log("\n=== Profile QA ===\n");

console.log("## 1. API payload");
const payload = profileFormToApiPayload({
  displayName: "  テスト  ",
  profileImage: "data:image/png;base64,abc",
});
record("Base64画像はAPIへ送らない", payload.avatarType === "none");
record("avatarValueは空", payload.avatarValue === "");
record("displayNameはtrim", payload.displayName === "テスト");

console.log("\n## 2. Firestore→UserProfile");
const user = mergeFirestoreProfile(
  { uid: "uid-1", email: "a@example.com" },
  {
    uid: "uid-1",
    email: "a@example.com",
    displayName: "ユーザーA",
    avatarType: "none",
    avatarValue: "",
    createdAt: "2026-01-01T00:00:00+00:00",
    updatedAt: "2026-01-01T00:00:00+00:00",
  },
  [
    {
      id: "uid-1",
      email: "a@example.com",
      displayName: "旧名",
      profileImage: "data:image/png;base64,local",
      profileCompleted: false,
    },
  ],
);
record("FirestoreのdisplayNameを使用", user.displayName === "ユーザーA");
record("profileCompleted=true", user.profileCompleted === true);
record(
  "localStorageの画像を維持",
  user.profileImage === "data:image/png;base64,local",
);

console.log("\n## 3. 未設定プロフィール");
const missing = mergeFirestoreProfile(
  { uid: "uid-2", email: "b@example.com" },
  null,
  [],
);
record("未設定はprofileCompleted=false", missing.profileCompleted === false);
record("自動移行しない", missing.displayName === "");

console.log("\n## 4. 保存後マージ");
const saved = applySavedProfile(
  {
    id: "uid-1",
    email: "a@example.com",
    displayName: "",
    profileImage: null,
    profileCompleted: false,
  },
  {
    displayName: "新しい名前",
    profileImage: "data:image/png;base64,new",
  },
  {
    uid: "uid-1",
    email: "a@example.com",
    displayName: "新しい名前",
    avatarType: "none",
    avatarValue: "",
    createdAt: "2026-01-01T00:00:00+00:00",
    updatedAt: "2026-01-02T00:00:00+00:00",
  },
  true,
);
record("保存後にprofileCompleted=true", saved.profileCompleted === true);
record(
  "localStorage向け画像を保持",
  saved.profileImage === "data:image/png;base64,new",
);

console.log("\n## 5. local画像解決");
record(
  "同一UIDのlocal画像のみ取得",
  resolveLocalProfileImage("uid-1", [
    {
      id: "uid-1",
      email: "a@example.com",
      displayName: "A",
      profileImage: "data:image/png;base64,keep",
      profileCompleted: true,
    },
    {
      id: "uid-2",
      email: "b@example.com",
      displayName: "B",
      profileImage: "data:image/png;base64,ignore",
      profileCompleted: true,
    },
  ]) === "data:image/png;base64,keep",
);

console.log("\n## 6. プロフィール画像サイズ制限");
record(
  "入力上限は10MB",
  PROFILE_IMAGE_MAX_INPUT_BYTES === 10 * 1024 * 1024,
);
record(
  "2MB超えは許可",
  isProfileImageWithinSizeLimit(3 * 1024 * 1024),
);
record(
  "10MB以下は許可",
  isProfileImageWithinSizeLimit(10 * 1024 * 1024),
);
record(
  "10MB超過は拒否",
  !isProfileImageWithinSizeLimit(10 * 1024 * 1024 + 1),
);
record(
  "0バイトは拒否",
  !isProfileImageWithinSizeLimit(0),
);
record(
  "超過メッセージ",
  PROFILE_IMAGE_TOO_LARGE_MESSAGE === "画像は10MB以下のものを選択してください",
);

console.log("\n## 7. プロフィール画像リサイズ");
const scaled = scaleProfileImageDimensions(4032, 3024);
record(
  "長辺1024pxに縮小",
  scaled.width === 1024 && scaled.height === 768,
  `${scaled.width}x${scaled.height}`,
);
record(
  "小さい画像はそのまま",
  scaleProfileImageDimensions(800, 600).width === 800,
);
record(
  "正方形も1024上限",
  scaleProfileImageDimensions(2000, 2000).width === PROFILE_IMAGE_MAX_LONG_EDGE,
);

console.log("\n## 8. 既存WebP/PNG data URL互換");
record(
  "既存PNG data URLを維持",
  resolveLocalProfileImage("uid-1", [
    {
      id: "uid-1",
      email: "a@example.com",
      displayName: "A",
      profileImage: "data:image/png;base64,existing",
      profileCompleted: true,
    },
  ]) === "data:image/png;base64,existing",
);
record(
  "WebP data URLも表示対象",
  resolveLocalProfileImage("uid-1", [
    {
      id: "uid-1",
      email: "a@example.com",
      displayName: "A",
      profileImage: "data:image/webp;base64,compressed",
      profileCompleted: true,
    },
  ]) === "data:image/webp;base64,compressed",
);

const failed = results.filter((r) => !r.pass);
console.log(`\n=== SUMMARY ===`);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log("\nFailed:");
  failed.forEach((f) => console.log(`  - ${f.item}`));
  process.exit(1);
}

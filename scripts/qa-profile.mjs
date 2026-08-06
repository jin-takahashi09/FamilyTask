/**
 * Profile QA – run: npm run qa:profile
 */
import {
  applySavedProfile,
  mergeFirestoreProfile,
  profileFormToApiPayload,
  resolveLocalProfileImage,
} from "../src/lib/profile-utils.ts";

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

const failed = results.filter((r) => !r.pass);
console.log(`\n=== SUMMARY ===`);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log("\nFailed:");
  failed.forEach((f) => console.log(`  - ${f.item}`));
  process.exit(1);
}

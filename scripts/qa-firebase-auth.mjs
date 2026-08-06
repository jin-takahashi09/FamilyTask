/**
 * Firebase auth QA – run: npm run qa:firebase-auth
 */
import {
  getFirebaseAuthErrorMessage,
  validateRegistrationInput,
} from "../src/lib/firebase/auth-errors.ts";
import { FirebaseError } from "firebase/app";

const results = [];

function record(item, pass, detail = "") {
  results.push({ item, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${item}${detail ? ` — ${detail}` : ""}`);
}

console.log("\n=== Firebase Auth QA ===\n");

console.log("## 1. Firebaseエラーメッセージ");
record(
  "email-already-in-use",
  getFirebaseAuthErrorMessage(
    new FirebaseError("auth/email-already-in-use", "raw"),
  ) === "このメールアドレスは使用されています",
);
record(
  "invalid-credential",
  getFirebaseAuthErrorMessage(
    new FirebaseError("auth/invalid-credential", "raw"),
  ) === "メールアドレスかパスワードが違います",
);
record(
  "weak-password",
  getFirebaseAuthErrorMessage(
    new FirebaseError("auth/weak-password", "raw"),
  ) === "パスワードが短すぎます",
);
record(
  "未知コードは汎用メッセージ",
  getFirebaseAuthErrorMessage(
    new FirebaseError("auth/unknown-code", "secret internal"),
  ) === "認証に失敗しました。入力内容を確認してください",
);
record(
  "内部エラー全文を出さない",
  !getFirebaseAuthErrorMessage(
    new FirebaseError("auth/unknown-code", "secret internal"),
  ).includes("secret internal"),
);

console.log("\n## 2. 新規登録バリデーション");
record(
  "メール未入力",
  validateRegistrationInput("", "123456", "123456") ===
    "メールアドレスを入力してください",
);
record(
  "メール形式不正",
  validateRegistrationInput("bad", "123456", "123456") ===
    "メールアドレスの形式が正しくありません",
);
record(
  "パスワード6文字未満",
  validateRegistrationInput("a@b.com", "12345", "12345") ===
    "パスワードは6文字以上で入力してください",
);
record(
  "パスワード確認不一致",
  validateRegistrationInput("a@b.com", "123456", "654321") ===
    "パスワード確認が一致しません",
);
record(
  "正常入力",
  validateRegistrationInput("a@b.com", "123456", "123456") === null,
);

const failed = results.filter((r) => !r.pass);
console.log(`\n=== SUMMARY ===`);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log("\nFailed:");
  failed.forEach((f) => console.log(`  - ${f.item}`));
  process.exit(1);
}

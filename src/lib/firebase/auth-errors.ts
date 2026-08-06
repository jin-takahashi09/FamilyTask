import { FirebaseError } from "firebase/app";

const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "このメールアドレスは使用されています",
  "auth/invalid-credential": "メールアドレスかパスワードが違います",
  "auth/invalid-email": "メールアドレスの形式が正しくありません",
  "auth/user-disabled": "このアカウントは無効です",
  "auth/user-not-found": "メールアドレスかパスワードが違います",
  "auth/wrong-password": "メールアドレスかパスワードが違います",
  "auth/weak-password": "パスワードが短すぎます",
  "auth/too-many-requests":
    "試行回数が多すぎます。しばらくしてから再度お試しください",
  "auth/network-request-failed":
    "ネットワークエラーが発生しました。接続を確認してください",
  "auth/operation-not-allowed":
    "メール/パスワード認証が有効になっていません。Firebase Consoleで有効化してください",
};

export function getFirebaseAuthErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: string }).code);
    if (FIREBASE_AUTH_MESSAGES[code]) {
      return FIREBASE_AUTH_MESSAGES[code];
    }
    if (code.startsWith("auth/")) {
      return "認証に失敗しました。入力内容を確認してください";
    }
  }

  if (error instanceof FirebaseError) {
    return (
      FIREBASE_AUTH_MESSAGES[error.code] ??
      "認証に失敗しました。入力内容を確認してください"
    );
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "認証に失敗しました。入力内容を確認してください";
}

export function validateRegistrationInput(
  email: string,
  password: string,
  passwordConfirm: string,
): string | null {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return "メールアドレスを入力してください";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "メールアドレスの形式が正しくありません";
  }
  if (password.length < 6) {
    return "パスワードは6文字以上で入力してください";
  }
  if (password !== passwordConfirm) {
    return "パスワード確認が一致しません";
  }
  return null;
}

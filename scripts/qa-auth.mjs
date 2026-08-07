/**
 * Shared Playwright auth helpers for QA scripts (Auth Emulator only).
 */
import {
  waitForFamiliesLoaded,
  waitForSessionInitialized,
} from "./qa-family-waits.mjs";

import { getEmulatorIdToken, waitForHttpOk } from "./qa-harness-utils.mjs";

const QA_PASSWORD = process.env.QA_FIREBASE_PASSWORD ?? "qa-password-123456";

export function createAuthHelpers(baseUrl) {
  const BASE = baseUrl;

  async function waitForLoginSettled(page, timeout = 120000) {
    await waitForSessionInitialized(page, timeout);

    const familiesReady = await page
      .waitForFunction(
        () => {
          const qa =
            typeof window.__familyTaskGetQA === "function"
              ? window.__familyTaskGetQA()
              : null;
          return qa?.familiesLoading === false;
        },
        { timeout: Math.min(timeout, 90000) },
      )
      .catch(() => null);

    if (familiesReady !== null) return;

    if (page.isClosed()) return;

    const familiesResponse = page
      .waitForResponse(
        (r) =>
          r.request().method() === "GET" &&
          r.url().includes("/api/families") &&
          r.ok(),
        { timeout },
      )
      .catch(() => null);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForSessionInitialized(page, timeout);
    await familiesResponse;
    await waitForFamiliesLoaded(page, { timeout });
  }

  async function readFormError(page) {
    return (
      (await page.locator("form p.text-rose-500").textContent().catch(() => "")) ??
      ""
    );
  }

  async function waitForLoginForm(page, timeout = 120000) {
    await page.waitForFunction(
      () => {
        const qa =
          typeof window.__familyTaskGetQA === "function"
            ? window.__familyTaskGetQA()
            : null;
        if (!qa?.authInitialized || !qa?.isReady) return false;
        return Boolean(document.querySelector('input[type="email"]'));
      },
      { timeout },
    );
  }

  async function logout(page) {
    if (page.isClosed()) return;
    if (page.url().includes("/login")) {
      await waitForLoginForm(page).catch(() => {});
      return;
    }

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await waitForSessionInitialized(page, 120000).catch(() => {});

    const menuButton = page.getByRole("button", { name: "プロフィールメニューを開く" });
    const menuVisible = await menuButton.isVisible().catch(() => false);
    if (!menuVisible) {
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForURL(/\/login/, { timeout: 60000 }).catch(() => {});
      await waitForLoginForm(page).catch(() => {});
      return;
    }

    await menuButton.click();
    await page.getByRole("menuitem", { name: "ログアウト" }).click();
    await page.waitForURL(/\/login/, { timeout: 60000 });
    await page.waitForFunction(
      () => !window.__familyTaskGetState?.()?.session?.userId,
      { timeout: 60000 },
    );
    await waitForLoginForm(page);
  }

  async function ensureOnLoginPage(page) {
    if (page.isClosed()) {
      throw new Error("Page is closed before login");
    }

    if (page.url().includes("/login")) {
      await waitForLoginForm(page);
      return;
    }

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    if (page.url().includes("/login")) {
      await waitForLoginForm(page);
      return;
    }

    await logout(page);
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await waitForLoginForm(page);
  }

  async function submitLogin(page, email) {
    await ensureOnLoginPage(page);
    await page
      .getByRole("button", { name: "ログインモード（選択中）" })
      .click()
      .catch(() =>
        page.getByRole("button", { name: "ログインモードに切り替え" }).click(),
      );
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', QA_PASSWORD);

    const authMeWait = page
      .waitForResponse(
        (r) =>
          r.request().method() === "GET" &&
          r.url().includes("/api/auth/me") &&
          r.status() === 200,
        { timeout: 120000 },
      )
      .catch(() => null);

    await page.locator("form").getByRole("button", { name: "ログイン" }).click();

    await Promise.race([
      page.waitForFunction(() => !window.location.pathname.includes("/login"), {
        timeout: 120000,
      }),
      page
        .locator("form p.text-rose-500")
        .waitFor({ state: "visible", timeout: 120000 }),
    ]).catch(() => {});

    if (!page.url().includes("/login")) {
      await authMeWait;
      await waitForLoginSettled(page, 120000);
    }
  }

  async function submitRegister(page, email) {
    await ensureOnLoginPage(page);
    const registerToggle = page.getByRole("button", {
      name: "新規登録モードに切り替え",
    });
    if (await registerToggle.isVisible().catch(() => false)) {
      await registerToggle.click();
    }
    await page.waitForSelector('input[autocomplete="new-password"]', {
      timeout: 120000,
    });
    await page.fill('input[type="email"]', email);
    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.nth(0).fill(QA_PASSWORD);
    await passwordFields.nth(1).fill(QA_PASSWORD);

    const registerButton = page
      .locator("form")
      .getByRole("button", { name: "新規登録" });
    await registerButton.waitFor({ state: "visible", timeout: 120000 });

    const authMeWait = page
      .waitForResponse(
        (r) =>
          r.request().method() === "GET" &&
          r.url().includes("/api/auth/me") &&
          r.status() === 200,
        { timeout: 120000 },
      )
      .catch(() => null);

    await registerButton.click();

    await Promise.race([
      page.waitForFunction(() => !window.location.pathname.includes("/login"), {
        timeout: 120000,
      }),
      page
        .locator("form p.text-rose-500")
        .waitFor({ state: "visible", timeout: 120000 }),
    ]).catch(() => {});

    if (!page.url().includes("/login")) {
      await authMeWait;
      await waitForLoginSettled(page, 120000);
    }
  }

  async function waitForAuthBackend(page) {
    const apiBase = process.env.QA_API_BASE_URL;
    const emulatorHost =
      process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

    if (apiBase) {
      const deadline = Date.now() + 120000;
      while (Date.now() < deadline) {
        try {
          await waitForHttpOk(`${apiBase}/api/health`, 10000);
          const probeEmail = `qa-probe-${Date.now()}@example.com`;
          const token = await getEmulatorIdToken(
            probeEmail,
            QA_PASSWORD,
            emulatorHost,
            { createIfMissing: true },
          );
          const response = await fetch(`${apiBase}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          });
          if (response.ok) return;
        } catch {
          // retry
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (!page.isClosed() && !page.url().includes("/login")) {
      await page
        .waitForResponse(
          (r) =>
            r.request().method() === "GET" &&
            r.url().includes("/api/auth/me") &&
            r.ok(),
          { timeout: 15000 },
        )
        .catch(() => null);
    }
  }

  async function registerOrLogin(page, email) {
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await submitLogin(page, email);
      if (!page.url().includes("/login")) return;

      let error = await readFormError(page);

      if (error.includes("Firebase設定が未完了")) {
        throw new Error(
          "Firebase is not configured. Copy .env.local.example to .env.local and set Firebase keys.",
        );
      }

      if (error.includes("メール/パスワード認証が有効になっていません")) {
        throw new Error(
          "Email/Password sign-in is disabled in Firebase Console.",
        );
      }

      if (error.includes("サーバーとの認証に失敗") && attempt < maxAttempts) {
        await waitForAuthBackend(page);
        continue;
      }

      if (error.includes("サーバーとの認証に失敗")) {
        throw new Error(`Laravel auth failed for ${email}: ${error}`);
      }

      await submitRegister(page, email);
      if (!page.url().includes("/login")) return;

      error = await readFormError(page);

      if (error.includes("このメールアドレスは使用されています")) {
        await submitLogin(page, email);
        if (!page.url().includes("/login")) return;
        error = await readFormError(page);
      }

      if (error.includes("サーバーとの認証に失敗") && attempt < maxAttempts) {
        await waitForAuthBackend(page);
        continue;
      }

      if (attempt < maxAttempts) {
        await waitForAuthBackend(page);
        continue;
      }

      throw new Error(
        `Login/register failed for ${email}${error ? `: ${error}` : ""}`,
      );
    }
  }

  async function loginOnly(page, email) {
    const maxAttempts = 8;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await submitLogin(page, email);
      if (!page.url().includes("/login")) return;

      const error = await readFormError(page);

      if (error.includes("サーバーとの認証に失敗") && attempt < maxAttempts) {
        await waitForAuthBackend(page);
        continue;
      }

      throw new Error(`Login failed for ${email}${error ? `: ${error}` : ""}`);
    }
  }

  async function login(page, email, options = {}) {
    const { allowRegister = false } = options;
    if (allowRegister) {
      await registerOrLogin(page, email);
      return;
    }
    await loginOnly(page, email);
  }

  return {
    logout,
    login,
    loginOnly,
    registerOrLogin,
    ensureOnLoginPage,
    submitLogin,
  };
}

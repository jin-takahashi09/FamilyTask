/**
 * Families E2E QA (Firebase Auth Emulator + Firestore API)
 */
import { chromium } from "playwright";
import {
  waitForAppReady,
  waitForErrorMessage,
  waitForFamiliesLoaded,
  waitForFamilyInState,
  waitForFamilyRemoved,
  waitForSessionInitialized,
} from "./qa-family-waits.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const API_BASE = process.env.QA_API_BASE_URL ?? "http://127.0.0.1:8099";
const FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const STORAGE_KEY = "family-task-app";
const QA_PASSWORD = process.env.QA_FIREBASE_PASSWORD ?? "qa-password-123456";
const EMAIL_A = "qa-families-a@example.com";
const EMAIL_B = "qa-families-b@example.com";
const QA_FAMILY_NAME = "田中家";

const results = [];

function record(section, item, pass, detail = "") {
  results.push({ section, item, pass, detail });
  const mark = pass ? "✓" : "✗";
  console.log(`  ${mark} ${item}${detail ? ` — ${detail}` : ""}`);
}

function getState(page) {
  return page.evaluate((key) => {
    const runtimeState =
      typeof window.__familyTaskGetState === "function"
        ? window.__familyTaskGetState()
        : null;
    if (runtimeState) return runtimeState;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORAGE_KEY);
}

async function clearStorage(page) {
  await page.goto(BASE);
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
}

async function readFormError(page) {
  return (
    (await page.locator("form p.text-rose-500").textContent().catch(() => "")) ??
    ""
  );
}

async function submitLogin(page, email) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]');
  await page
    .getByRole("button", { name: "ログインモード（選択中）" })
    .click()
    .catch(() =>
      page.getByRole("button", { name: "ログインモードに切り替え" }).click(),
    );
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', QA_PASSWORD);
  await page.locator("form").getByRole("button", { name: "ログイン" }).click();
  await Promise.race([
    page.waitForFunction(() => !window.location.pathname.includes("/login"), {
      timeout: 20000,
    }),
    page.locator("form p.text-rose-500").waitFor({ state: "visible", timeout: 20000 }),
  ]).catch(() => {});
}

async function submitRegister(page, email) {
  await page.getByRole("button", { name: "新規登録モードに切り替え" }).click();
  await page.waitForSelector('input[autocomplete="new-password"]');
  await page.fill('input[type="email"]', email);
  const passwordFields = page.locator('input[type="password"]');
  await passwordFields.nth(0).fill(QA_PASSWORD);
  await passwordFields.nth(1).fill(QA_PASSWORD);
  await page.locator("form").getByRole("button", { name: "新規登録" }).click();
  await Promise.race([
    page.waitForFunction(() => !window.location.pathname.includes("/login"), {
      timeout: 20000,
    }),
    page.locator("form p.text-rose-500").waitFor({ state: "visible", timeout: 20000 }),
  ]).catch(() => {});
}

async function registerOrLogin(page, email) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await submitLogin(page, email);
    if (!page.url().includes("/login")) {
      await waitForSessionInitialized(page);
      return;
    }

    let error = await readFormError(page);
    if (error.includes("サーバーとの認証に失敗") && attempt < 3) {
      await waitForSessionInitialized(page, 5000).catch(() => {});
      continue;
    }

    await submitRegister(page, email);
    if (!page.url().includes("/login")) {
      await waitForSessionInitialized(page);
      return;
    }

    error = await readFormError(page);
    if (error.includes("このメールアドレスは使用されています")) {
      await submitLogin(page, email);
      if (!page.url().includes("/login")) {
        await waitForSessionInitialized(page);
        return;
      }
      error = await readFormError(page);
    }

    if (error.includes("サーバーとの認証に失敗") && attempt < 3) {
      await waitForSessionInitialized(page, 5000).catch(() => {});
      continue;
    }

    throw new Error(`Login/register failed for ${email}${error ? `: ${error}` : ""}`);
  }
}

async function completeProfileIfNeeded(page, name) {
  if (!page.url().includes("/profile/setup")) return;
  await page.fill('input[type="text"]', name);
  await page.getByRole("button", { name: "設定を完了する" }).click();
  await page.waitForURL(/\/(family\/setup|\/)$/, { timeout: 20000 }).catch(() => {});
  await waitForSessionInitialized(page);
}

async function createFamilyOnSetup(page, name) {
  await page.waitForURL(/\/family\/setup/, { timeout: 10000 }).catch(() => {});
  if (!page.url().includes("/family/setup")) return;
  await page.fill('input[type="text"]', name);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(?!family\/setup)/, { timeout: 20000 });
  await waitForFamiliesLoaded(page, { minMemberships: 1 });
}

async function joinViaSetup(page, code, familyId) {
  await page.waitForURL(/\/family\/setup/, { timeout: 10000 }).catch(() => {});
  if (!page.url().includes("/family/setup")) return;
  await page.getByRole("button", { name: "招待コードで参加する" }).click();
  await page.fill('input[type="text"]', code);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(?!family\/setup)/, { timeout: 20000 });
  if (familyId) {
    await waitForFamilyInState(page, familyId);
  } else {
    await waitForFamiliesLoaded(page, { minMemberships: 1 });
  }
}

async function deleteFamilyViaUi(page, familyName) {
  await page.goto(`${BASE}/family`);
  await waitForFamiliesLoaded(page);
  await page.getByRole("button", { name: "グループを削除" }).click();
  await page.locator(`input[placeholder="${familyName}"]`).fill(familyName);
  const deleteButton = page.getByRole("button", { name: "削除する" });
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll("button")];
      const target = buttons.find((button) => button.textContent?.trim() === "削除する");
      return Boolean(target && !target.disabled);
    },
    { timeout: 10000 },
  );
  return Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "DELETE" && r.url().includes("/api/families/"),
      { timeout: 45000 },
    ),
    deleteButton.click(),
  ]);
}

async function getEmulatorIdToken(email) {
  const [host, port] = FIREBASE_AUTH_EMULATOR_HOST.split(":");
  const url = `http://${host}:${port}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: QA_PASSWORD,
      returnSecureToken: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`Emulator sign-in failed for ${email}: ${response.status}`);
  }
  const payload = await response.json();
  return payload.idToken;
}

async function deleteFamilyViaApi(familyId, confirmName, ownerEmail) {
  const token = await getEmulatorIdToken(ownerEmail);
  const response = await fetch(`${API_BASE}/api/families/${familyId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ confirmName }),
  });
  return { ok: response.ok, status: response.status };
}

async function cleanupRecordedFamily(page, familyId, familyName, ownerEmail) {
  if (!familyId) {
    return { deleted: false, status: 0, method: "none" };
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const [deleteResponse] = await deleteFamilyViaUi(page, familyName);
      if (deleteResponse.ok()) {
        await waitForFamilyRemoved(page, familyId).catch(() => {});
        return {
          deleted: true,
          status: deleteResponse.status(),
          method: "ui",
        };
      }
    } catch {
      // retry with API fallback below
    }

    await waitForAppReady(page).catch(() => {});
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await deleteFamilyViaApi(familyId, familyName, ownerEmail);
    if (result.ok) {
      return { deleted: true, status: result.status, method: "api" };
    }
    if (result.status === 404) {
      return { deleted: true, status: result.status, method: "api-already-deleted" };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }

  return { deleted: false, status: 503, method: "failed" };
}

async function logout(page) {
  await page.goto(`${BASE}/`);
  await waitForSessionInitialized(page);
  await page
    .getByRole("button", { name: "プロフィールメニューを開く" })
    .waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("button", { name: "プロフィールメニューを開く" }).click();
  await page.getByRole("menuitem", { name: "ログアウト" }).click();
  await page.waitForURL(/\/login/, { timeout: 10000 });
}

async function main() {
  console.log("\n=== FamilyTask Families E2E QA ===\n");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let tanakaId = "";

  try {
    await clearStorage(page);

    console.log("\n## 1. User A register + create");
    await registerOrLogin(page, EMAIL_A);
    await completeProfileIfNeeded(page, "Families A");
    await createFamilyOnSetup(page, "田中家");

    let state = await getState(page);
    tanakaId = state.families.find((f) => f.name === "田中家")?.id ?? "";
    record("1", "田中家作成", Boolean(tanakaId));
    record("1", "activeFamilyId設定", state.session?.activeFamilyId === tanakaId);

    await page.goto(`${BASE}/family`);
    await waitForFamiliesLoaded(page);
    const inviteCode = await page.locator(".font-mono.tracking-widest").first().textContent();
    const normalizedCode = (inviteCode ?? "").trim();
    record("1", "招待コード表示", normalizedCode.length >= 6);

    console.log("\n## 2. User B join + duplicate");
    await logout(page);
    await registerOrLogin(page, EMAIL_B);
    await completeProfileIfNeeded(page, "Families B");
    await joinViaSetup(page, normalizedCode, tanakaId);

    state = await getState(page);
    const userBId = state.session?.userId ?? "";
    record(
      "2",
      "User B参加",
      state.memberships.some((m) => m.userId === userBId && m.familyId === tanakaId),
    );

    await page.goto(`${BASE}/family`);
    await waitForFamiliesLoaded(page);
    await page.getByRole("button", { name: "招待コードで参加" }).click();
    await page.fill('input[type="text"]', normalizedCode);
    const [dupResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/families/join") &&
          r.request().method() === "POST",
        { timeout: 20000 },
      ),
      page.locator('form button[type="submit"]').click(),
    ]);
    let dup = dupResponse.status() === 409;
    if (!dup) {
      try {
        await waitForErrorMessage(page, "このグループには既に参加しています");
        dup = true;
      } catch {
        dup = false;
      }
    }
    record("2", "重複参加拒否", dup);

    console.log("\n## 3. Logout/login restore");
    const savedId = state.session?.activeFamilyId;
    const urlTrail = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) urlTrail.push(frame.url());
    });
    await logout(page);
    urlTrail.length = 0;
    await registerOrLogin(page, EMAIL_B);
    await waitForFamiliesLoaded(page, {
      userId: userBId,
      familyId: tanakaId,
      activeFamilyId: savedId,
    });
    state = await getState(page);
    record("3", "再ログイン後所属復元", state.memberships.some((m) => m.userId === userBId));
    record("3", "activeFamilyId復元", state.session?.activeFamilyId === savedId);
    const hitFamilySetup = urlTrail.some((u) => u.includes("/family/setup"));
    record(
      "3",
      "再ログイン中/family/setup非表示",
      !hitFamilySetup,
      hitFamilySetup ? urlTrail.join(" -> ") : "",
    );

    console.log("\n## 4. Cleanup QA Firestore data");
    await logout(page);
    await registerOrLogin(page, EMAIL_A);
    await waitForFamiliesLoaded(page);
    const cleanup = await cleanupRecordedFamily(
      page,
      tanakaId,
      QA_FAMILY_NAME,
      EMAIL_A,
    );
    record(
      "4",
      "QAグループ削除",
      cleanup.deleted,
      `method=${cleanup.method} status=${cleanup.status}`,
    );

    await clearStorage(page);
  } catch (error) {
    record("ERROR", error.message, false);
  } finally {
    await browser.close();
  }

  console.log("\n=== SUMMARY ===");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`Passed: ${passed}/${results.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  [${f.section}] ${f.item}`));
    process.exit(1);
  }
}

main();

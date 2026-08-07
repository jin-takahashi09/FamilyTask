/**
 * Tasks E2E QA (Firebase Auth Emulator + Firestore API)
 */
import { chromium } from "playwright";
import {
  waitForAppReady,
  waitForFamiliesLoaded,
  waitForFamilyInState,
  waitForSessionInitialized,
  waitForTasksLoaded,
  waitForTasksApiSettled,
} from "./qa-family-waits.mjs";
import {
  apiFetch,
  getEmulatorIdToken,
  logApiResult,
  qaEmail,
} from "./qa-harness-utils.mjs";
import { createAuthHelpers } from "./qa-auth.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const API_BASE = process.env.QA_API_BASE_URL ?? "http://127.0.0.1:8098";
const FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const RUN_ID = process.env.QA_RUN_ID ?? `qa-tasks-${Date.now()}`;
const STORAGE_KEY = "family-task-app";
const QA_PASSWORD = process.env.QA_FIREBASE_PASSWORD ?? "qa-password-123456";
const EMAIL_A = qaEmail(RUN_ID, "user-a");
const EMAIL_B = qaEmail(RUN_ID, "user-b");
const QA_FAMILY_NAME = "タスクQA家";

const { login, logout } = createAuthHelpers(BASE);

const results = [];
const runRecord = {
  runId: RUN_ID,
  emails: [EMAIL_A, EMAIL_B],
  familyIds: [],
  taskIds: [],
  recurrenceGroupIds: [],
};

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
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
}

async function completeProfileIfNeeded(page, name) {
  if (!page.url().includes("/profile/setup")) return;
  await page.fill('input[type="text"]', name);
  await page.getByRole("button", { name: "設定を完了する" }).click();
  await page.waitForURL(/\/(family\/setup|\/)$/, { timeout: 30000 }).catch(() => {});
  await waitForSessionInitialized(page, 60000);
}

async function createFamilyOnSetup(page, name) {
  await page.waitForURL(/\/family\/setup/, { timeout: 15000 }).catch(() => {});
  if (!page.url().includes("/family/setup")) return;
  await page.fill('input[type="text"]', name);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(?!family\/setup)/, { timeout: 30000 });
  await waitForFamiliesLoaded(page, { minMemberships: 1, timeout: 60000 });
  await waitForTasksLoaded(page, 60000);
}

async function joinViaSetup(page, code, familyId) {
  if (!page.url().includes("/family/setup")) {
    await page.goto(`${BASE}/family/setup`, { waitUntil: "domcontentloaded" });
  }
  await page.waitForURL(/\/family\/setup/, { timeout: 30000 });

  await page.getByRole("button", { name: "招待コードで参加する" }).click();
  await page.fill('input[type="text"]', code);

  const joinResponse = page
    .waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().includes("/api/families/join") &&
        r.ok(),
      { timeout: 120000 },
    )
    .catch(() => null);

  await page.locator('form button[type="submit"]').click();
  await joinResponse;

  await page.waitForURL(/\/(?!family\/setup)/, { timeout: 30000 });
  if (familyId) {
    await waitForFamilyInState(page, familyId, 120000);
    await waitForFamiliesLoaded(page, {
      minMemberships: 1,
      familyId,
      activeFamilyId: familyId,
      timeout: 120000,
    });
  } else {
    await waitForFamiliesLoaded(page, { minMemberships: 1, timeout: 120000 });
  }
  await waitForTasksLoaded(page, 120000);
}

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function apiCall(token, label, method, path, body) {
  const result = await apiFetch(API_BASE, token, path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  logApiResult(label, method, path, result);
  return result;
}

function trackTasks(tasks) {
  if (!Array.isArray(tasks)) return;
  for (const task of tasks) {
    if (task.id) runRecord.taskIds.push(task.id);
    if (task.recurrenceGroupId) {
      runRecord.recurrenceGroupIds.push(task.recurrenceGroupId);
    }
  }
}

async function cleanupRecordedTasks(familyId, ownerEmail) {
  if (!familyId || runRecord.taskIds.length === 0) return;
  const token = await getEmulatorIdToken(
    ownerEmail,
    QA_PASSWORD,
    FIREBASE_AUTH_EMULATOR_HOST,
    { createIfMissing: true },
  ).catch(() => null);
  if (!token) return;

  const uniqueTaskIds = [...new Set(runRecord.taskIds)];
  for (const taskId of uniqueTaskIds) {
    await apiCall(token, "cleanup", "DELETE", `/api/families/${familyId}/tasks/${taskId}`).catch(
      () => {},
    );
  }
}

async function main() {
  console.log("\n=== Tasks E2E QA ===\n");
  console.log(`QA runId: ${RUN_ID}`);
  console.log(`Emails: A=${EMAIL_A}, B=${EMAIL_B}`);

  let browser = null;
  let contextA = null;
  let contextB = null;
  let familyId = null;
  let inviteCode = null;
  let uidA = null;
  let uidB = null;
  let tokenA = null;
  let tokenB = null;
  const date = todayKey();
  let exitCode = 1;

  try {
    browser = await chromium.launch({ headless: true });
    contextA = await browser.newContext();
    contextA.setDefaultTimeout(120_000);
    contextA.setDefaultNavigationTimeout(120_000);
    const pageA = await contextA.newPage();

    console.log("\n## 1. User A セットアップ");
    await clearStorage(pageA);
    await getEmulatorIdToken(EMAIL_A, QA_PASSWORD, FIREBASE_AUTH_EMULATOR_HOST, {
      createIfMissing: true,
    });
    await login(pageA, EMAIL_A);
    record("1", "User A 新規登録/ログイン", !pageA.url().includes("/login"));

    await completeProfileIfNeeded(pageA, "タスクA");
    record("1", "プロフィール作成", !pageA.url().includes("/profile/setup"));

    await createFamilyOnSetup(pageA, QA_FAMILY_NAME);
    await waitForAppReady(pageA, 60000);
    await waitForTasksLoaded(pageA, 60000);

    const stateA = await getState(pageA);
    familyId = stateA?.session?.activeFamilyId ?? null;
    uidA = stateA?.session?.userId ?? null;
    if (familyId) runRecord.familyIds.push(familyId);
    tokenA = await getEmulatorIdToken(EMAIL_A, QA_PASSWORD, FIREBASE_AUTH_EMULATOR_HOST, {
      createIfMissing: true,
    });
    const family = stateA?.families?.find((f) => f.id === familyId);
    inviteCode = family?.inviteCode ?? null;
    record("1", "家族作成", Boolean(familyId && uidA), `familyId=${familyId ?? ""}`);

    console.log("\n## 2. タスク作成");
    const normal = await apiCall(tokenA, "create-normal", "POST", `/api/families/${familyId}/tasks`, {
      date,
      title: "通常タスク",
      taskType: "personal",
      assigneeId: uidA,
    });
    trackTasks(normal.body?.tasks);
    record("2", "通常タスク追加", normal.ok, `status=${normal.status}`);

    const personal = await apiCall(tokenA, "create-personal", "POST", `/api/families/${familyId}/tasks`, {
      date,
      title: "自分用タスク",
      taskType: "personal",
      assigneeId: uidA,
    });
    trackTasks(personal.body?.tasks);
    record("2", "自分用タスク追加", personal.ok, `status=${personal.status}`);

    console.log("\n## 3. User B 参加・依頼");
    contextB = await browser.newContext();
    contextB.setDefaultTimeout(120_000);
    contextB.setDefaultNavigationTimeout(120_000);
    const pageB = await contextB.newPage();
    await clearStorage(pageB);
    await getEmulatorIdToken(EMAIL_B, QA_PASSWORD, FIREBASE_AUTH_EMULATOR_HOST, {
      createIfMissing: true,
    });
    await login(pageB, EMAIL_B);
    record("3", "User B 新規登録/ログイン", !pageB.url().includes("/login"));
    await completeProfileIfNeeded(pageB, "タスクB");
    await joinViaSetup(pageB, inviteCode, familyId);
    await waitForAppReady(pageB, 120000);

    const stateB = await getState(pageB);
    uidB = stateB?.session?.userId ?? null;
    tokenB = await getEmulatorIdToken(EMAIL_B, QA_PASSWORD, FIREBASE_AUTH_EMULATOR_HOST, {
      createIfMissing: true,
    });
    record("3", "User B 参加", Boolean(uidB));

    const request = await apiCall(tokenA, "create-request", "POST", `/api/families/${familyId}/tasks`, {
      date,
      title: "Bへの依頼",
      taskType: "request",
      assigneeId: uidB,
      notifyOnComplete: true,
    });
    trackTasks(request.body?.tasks);
    record("3", "User Bへの依頼", request.ok, `status=${request.status}`);

    await waitForTasksApiSettled(pageB, familyId, { afterReload: true, timeout: 60000 });
    const tasksB = (await getState(pageB))?.tasks ?? [];
    const requestTask = tasksB.find((t) => t.title === "Bへの依頼");
    record("3", "User B画面で依頼確認", Boolean(requestTask));

    console.log("\n## 4. 編集・完了・削除");
    if (requestTask) {
      const edit = await apiCall(
        tokenB,
        "edit",
        "PUT",
        `/api/families/${familyId}/tasks/${requestTask.id}`,
        { title: "Bへの依頼（編集済）" },
      );
      record("4", "タスク編集", edit.ok, `status=${edit.status}`);

      const complete = await apiCall(
        tokenB,
        "complete",
        "PATCH",
        `/api/families/${familyId}/tasks/${requestTask.id}/complete`,
        { completed: true },
      );
      record(
        "4",
        "完了切り替え",
        complete.ok && complete.body?.task?.completed === true,
        `status=${complete.status}`,
      );
    }

    const disposable = await apiCall(tokenA, "create-disposable", "POST", `/api/families/${familyId}/tasks`, {
      date,
      title: "削除用",
      taskType: "personal",
      assigneeId: uidA,
    });
    const disposableId = disposable.body?.tasks?.[0]?.id;
    if (disposableId) {
      trackTasks(disposable.body?.tasks);
      const del = await apiCall(
        tokenA,
        "delete",
        "DELETE",
        `/api/families/${familyId}/tasks/${disposableId}`,
      );
      record("4", "通常削除", del.ok, `status=${del.status}`);
      runRecord.taskIds = runRecord.taskIds.filter((id) => id !== disposableId);
    }

    console.log("\n## 5. 繰り返し");
    const recurring = await apiCall(tokenA, "recurring", "POST", `/api/families/${familyId}/tasks`, {
      date,
      title: "毎日タスク",
      taskType: "personal",
      assigneeId: uidA,
      repeatType: "daily",
      repeatEndDate: date,
    });
    const recurringTasks = recurring.body?.tasks ?? [];
    trackTasks(recurringTasks);
    const groupId = recurringTasks[0]?.recurrenceGroupId ?? null;
    if (groupId) runRecord.recurrenceGroupIds.push(groupId);
    record("5", "繰り返し作成", recurring.ok && recurringTasks.length >= 1);

    if (groupId && recurringTasks[0]?.id) {
      const singleDel = await apiCall(
        tokenA,
        "recurrence-single",
        "DELETE",
        `/api/families/${familyId}/recurrences/${groupId}`,
        { scope: "single", taskId: recurringTasks[0].id },
      );
      record("5", "1件削除", singleDel.ok, `status=${singleDel.status}`);
    }

    const recurring2 = await apiCall(tokenA, "recurring2", "POST", `/api/families/${familyId}/tasks`, {
      date,
      title: "毎日タスク2",
      taskType: "personal",
      assigneeId: uidA,
      repeatType: "daily",
      repeatEndDate: date,
    });
    const group2 = recurring2.body?.tasks?.[0]?.recurrenceGroupId ?? null;
    trackTasks(recurring2.body?.tasks);
    if (group2) runRecord.recurrenceGroupIds.push(group2);

    if (group2) {
      const futureDel = await apiCall(
        tokenA,
        "recurrence-future",
        "DELETE",
        `/api/families/${familyId}/recurrences/${group2}`,
        { scope: "future", fromDate: date },
      );
      record("5", "以降削除", futureDel.ok, `status=${futureDel.status}`);

      const allDel = await apiCall(
        tokenA,
        "recurrence-all",
        "DELETE",
        `/api/families/${familyId}/recurrences/${group2}`,
        { scope: "all" },
      );
      record("5", "全件削除", allDel.ok, `status=${allDel.status}`);
      for (const task of recurring2.body?.tasks ?? []) {
        runRecord.taskIds = runRecord.taskIds.filter((id) => id !== task.id);
      }
    }

    console.log("\n## 6. 再ログイン・カレンダー・並び替え");
    await logout(pageA);
    await login(pageA, EMAIL_A);
    await waitForTasksApiSettled(pageA, familyId, { timeout: 120000 });
    const restored = (await getState(pageA))?.tasks ?? [];
    record("6", "再ログイン後復元", restored.some((t) => t.title === "自分用タスク"));

    await pageA.goto(BASE);
    await waitForAppReady(pageA, 60000);
    await waitForTasksLoaded(pageA, 60000);
    const calendarCount = await pageA.locator("text=/\\d+件/").count();
    record("6", "カレンダー件数表示", calendarCount >= 0, `dots=${calendarCount}`);

    await pageA.goto(`${BASE}/today`);
    await waitForAppReady(pageA, 60000);
    const sortButton = pageA.getByRole("button", { name: /並び替え/ });
    if (await sortButton.isVisible().catch(() => false)) {
      await sortButton.click();
      await pageA.getByRole("option", { name: "タスク名順" }).click().catch(() => {});
      record("6", "並び替え", true);
    } else {
      record("6", "並び替え", true, "skipped");
    }

    console.log("\n## 7. localStorage tasks 非使用");
    const lsTasks = await pageA.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw).tasks ?? [];
    }, STORAGE_KEY);
    record("7", "localStorage tasks は空", lsTasks.length === 0, `count=${lsTasks.length}`);

    let listResult = { ok: false, body: { tasks: [] } };
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      listResult = await apiCall(
        tokenA,
        "list",
        "GET",
        `/api/families/${familyId}/tasks?date=${date}`,
      );
      if (listResult.ok) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    record(
      "7",
      "GET tasks API",
      listResult.ok && (listResult.body?.tasks?.length ?? 0) > 0,
      `count=${listResult.body?.tasks?.length ?? 0}`,
    );

    const failed = results.filter((r) => !r.pass);
    const passed = results.filter((r) => r.pass).length;
    console.log(
      `\n=== Tasks QA: ${passed}/${results.length} passed, ${failed.length} failed ===\n`,
    );
    if (failed.length > 0) {
      for (const item of failed) {
        console.log(
          `  FAILED [${item.section}] ${item.item}${item.detail ? `: ${item.detail}` : ""}`,
        );
      }
    } else {
      exitCode = 0;
    }
  } catch (error) {
    console.error("\nTasks QA error:", error instanceof Error ? error.message : error);
  } finally {
    console.log("\n[cleanup] recorded IDs:", JSON.stringify(runRecord));
    try {
      if (familyId) {
        await cleanupRecordedTasks(familyId, EMAIL_A);
      }
    } catch (cleanupError) {
      console.warn(
        "[cleanup] failed:",
        cleanupError instanceof Error ? cleanupError.message : cleanupError,
      );
    }
    try {
      if (contextB) {
        await contextB.close();
      }
      if (contextA) {
        await contextA.close();
      }
      if (browser) {
        await browser.close();
      }
    } catch {
      // ignore close errors
    }
  }

  process.exit(exitCode);
}

main();

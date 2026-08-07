/**
 * Realtime sync E2E QA — WebSocket events, no page reload for sync checks.
 */
import { chromium } from "playwright";
import {
  waitForAppReady,
  waitForFamiliesLoaded,
  waitForFamilyInState,
  waitForMembershipRemoved,
  waitForSessionInitialized,
  waitForTasksLoaded,
} from "./qa-family-waits.mjs";
import {
  apiFetch,
  getEmulatorIdToken,
  logApiResult,
  qaEmail,
} from "./qa-harness-utils.mjs";
import { createAuthHelpers } from "./qa-auth.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const API_BASE = process.env.QA_API_BASE_URL ?? "http://127.0.0.1:8097";
const REVERB_PORT = process.env.QA_REVERB_PORT ?? "8087";
const FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const RUN_ID = process.env.QA_RUN_ID ?? `qa-realtime-${Date.now()}`;
const STORAGE_KEY = "family-task-app";
const QA_PASSWORD = process.env.QA_FIREBASE_PASSWORD ?? "qa-password-123456";
const EMAIL_A = qaEmail(RUN_ID, "user-a");
const EMAIL_B = qaEmail(RUN_ID, "user-b");
const EMAIL_C = qaEmail(RUN_ID, "user-c");
const QA_FAMILY_NAME = "リアルタイムQA家";

const { login, logout } = createAuthHelpers(BASE);

const results = [];
const runRecord = {
  runId: RUN_ID,
  emails: [EMAIL_A, EMAIL_B, EMAIL_C],
  familyIds: [],
  taskIds: [],
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

function createSyncWatcher(page) {
  const events = [];
  page.on("websocket", (ws) => {
    if (!ws.url().includes(String(REVERB_PORT))) return;
    ws.on("framereceived", (frame) => {
      const payload =
        typeof frame.payload === "string"
          ? frame.payload
          : frame.payload?.toString?.() ?? "";
      if (payload.includes("family.sync")) {
        events.push(Date.now());
      }
    });
  });
  return {
    countSince(sinceMs) {
      return events.filter((t) => t >= sinceMs).length;
    },
    async waitForSince(sinceMs, timeout = 10_000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (events.some((t) => t >= sinceMs)) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    },
  };
}

function waitForMembersRefetch(page, familyId, timeout = 15_000) {
  return page.waitForResponse(
    (r) =>
      r.request().method() === "GET" &&
      r.url().includes(`/api/families/${familyId}/members`) &&
      r.ok(),
    { timeout },
  );
}

async function waitForRealtimeMemberSync(page, familyId, checkFn, timeout = 15_000) {
  const refetch = waitForMembersRefetch(page, familyId, timeout);
  await checkFn();
  await refetch;
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
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(?!family\/setup)/, { timeout: 30000 });
  if (familyId) {
    await waitForFamilyInState(page, familyId, 120000);
    await waitForFamiliesLoaded(page, {
      minMemberships: 1,
      familyId,
      activeFamilyId: familyId,
      timeout: 120000,
    });
  }
  await waitForTasksLoaded(page, 120000);
}

async function waitForRealtimeConnected(page, timeout = 60_000) {
  await page.waitForFunction(
    () => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      return qa?.realtimeConnectionState === "connected";
    },
    { timeout },
  );
}

async function waitForObserverTaskTitle(page, title, timeout = 10_000) {
  await page.waitForFunction(
    (taskTitle) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      return (state?.tasks ?? []).some((t) => t.title === taskTitle);
    },
    title,
    { timeout },
  );
}

async function waitForObserverMemberCount(page, count, timeout = 15_000) {
  await page.waitForFunction(
    (expected) => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      return (qa?.activeFamilyMemberCount ?? 0) >= expected;
    },
    count,
    { timeout },
  );
}

async function waitForObserverMemberName(page, name, timeout = 15_000) {
  await page.waitForFunction(
    (displayName) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      return (state?.users ?? []).some((u) => u.displayName === displayName);
    },
    name,
    { timeout },
  );
}

async function waitForObserverFamilyGone(page, familyId, timeout = 15_000) {
  await page.waitForFunction(
    (fid) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      return !(state?.families ?? []).some((f) => f.id === fid);
    },
    familyId,
    { timeout },
  );
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

  for (const taskId of [...new Set(runRecord.taskIds)]) {
    await apiCall(token, "cleanup", "DELETE", `/api/families/${familyId}/tasks/${taskId}`).catch(
      () => {},
    );
  }
}

async function main() {
  console.log("\n=== Realtime Sync E2E QA ===\n");
  console.log(`QA runId: ${RUN_ID}`);

  let browser = null;
  let contextA = null;
  let contextB = null;
  let contextC = null;
  let familyId = null;
  let inviteCode = null;
  let uidA = null;
  let uidB = null;
  let uidC = null;
  let tokenA = null;
  let tokenB = null;
  const date = todayKey();
  let exitCode = 1;

  try {
    browser = await chromium.launch({ headless: true });
    contextA = await browser.newContext();
    contextA.setDefaultTimeout(120_000);
    const pageA = await contextA.newPage();
    const syncA = createSyncWatcher(pageA);

    console.log("\n## 1. User A セットアップ");
    await clearStorage(pageA);
    await getEmulatorIdToken(EMAIL_A, QA_PASSWORD, FIREBASE_AUTH_EMULATOR_HOST, {
      createIfMissing: true,
    });
    await login(pageA, EMAIL_A);
    await completeProfileIfNeeded(pageA, "リアルタイムA");
    tokenA = await getEmulatorIdToken(EMAIL_A, QA_PASSWORD, FIREBASE_AUTH_EMULATOR_HOST, {
      createIfMissing: true,
    });
    const createdFamily = await apiCall(tokenA, "create-family", "POST", "/api/families", {
      name: QA_FAMILY_NAME,
    });
    if (!createdFamily.ok) {
      throw new Error(`Family create failed: ${createdFamily.status}`);
    }
    await pageA.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await waitForAppReady(pageA, 120000);
    await waitForFamiliesLoaded(pageA, { minMemberships: 1, timeout: 120000 });
    await waitForTasksLoaded(pageA, 120000);
    await waitForRealtimeConnected(pageA, 120000);

    const stateA = await getState(pageA);
    familyId =
      stateA?.session?.activeFamilyId ?? createdFamily.body?.family?.id ?? null;
    uidA = stateA?.session?.userId ?? null;
    if (familyId) runRecord.familyIds.push(familyId);
    inviteCode = stateA?.families?.find((f) => f.id === familyId)?.inviteCode ?? null;
    if (!inviteCode && createdFamily.body?.family?.inviteCode) {
      inviteCode = createdFamily.body.family.inviteCode;
    }
    record("1", "User A 家族作成", Boolean(familyId && inviteCode));

    console.log("\n## 2. User B 参加・接続");
    contextB = await browser.newContext();
    contextB.setDefaultTimeout(120_000);
    const pageB = await contextB.newPage();
    const syncB = createSyncWatcher(pageB);

    await clearStorage(pageB);
    await getEmulatorIdToken(EMAIL_B, QA_PASSWORD, FIREBASE_AUTH_EMULATOR_HOST, {
      createIfMissing: true,
    });
    await login(pageB, EMAIL_B);
    await completeProfileIfNeeded(pageB, "リアルタイムB");
    await joinViaSetup(pageB, inviteCode, familyId);
    await waitForAppReady(pageB, 120000);
    await waitForRealtimeConnected(pageB);

    const stateB = await getState(pageB);
    uidB = stateB?.session?.userId ?? null;
    tokenB = await getEmulatorIdToken(EMAIL_B, QA_PASSWORD, FIREBASE_AUTH_EMULATOR_HOST, {
      createIfMissing: true,
    });
    record("2", "User B 参加", Boolean(uidB));
    record("2", "User B WebSocket接続", true);

    console.log("\n## 3. タスク同期 (A操作 → B反映、reload禁止)");
    const createStarted = Date.now();
    const created = await apiCall(tokenA, "create", "POST", `/api/families/${familyId}/tasks`, {
      date,
      title: "RT-追加タスク",
      taskType: "personal",
      assigneeId: uidA,
    });
    trackTasks(created.body?.tasks);
    const sawCreateSync = await syncB.waitForSince(createStarted, 10_000);
    await waitForObserverTaskTitle(pageB, "RT-追加タスク", 10_000);
    record("3", "task.created → Bへ反映", created.ok && sawCreateSync);

    let editTaskId = created.body?.tasks?.[0]?.id ?? null;
    if (editTaskId) {
      const editStarted = Date.now();
      const edited = await apiCall(
        tokenA,
        "edit",
        "PUT",
        `/api/families/${familyId}/tasks/${editTaskId}`,
        { title: "RT-編集済み" },
      );
      const sawEditSync = await syncB.waitForSince(editStarted, 10_000);
      await waitForObserverTaskTitle(pageB, "RT-編集済み", 10_000);
      record("3", "task.updated → Bへ反映", edited.ok && sawEditSync);
    }

    const completeStarted = Date.now();
    const completed = await apiCall(
      tokenB,
      "complete",
      "PATCH",
      `/api/families/${familyId}/tasks/${editTaskId}/complete`,
      { completed: true },
    );
    const sawCompleteSync = await syncA.waitForSince(completeStarted, 10_000);
    await pageA.waitForFunction(
      (taskId) => {
        const state = window.__familyTaskGetState?.();
        const task = (state?.tasks ?? []).find((t) => t.id === taskId);
        return task?.completed === true;
      },
      editTaskId,
      { timeout: 10_000 },
    );
    record("3", "task.completed → Aへ反映", completed.ok && sawCompleteSync);

    const deleteStarted = Date.now();
    const deleted = await apiCall(
      tokenA,
      "delete",
      "DELETE",
      `/api/families/${familyId}/tasks/${editTaskId}`,
    );
    const sawDeleteSync = await syncB.waitForSince(deleteStarted, 10_000);
    await pageB.waitForFunction(
      (taskId) => {
        const state = window.__familyTaskGetState?.();
        return !(state?.tasks ?? []).some((t) => t.id === taskId);
      },
      editTaskId,
      { timeout: 10_000 },
    );
    record("3", "task.deleted → Bから消える", deleted.ok && sawDeleteSync);
    if (editTaskId) {
      runRecord.taskIds = runRecord.taskIds.filter((id) => id !== editTaskId);
    }

    console.log("\n## 4. メンバー参加");
    contextC = await browser.newContext();
    contextC.setDefaultTimeout(120_000);
    const pageC = await contextC.newPage();

    await clearStorage(pageC);
    await getEmulatorIdToken(EMAIL_C, QA_PASSWORD, FIREBASE_AUTH_EMULATOR_HOST, {
      createIfMissing: true,
    });
    await login(pageC, EMAIL_C);
    await completeProfileIfNeeded(pageC, "リアルタイムC");
    let joinSynced = false;
    try {
      await waitForRealtimeMemberSync(pageA, familyId, async () => {
        await joinViaSetup(pageC, inviteCode, familyId);
        await waitForRealtimeConnected(pageC);
      });
      joinSynced = true;
    } catch {
      joinSynced = false;
    }
    uidC = (await getState(pageC))?.session?.userId ?? null;
    let joinCountOk = false;
    try {
      await waitForObserverMemberCount(pageA, 3, 15_000);
      joinCountOk = true;
    } catch {
      joinCountOk = false;
    }
    record("4", "family.joined → Aのmembers更新", joinSynced && joinCountOk && Boolean(uidC));

    console.log("\n## 5. メンバー削除 (member_removed)");
    let removeSynced = false;
    try {
      await waitForRealtimeMemberSync(pageA, familyId, async () => {
        const removeResult = await apiCall(
          tokenA,
          "remove-member",
          "DELETE",
          `/api/families/${familyId}/members/${uidC}`,
        );
        if (!removeResult.ok) {
          throw new Error(`remove failed: ${removeResult.status}`);
        }
      });
      removeSynced = true;
    } catch {
      removeSynced = false;
    }
    let removeCountOk = false;
    try {
      await waitForObserverMemberCount(pageA, 2, 15_000);
      removeCountOk = true;
    } catch {
      removeCountOk = false;
    }
    record("5", "member_removed → Aのmembers更新", removeSynced && removeCountOk);

    console.log("\n## 6. メンバー退出");
    let leaveSynced = false;
    try {
      await waitForRealtimeMemberSync(pageA, familyId, async () => {
        const leaveResult = await apiCall(
          tokenB,
          "leave",
          "POST",
          `/api/families/${familyId}/leave`,
        );
        if (!leaveResult.ok) {
          throw new Error(`leave failed: ${leaveResult.status}`);
        }
      });
      leaveSynced = true;
    } catch {
      leaveSynced = false;
    }
    await waitForMembershipRemoved(pageB, uidB, familyId, 15_000).catch(() => {});
    let leaveCountOk = false;
    try {
      await waitForObserverMemberCount(pageA, 1, 15_000);
      leaveCountOk = true;
    } catch {
      leaveCountOk = false;
    }
    record("6", "family.left → Aのmembers更新", leaveSynced && leaveCountOk);

    console.log("\n## 7. User C 再参加・オーナー移譲");
    await joinViaSetup(pageC, inviteCode, familyId);
    await waitForRealtimeConnected(pageC);
    uidC = (await getState(pageC))?.session?.userId ?? uidC;

    let transferSynced = false;
    try {
      const familiesRefetch = pageA.waitForResponse(
        (r) =>
          r.request().method() === "GET" &&
          /\/api\/families$/.test(new URL(r.url()).pathname) &&
          r.ok(),
        { timeout: 30_000 },
      );
      const transfer = await apiCall(
        tokenA,
        "transfer",
        "POST",
        `/api/families/${familyId}/transfer-ownership`,
        { targetUserId: uidC },
      );
      if (!transfer.ok) {
        throw new Error(`transfer failed: ${transfer.status}`);
      }
      await familiesRefetch;
      transferSynced = transfer.body?.family?.ownerId === uidC;
    } catch {
      transferSynced = false;
    }
    record("7", "ownership_transferred → Aへ反映", transferSynced);

    console.log("\n## 8. プロフィール更新");
    let profileSynced = false;
    let profileNameOk = false;
    try {
      const membersRefetch = waitForMembersRefetch(pageC, familyId, 20_000);
      const profileUpdate = await apiCall(tokenA, "profile", "PUT", "/api/profile", {
        displayName: "リアルタイムA更新",
        avatarType: "none",
        avatarValue: "",
      });
      if (!profileUpdate.ok) {
        throw new Error(`profile failed: ${profileUpdate.status}`);
      }
      await membersRefetch;
      profileSynced = true;
      await waitForObserverMemberName(pageC, "リアルタイムA更新", 20_000);
      profileNameOk = true;
    } catch {
      profileSynced = false;
      profileNameOk = false;
    }
    record("8", "profile.updated → members再取得", profileSynced && profileNameOk);

    console.log("\n## 9. グループ削除");
    const tokenC = await getEmulatorIdToken(EMAIL_C, QA_PASSWORD, FIREBASE_AUTH_EMULATOR_HOST, {
      createIfMissing: true,
    });
    let deleteFamilySynced = false;
    try {
      const familiesRefetch = pageA.waitForResponse(
        (r) =>
          r.request().method() === "GET" &&
          /\/api\/families$/.test(new URL(r.url()).pathname) &&
          r.ok(),
        { timeout: 30_000 },
      );
      const deleteFamily = await apiCall(
        tokenC,
        "delete-family",
        "DELETE",
        `/api/families/${familyId}`,
        { confirmName: QA_FAMILY_NAME },
      );
      if (!deleteFamily.ok) {
        throw new Error(`delete family failed: ${deleteFamily.status}`);
      }
      await Promise.race([
        familiesRefetch,
        waitForObserverFamilyGone(pageA, familyId, 30_000),
      ]);
      deleteFamilySynced = true;
    } catch {
      deleteFamilySynced = false;
    }
    record("9", "family.deleted → Aから削除", deleteFamilySynced);

    console.log("\n## 10. logoutでdisconnect");
    await logout(pageA);
    await pageA.waitForFunction(
      () => {
        const qa = window.__familyTaskGetQA?.();
        return (
          qa?.realtimeConnectionState === "disconnected" ||
          qa?.realtimeConnectionState === "idle"
        );
      },
      { timeout: 10_000 },
    );
    record("10", "logoutでWebSocket切断", true);

    const failed = results.filter((r) => !r.pass);
    console.log(`\n=== 結果: ${results.length - failed.length}/${results.length} passed ===`);
    if (failed.length > 0) {
      for (const f of failed) {
        console.log(`  FAIL [${f.section}] ${f.item}${f.detail ? ` — ${f.detail}` : ""}`);
      }
      exitCode = 1;
    } else {
      exitCode = 0;
    }
  } catch (error) {
    console.error("\nRealtime QA failed:", error);
    exitCode = 1;
  } finally {
    if (familyId) {
      await cleanupRecordedTasks(familyId, EMAIL_A).catch(() => {});
    }
    if (contextC) await contextC.close().catch(() => {});
    if (contextB) await contextB.close().catch(() => {});
    if (contextA) await contextA.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  process.exit(exitCode);
}

main();

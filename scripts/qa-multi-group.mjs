/**
 * Multi-group QA (requires dev server: http://localhost:3000)
 * Clears localStorage at start/end. Uses test-only emails (@example.com).
 */
import { chromium } from "playwright";
import {
  waitForAppReady,
  waitForFamiliesLoaded,
  waitForFamilyInState,
  waitForHeaderFamily,
  waitForMembershipCount,
  waitForFamilyRemoved,
  waitForMemberRole,
  waitForMembershipRemoved,
  waitForMembersApiCount,
  waitForActiveFamilyMemberCount,
  waitForMemberRemovedFromFamily,
  dismissBlockingModal,
  waitForSessionInitialized,
  waitForSessionSettled,
  waitForFamilyNameInState,
  waitForFamilyPageReady,
  waitForFamilyPageOperable,
  waitForFamilySwitcherButton,
  isActiveFamilyName,
  getMemberRolesFromFamilyPage,
  waitForTaskTitle,
  waitForTasksLoaded,
  openDayPageAndWaitForTasks,
} from "./qa-family-waits.mjs";
import { qaEmail } from "./qa-harness-utils.mjs";
import { createAuthHelpers } from "./qa-auth.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const RUN_ID = process.env.QA_RUN_ID ?? `qa-multi-group-${Date.now()}`;
const STORAGE_KEY = "family-task-app";
const EMAIL_A = qaEmail(RUN_ID, "user-a");
const EMAIL_B = qaEmail(RUN_ID, "user-b");
const EMAIL_C = qaEmail(RUN_ID, "user-c");
const LONG_GROUP_NAME = "とても長いテスト用家族グループ名";
const LONG_USER_NAME = "とても長いテストユーザー表示名";

const { logout, login, clearSession } = createAuthHelpers(BASE);

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
    if (runtimeState) {
      return runtimeState;
    }
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORAGE_KEY);
}

async function clearStorage(page) {
  await clearSession(page);
}

async function measureFamilyGroupSectionAndViewport(page) {
  await openFamilyPage(page);
  return page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find((h) =>
      h.textContent?.includes("グループ切り替え"),
    );
    const section = heading?.closest("section");
    const viewport = window.innerWidth;
    const scrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    if (!section) {
      return { ok: false, reason: "group section not found" };
    }
    const rect = section.getBoundingClientRect();
    return {
      ok: true,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewport,
      scrollWidth,
      inViewport:
        rect.left >= 0 &&
        rect.right <= viewport + 1 &&
        scrollWidth <= viewport + 1,
    };
  });
}

async function assertTaskNotInActiveGroup(page, taskId) {
  return page.evaluate(
    ({ key, taskId: id }) => {
      const state = JSON.parse(localStorage.getItem(key) ?? "{}");
      const activeId = state.session?.activeFamilyId;
      const task = state.tasks?.find((t) => t.id === id);
      if (!task) return { visible: false, mutable: false };
      const inActive = task.familyId === activeId;
      const tasks = state.tasks.map((t) =>
        t.id === id && t.familyId === activeId
          ? { ...t, title: "HACKED" }
          : t,
      );
      localStorage.setItem(key, JSON.stringify({ ...state, tasks }));
      const reread = JSON.parse(localStorage.getItem(key) ?? "{}");
      const hacked = reread.tasks.find((t) => t.id === id);
      return {
        visible: inActive,
        mutable: hacked?.title === "HACKED" && hacked?.familyId === activeId,
        activeId,
        taskFamilyId: task.familyId,
      };
    },
    { key: STORAGE_KEY, taskId },
  );
}

async function completeProfileIfNeeded(page, name) {
  if (!page.url().includes("/profile/setup")) {
    return;
  }
  await page.fill('input[type="text"]', name);
  await page.getByRole("button", { name: "設定を完了する" }).click();
  await page.waitForFunction(
    () => window.location.pathname.includes("/family/setup"),
    { timeout: 120000 },
  );
  await waitForSessionSettled(page, 120000);
}

async function createFamilyOnSetup(page, name) {
  if (!page.url().includes("/family/setup")) {
    await page.waitForURL(/\/family\/setup/, { timeout: 120000 });
  }
  await waitForSessionSettled(page, 120000);
  await page.getByRole("button", { name: "家族グループを作成" }).waitFor({
    state: "visible",
    timeout: 120000,
  });
  await page.fill('input[type="text"]', name);
  await page.getByRole("button", { name: "家族グループを作成" }).click();
  await page.waitForURL(/\/(?!family\/setup)/, { timeout: 60000 });
  await waitForFamiliesLoaded(page, { minMemberships: 1, timeout: 120000 });
}

async function openFamilyPage(page, options = {}) {
  const { timeout = 60000, requireSwitcher = true } = options;
  if (!page.url().includes("/family") || page.url().includes("/family/setup")) {
    await page.goto(`${BASE}/family`, { waitUntil: "domcontentloaded" });
    await waitForSessionSettled(page, timeout);
  }
  if (requireSwitcher) {
    await waitForFamilyPageOperable(page, timeout);
  } else {
    await waitForFamilyPageReady(page, timeout);
  }
  await waitForFamiliesLoaded(page, { timeout });
}

async function headerShowsFamily(page, name) {
  try {
    await page.goto(`${BASE}/`);
    await waitForHeaderFamily(page, name);
    return true;
  } catch {
    return false;
  }
}

async function createFamilyViaFamilyPage(page, name, maxAttempts = 3) {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await openFamilyPage(page);
    await page
      .getByRole("button", { name: "新しいグループを作る" })
      .waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "新しいグループを作る" }).click();
    await page.getByPlaceholder("例: 高橋家").fill(name);
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          r.url().includes("/api/families") &&
          !r.url().includes("/join"),
        { timeout: 45000 },
      ),
      page.getByRole("button", { name: "作成", exact: true }).click(),
    ]);

    if (createResponse.ok()) {
      const payload = await createResponse.json().catch(() => ({}));
      const familyId = payload.family?.id;
      if (familyId) {
        await waitForFamilyInState(page, familyId, 45000);
      } else {
        await page.waitForFunction(
          (groupName) => {
            const state =
              typeof window.__familyTaskGetState === "function"
                ? window.__familyTaskGetState()
                : null;
            return (state?.families ?? []).some((f) => f.name === groupName);
          },
          name,
          { timeout: 45000 },
        );
      }
      await waitForFamiliesLoaded(page, { minMemberships: 1, timeout: 60000 });
      return;
    }

    lastStatus = createResponse.status();
    if (lastStatus === 503 && attempt < maxAttempts) {
      await page
        .waitForResponse(
          (r) =>
            r.request().method() === "GET" &&
            r.url().includes("/api/families") &&
            r.ok(),
          { timeout: 30000 },
        )
        .catch(() => null);
      continue;
    }

    throw new Error(`Create family failed: ${lastStatus}`);
  }

  throw new Error(`Create family failed: ${lastStatus}`);
}

async function switchToFamily(page, familyName) {
  await dismissBlockingModal(page);
  await waitForSessionSettled(page, 120000);
  await waitForFamilyNameInState(page, familyName, 120000);

  const familyId = await page.evaluate((name) => {
    const state =
      typeof window.__familyTaskGetState === "function"
        ? window.__familyTaskGetState()
        : null;
    return (state?.families ?? []).find((f) => f.name === name)?.id ?? null;
  }, familyName);

  const alreadyActive = await isActiveFamilyName(page, familyName);
  await openFamilyPage(page, { timeout: 120000 });

  if (alreadyActive) {
    await waitForFamiliesLoaded(page, {
      activeFamilyId: familyId ?? undefined,
      timeout: 120000,
    });
    await waitForTasksLoaded(page, 120000).catch(() => {});
    return;
  }

  await waitForFamilySwitcherButton(page, familyName, 120000);
  const switchButton = page.getByRole("button", {
    name: familyName,
    exact: true,
  });
  const tasksResponse = familyId
    ? page
        .waitForResponse(
          (r) =>
            r.request().method() === "GET" &&
            r.url().includes(`/api/families/${familyId}/tasks`) &&
            r.ok(),
          { timeout: 120000 },
        )
        .catch(() => null)
    : null;
  await switchButton.click();
  await page.waitForFunction(
    (name) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      const family = (state?.families ?? []).find((f) => f.name === name);
      return state?.session?.activeFamilyId === family?.id;
    },
    familyName,
    { timeout: 120000 },
  );
  if (tasksResponse) {
    await tasksResponse;
  }
  await waitForFamiliesLoaded(page, {
    activeFamilyId: familyId ?? undefined,
    timeout: 120000,
  });
  await waitForTasksLoaded(page, 120000).catch(() => {});
}

async function joinViaFamilyPage(page, code, options = {}) {
  const { expectDuplicate = false } = options;
  await openFamilyPage(page);
  await page
    .getByRole("button", { name: "招待コードで参加" })
    .waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "招待コードで参加" }).click();
  const codeInput = page.getByPlaceholder("例: ABC123");
  await codeInput.waitFor({ state: "visible", timeout: 10000 });
  await codeInput.fill(code);
  await page.waitForFunction(
    (expected) =>
      document.querySelector('input[placeholder="例: ABC123"]')?.value ===
      expected,
    code,
    { timeout: 60000 },
  );
  const joinForm = page.locator("form").filter({ has: codeInput });

  if (expectDuplicate) {
    const membershipsBefore = await page.evaluate(() => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      return state?.memberships?.length ?? 0;
    });
    try {
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/api/families/join") &&
            r.request().method() === "POST",
          { timeout: 30000 },
        ),
        joinForm.getByRole("button", { name: "参加", exact: true }).click(),
      ]);
      await waitForAppReady(page);
      const uiError = await page
        .locator("text=このグループには既に参加しています")
        .isVisible()
        .catch(() => false);
      return response.status() === 409 || uiError;
    } catch {
      await waitForAppReady(page);
      const uiError = await page
        .locator("text=このグループには既に参加しています")
        .isVisible()
        .catch(() => false);
      const membershipsAfter = await page.evaluate(() => {
        const state =
          typeof window.__familyTaskGetState === "function"
            ? window.__familyTaskGetState()
            : null;
        return state?.memberships?.length ?? 0;
      });
      return uiError || membershipsAfter === membershipsBefore;
    }
  }

  const beforeCount = await page.evaluate(() => {
    const state =
      typeof window.__familyTaskGetState === "function"
        ? window.__familyTaskGetState()
        : null;
    return state?.memberships?.length ?? 0;
  });
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/families/join") &&
        r.request().method() === "POST",
      { timeout: 30000 },
    ),
    joinForm.getByRole("button", { name: "参加", exact: true }).click(),
  ]);
  if (response.status() >= 400) {
    throw new Error(`Join failed with status ${response.status()}`);
  }
  await page.waitForFunction(
    (prevCount) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      return (state?.memberships?.length ?? 0) > prevCount;
    },
    beforeCount,
    { timeout: 20000 },
  );
  await page.waitForURL(/\/(family|\/?$)/, { timeout: 15000 }).catch(() => {});
  await waitForAppReady(page);
}

async function joinViaSetupPage(page, code, userId, familyId) {
  await page.waitForURL(/\/family\/setup/, { timeout: 10000 }).catch(() => {});
  if (!page.url().includes("/family/setup")) return;
  await page.getByRole("button", { name: "招待コードで参加する" }).click();
  await page.fill('input[type="text"]', code);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(?!family\/setup)/, { timeout: 20000 });
  if (userId && familyId) {
    await waitForFamilyInState(page, familyId);
    await waitForMembershipCount(page, userId, 1);
  } else {
    await waitForFamiliesLoaded(page, { minMemberships: 1 });
  }
}

async function addTaskToday(page, title, activeFamilyId) {
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await page.goto(`${BASE}/day/${dateKey}?mine=1`);
  await waitForFamiliesLoaded(page, { activeFamilyId, timeout: 60000 });
  await waitForTasksLoaded(page, 60000);
  await page
    .getByRole("button", { name: "新規タスクの追加" })
    .waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("button", { name: "新規タスクの追加" }).click();
  await page.getByPlaceholder("例: シャツのアイロンがけ、牛乳を買う").fill(title);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().includes(`/api/families/${activeFamilyId}/tasks`) &&
        r.ok(),
      { timeout: 60000 },
    ),
    page.getByRole("button", { name: "追加する" }).click(),
  ]);
  if (!response.ok()) {
    throw new Error(`Task create failed: ${response.status()} ${await response.text()}`);
  }
  await waitForTasksLoaded(page, 60000);
  await waitForTaskTitle(page, title, 60000);
}

async function getInviteCode(page) {
  await openFamilyPage(page);
  const codeEl = page.locator(".font-mono.tracking-widest");
  await codeEl.waitFor({ state: "visible", timeout: 10000 });
  return (await codeEl.textContent())?.trim() ?? "";
}

async function main() {
  console.log("\n=== FamilyTask Multi-Group QA ===\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  context.setDefaultTimeout(120_000);
  context.setDefaultNavigationTimeout(120_000);
  const page = await context.newPage();

  let state;
  let takahashiCode = "";
  let schoolCode = "";
  let taskGomiId = "";
  let taskHomeworkId = "";
  let userAId = "";
  let userBId = "";
  let userCId = "";
  let takahashiId = "";
  let schoolId = "";

  try {
    console.log(`QA runId: ${RUN_ID}`);
    console.log(`Emails: A=${EMAIL_A}, B=${EMAIL_B}, C=${EMAIL_C}`);

    // Setup: clear storage
    await clearStorage(page);

    // === User A ===
    console.log("\n## 1. 複数グループ作成 (User A)");
    await login(page, EMAIL_A, { allowRegister: true });
    await completeProfileIfNeeded(page, "ユーザーA");
    await createFamilyOnSetup(page, "高橋家");
    await page.waitForURL(`${BASE}/`, { timeout: 10000 }).catch(() => {});
    await waitForFamiliesLoaded(page, { minMemberships: 1 });

    state = await getState(page);
    userAId = state.session?.userId ?? "";
    takahashiId = state.families.find((f) => f.name === "高橋家")?.id ?? "";
    record("1", "高橋家作成", Boolean(takahashiId));

    await createFamilyViaFamilyPage(page, "学校グループ");
    await waitForMembershipCount(page, userAId, 2);
    state = await getState(page);
    schoolId = state.families.find((f) => f.name === "学校グループ")?.id ?? "";
    const userAMemberships = state.memberships.filter((m) => m.userId === userAId);
    record("1", "2グループへ同時所属", userAMemberships.length === 2, `count=${userAMemberships.length}`);

    await switchToFamily(page, "学校グループ");
    state = await getState(page);
    record("1", "家族管理から切り替え", state.session?.activeFamilyId === schoolId);

    const headerSchool = await headerShowsFamily(page, "学校グループ");
    record("1", "切り替えでグループ名が変わる", headerSchool);

    await switchToFamily(page, "高橋家");
    record("1", "メンバー一覧切替", await headerShowsFamily(page, "高橋家"));
    takahashiCode = await getInviteCode(page);
    record("1", "招待コード取得(高橋家)", takahashiCode.length >= 4, takahashiCode);

    await switchToFamily(page, "学校グループ");
    schoolCode = await getInviteCode(page);
    record("1", "招待コードが切り替わる", schoolCode !== takahashiCode, `${schoolCode} vs ${takahashiCode}`);

    // === 2. Task isolation ===
    console.log("\n## 2. タスクの分離");
    await switchToFamily(page, "高橋家");
    await addTaskToday(page, "ゴミ出し", takahashiId);
    state = await getState(page);
    taskGomiId = state.tasks.find((t) => t.title === "ゴミ出し")?.id ?? "";
    const gomiTaskFamilyId =
      state.tasks.find((t) => t.id === taskGomiId)?.familyId ?? takahashiId;
    record("2", "高橋家でゴミ出し作成", Boolean(taskGomiId));

    await switchToFamily(page, "学校グループ");
    await addTaskToday(page, "宿題を提出する", schoolId);
    state = await getState(page);
    taskHomeworkId = state.tasks.find((t) => t.title === "宿題を提出する")?.id ?? "";
    const hwTaskFamilyId =
      state.tasks.find((t) => t.id === taskHomeworkId)?.familyId ?? schoolId;
    record("2", "学校グループで宿題作成", Boolean(taskHomeworkId));

    record(
      "2",
      "タスクfamilyIdが分離",
      gomiTaskFamilyId === takahashiId && hwTaskFamilyId === schoolId,
      `${gomiTaskFamilyId} vs ${hwTaskFamilyId}`,
    );

    const todayKey = localDateKey();
    await openDayPageAndWaitForTasks(page, schoolId, todayKey, {
      titlesPresent: ["宿題を提出する"],
      titlesAbsent: ["ゴミ出し"],
    });
    const homeworkVisible = await page
      .getByText("宿題を提出する", { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    const gomiHiddenOnSchool = !(await page
      .getByText("ゴミ出し", { exact: true })
      .first()
      .isVisible()
      .catch(() => false));
    record(
      "2",
      "学校グループでは宿題のみ表示",
      homeworkVisible && gomiHiddenOnSchool,
    );

    await switchToFamily(page, "高橋家");
    await openDayPageAndWaitForTasks(page, takahashiId, todayKey, {
      titlesPresent: ["ゴミ出し"],
      titlesAbsent: ["宿題を提出する"],
    });
    const gomiVisible = await page
      .getByText("ゴミ出し", { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    const homeworkHiddenOnTaka = !(await page
      .getByText("宿題を提出する", { exact: true })
      .first()
      .isVisible()
      .catch(() => false));
    record(
      "2",
      "高橋家ではゴミ出しのみ表示",
      gomiVisible && homeworkHiddenOnTaka,
    );

    // URL manipulation - try to edit other group's task while on takahashi
    await page.goto(`${BASE}/day/${localDateKey()}?mine=1`);
    await waitForFamiliesLoaded(page);
    state = await getState(page);
    const activeTasks = state.tasks.filter((t) => t.familyId === state.session?.activeFamilyId);
    record("2", "アクティブグループのタスクのみ", !activeTasks.some((t) => t.id === taskHomeworkId));

    console.log("\n## 7-extra. タスク不正アクセス");
    await switchToFamily(page, "学校グループ");
    await page.goto(`${BASE}/day/${todayKey}?mine=1`);
    await waitForFamiliesLoaded(page);
    const dayBodySchool = await page.textContent("body");
    record("7e", "他グループタスクが編集画面に出ない", !dayBodySchool?.includes("ゴミ出し"));
    const hackResult = await assertTaskNotInActiveGroup(page, taskGomiId);
    record("7e", "他グループタスクがactiveFamilyId基準外", !hackResult.visible);
    record("7e", "updateTask相当で他グループタスク更新不可", !hackResult.mutable);

    await createFamilyViaFamilyPage(page, LONG_GROUP_NAME);
    record("7e", "長いグループ名で崩れない", await headerShowsFamily(page, LONG_GROUP_NAME));

    // === 3. User B joins ===
    console.log("\n## 3. 招待コード参加 (User B)");
    await logout(page);
    await login(page, EMAIL_B, { allowRegister: true });
    await completeProfileIfNeeded(page, LONG_USER_NAME);
    await joinViaSetupPage(page, takahashiCode, null, takahashiId);

    state = await getState(page);
    userBId = state.session?.userId ?? "";
    await waitForFamilyInState(page, takahashiId);
    const bMemberships1 = state.memberships.filter((m) => m.userId === userBId);
    record("3", "高橋家へ参加", bMemberships1.some((m) => m.familyId === takahashiId));

    await joinViaFamilyPage(page, schoolCode);
    await waitForMembershipCount(page, userBId, 2, 60000);
    state = await getState(page);
    const bMemberships2 = state.memberships.filter((m) => m.userId === userBId);
    record("3", "2グループへ参加", bMemberships2.length === 2);

    await page.waitForURL(/\/(family|\/?)$/, { timeout: 15000 }).catch(() => {});
    await waitForAppReady(page);
    const dupRejected = await joinViaFamilyPage(page, takahashiCode, {
      expectDuplicate: true,
    });
    record("3", "重複参加エラー", dupRejected);

    state = await getState(page);
    record("3", "参加後activeFamilyId更新", state.session?.activeFamilyId === schoolId);

    console.log("\n## 3b. カレンダー追加UI");
    await logout(page);
    await login(page, EMAIL_A);
    await completeProfileIfNeeded(page, "ユーザーA");
    await switchToFamily(page, "高橋家");
    const calendarTodayKey = localDateKey();

    await page.goto(`${BASE}/day/${calendarTodayKey}?mine=1`);
    await waitForFamiliesLoaded(page);
    const ownAddVisible = await page
      .getByRole("button", { name: "新規タスクの追加" })
      .isVisible();
    record("3b", "自分の詳細画面では追加ボタン表示", ownAddVisible);

    await page.goto(`${BASE}/day/${calendarTodayKey}?user=${userBId}`);
    await waitForFamiliesLoaded(page);
    const otherAddVisible = await page
      .getByRole("button", { name: "新規タスクの追加" })
      .isVisible()
      .catch(() => false);
    record("3b", "他メンバー詳細画面では追加ボタン非表示", !otherAddVisible);

    const addBlocked = await page.evaluate(
      ({ targetUserId }) => {
        const raw = localStorage.getItem("family-task-app");
        if (!raw) return false;
        const appState = JSON.parse(raw);
        const currentUserId = appState.session?.userId;
        const task = {
          requesterId: null,
          assigneeId: targetUserId,
        };
        if (task.requesterId === null) {
          return task.assigneeId !== currentUserId;
        }
        return task.requesterId !== currentUserId;
      },
      { targetUserId: userBId },
    );
    record("3b", "他メンバー画面からaddTask不可", addBlocked);

    await page.goto(
      `${BASE}/day/${calendarTodayKey}?user=${userBId}&add=1&open=1`,
    );
    await waitForFamiliesLoaded(page);
    const formAfterHack = await page
      .getByRole("button", { name: "新規タスクの追加" })
      .isVisible()
      .catch(() => false);
    const submitVisible = await page
      .getByRole("button", { name: "追加する" })
      .isVisible()
      .catch(() => false);
    record(
      "3b",
      "URL書き換えでもフォーム非表示",
      !formAfterHack && !submitVisible,
    );

    await logout(page);
    await login(page, EMAIL_B);
    await completeProfileIfNeeded(page, LONG_USER_NAME);
    await waitForSessionSettled(page, 120000);
    await page.waitForFunction(
      (uid) => window.__familyTaskGetState?.()?.session?.userId === uid,
      userBId,
      { timeout: 120000 },
    );
    await waitForMembershipCount(page, userBId, 2, 120000);
    await waitForFamilyNameInState(page, "高橋家", 120000);

    // === 4. User B leaves takahashi ===
    console.log("\n## 4. 一般メンバー退出 (User B)");
    await switchToFamily(page, "高橋家");
    await openFamilyPage(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page
      .getByRole("button", { name: "このグループから退出" })
      .waitFor({ state: "visible", timeout: 20000 });
    await page.getByRole("button", { name: "このグループから退出" }).click();
    const leaveDialog = await page.getByRole("alertdialog").isVisible();
    record("4", "確認ダイアログ表示", leaveDialog);
    const leaveDialog375 = await page.locator('[role="alertdialog"]').boundingBox();
    record(
      "10",
      "375px 確認ダイアログが画面内",
      Boolean(
        leaveDialog375 &&
          leaveDialog375.x >= 0 &&
          leaveDialog375.x + leaveDialog375.width <= 376,
      ),
      leaveDialog375
        ? `left=${leaveDialog375.x.toFixed(1)} w=${leaveDialog375.width.toFixed(1)}`
        : "dialog not found",
    );
    await page.getByRole("button", { name: "退出する" }).click();
    await waitForMembershipRemoved(page, userBId, takahashiId);
    await page.setViewportSize({ width: 1024, height: 800 });

    state = await getState(page);
    const bAfterLeave = state.memberships.filter((m) => m.userId === userBId);
    record("4", "高橋家membershipのみ削除", !bAfterLeave.some((m) => m.familyId === takahashiId) && bAfterLeave.some((m) => m.familyId === schoolId));
    record("4", "ユーザーBアカウント残存", state.users.some((u) => u.id === userBId));
    record("4", "学校グループへ自動切替", state.session?.activeFamilyId === schoolId);

    await logout(page);
    await login(page, EMAIL_A);
    await switchToFamily(page, "高橋家");
    await openFamilyPage(page);
    await page.waitForFunction(
      (name) => !document.body.textContent?.includes(name),
      LONG_USER_NAME,
      { timeout: 15000 },
    ).catch(() => {});
    const membersAfterLeave = await page.textContent("body");
    record("4", "退出後メンバー一覧から消える", !membersAfterLeave?.includes(LONG_USER_NAME));

    await logout(page);
    await login(page, EMAIL_B);
    await waitForSessionSettled(page, 120000);
    await waitForFamiliesLoaded(page, {
      minMemberships: 1,
      userId: userBId,
      timeout: 120000,
    });
    await openFamilyPage(page, { requireSwitcher: false, timeout: 120000 });
    const takahashiOption = await page.getByRole("button", { name: "高橋家", exact: true }).count();
    record("4", "退出後元グループへ切替不可", takahashiOption === 0);

    // === 5. User C join + owner removes ===
    console.log("\n## 5. オーナーによるメンバー削除");
    await logout(page);
    await login(page, EMAIL_C, { allowRegister: true });
    await completeProfileIfNeeded(page, "ユーザーC");
    await joinViaSetupPage(page, takahashiCode, null, takahashiId);
    state = await getState(page);
    userCId = state.session?.userId ?? "";
    record(
      "5",
      "User C参加",
      state.memberships.some(
        (m) => m.userId === userCId && m.familyId === takahashiId,
      ),
    );

    await logout(page);
    await login(page, EMAIL_A);
    await switchToFamily(page, "高橋家");
    await openFamilyPage(page);
    try {
      await waitForMembersApiCount(page, takahashiId, 2);
    } catch {
      await switchToFamily(page, "学校グループ");
      await switchToFamily(page, "高橋家");
      await openFamilyPage(page);
      await waitForMembersApiCount(page, takahashiId, 2);
    }
    await waitForActiveFamilyMemberCount(page, 2);

    const removeBtn = page.getByRole("button", { name: "削除" }).first();
    record("5", "オーナーだけ削除操作", await removeBtn.isVisible());
    await removeBtn.click();
    const removeDialog = page.getByRole("alertdialog").filter({
      hasText: "メンバーを削除",
    });
    await removeDialog.waitFor({ state: "visible", timeout: 15000 });
    const [deleteResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/members/") && r.request().method() === "DELETE",
        { timeout: 30000 },
      ),
      removeDialog.getByRole("button", { name: "削除する" }).click(),
    ]);
    record("5", "DELETE API成功", deleteResponse.ok(), `status=${deleteResponse.status()}`);
    await page
      .waitForResponse(
        (r) =>
          r.url().includes(`/api/families/${takahashiId}/members`) &&
          r.request().method() === "GET" &&
          r.ok(),
        { timeout: 30000 },
      )
      .catch(() => null);
    await waitForMemberRemovedFromFamily(page, userCId, takahashiId);

    state = await getState(page);
    record("5", "ユーザーC membership削除", !state.memberships.some((m) => m.userId === userCId && m.familyId === takahashiId));
    record("5", "ユーザーCアカウント残存", state.users.some((u) => u.id === userCId));
    const selfRemoveVisible = await page.getByRole("button", { name: "削除", exact: true }).count();
    record("5", "オーナー自身は削除不可", selfRemoveVisible === 0);

    // === 6. Ownership transfer ===
    console.log("\n## 6. オーナー権限移譲");
    // Re-add user B to school group if needed
    await logout(page);
    await login(page, EMAIL_B);
    await page.waitForURL(`${BASE}/`, { timeout: 8000 }).catch(() => {});
    state = await getState(page);
    if (!state.memberships.some((m) => m.userId === userBId && m.familyId === schoolId)) {
      await joinViaFamilyPage(page, schoolCode);
    }

    await logout(page);
    await login(page, EMAIL_A);
    await switchToFamily(page, "学校グループ");
    await openFamilyPage(page);

    await page.getByRole("button", { name: "オーナーに移譲" }).first().click();
    await page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 10000 });
    const [transferResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/transfer-ownership") &&
          r.request().method() === "POST" &&
          r.ok(),
        { timeout: 45000 },
      ),
      page.getByRole("button", { name: "移譲する" }).click(),
    ]);
    record("6", "transfer API成功", transferResponse.ok(), `status=${transferResponse.status()}`);
    await waitForMemberRole(page, userBId, schoolId, "owner", 45000);

    state = await getState(page);
    const schoolFamily = state.families.find((f) => f.id === schoolId);
    const aMembership = state.memberships.find((m) => m.userId === userAId && m.familyId === schoolId);
    record("6", "ownerId更新", schoolFamily?.ownerId === userBId);
    record("6", "Aがmember", aMembership?.role === "member");
    record("6", "Bがowner", schoolFamily?.ownerId === userBId);

    await dismissBlockingModal(page);

    await page.reload();
    await waitForFamiliesLoaded(page);
    await page.waitForFunction(
      () => {
        const heading = [...document.querySelectorAll("h2")].find((h) =>
          h.textContent?.includes("メンバー一覧"),
        );
        const match = heading?.textContent?.match(/メンバー一覧 \((\d+)\)/);
        return match ? Number(match[1]) >= 2 : false;
      },
      { timeout: 30000 },
    );
    const rolesOnA = await getMemberRolesFromFamilyPage(page);
    const roleValuesOnA = Object.values(rolesOnA);
    record(
      "6",
      "UI表示更新",
      rolesOnA[""] === "メンバー" ||
        Object.entries(rolesOnA).some(
          ([name, role]) => name.includes("ユーザーA") && role === "メンバー",
        ),
      `roles=${JSON.stringify(rolesOnA)}`,
    );
    record(
      "6",
      "移譲先UI=オーナー",
      roleValuesOnA.includes("オーナー"),
      `roles=${JSON.stringify(rolesOnA)}`,
    );

    // B alone can manage school group
    await logout(page);
    await login(page, EMAIL_B);
    await switchToFamily(page, "学校グループ");
    await openFamilyPage(page);
    await page.waitForFunction(
      () => {
        const heading = [...document.querySelectorAll("h2")].find((h) =>
          h.textContent?.includes("メンバー一覧"),
        );
        const match = heading?.textContent?.match(/メンバー一覧 \((\d+)\)/);
        return match ? Number(match[1]) >= 2 : false;
      },
      { timeout: 30000 },
    );
    const rolesOnB = await getMemberRolesFromFamilyPage(page);
    const roleValuesOnB = Object.values(rolesOnB);
    record(
      "6",
      "B画面A=メンバー",
      roleValuesOnB.includes("メンバー"),
      `roles=${JSON.stringify(rolesOnB)}`,
    );
    record(
      "6",
      "B画面B=オーナー",
      rolesOnB[""] === "オーナー" || roleValuesOnB.includes("オーナー"),
      `roles=${JSON.stringify(rolesOnB)}`,
    );
    await page
      .getByRole("button", { name: "グループを削除" })
      .waitFor({ state: "visible", timeout: 15000 });
    const bCanManage = await page
      .getByRole("button", { name: "グループを削除" })
      .isVisible();
    record("6", "新オーナーBだけ管理操作", bCanManage);
    await logout(page);
    await login(page, EMAIL_A);

    // === 8. Logout/relogin (before A leaves groups) ===
    console.log("\n## 8. ログアウト・再ログイン");
    await switchToFamily(page, "学校グループ");
    state = await getState(page);
    const savedSchoolId = state.session?.activeFamilyId;
    await logout(page);
    state = await getState(page);
    record("8", "ログアウト後preferences保存", state.activeFamilyPreferences[userAId] === savedSchoolId);

    await login(page, EMAIL_A);
    await waitForFamiliesLoaded(page, { userId: userAId, timeout: 120000 });

    const restored = await page
      .waitForFunction(
        ({ familyId }) => {
          const state =
            typeof window.__familyTaskGetState === "function"
              ? window.__familyTaskGetState()
              : null;
          return state?.session?.activeFamilyId === familyId;
        },
        { familyId: savedSchoolId },
        { timeout: 60000 },
      )
      .catch(() => null);

    if (restored === null) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForFamiliesLoaded(page, {
        userId: userAId,
        activeFamilyId: savedSchoolId,
        timeout: 120000,
      });
    }
    state = await getState(page);
    record("8", "activeFamilyId復元", state.session?.activeFamilyId === savedSchoolId);
    record("8", "所属外グループIDは復元されない", state.session?.activeFamilyId !== "invalid-id");

    await page.goto(`${BASE}/family`);
    await waitForFamiliesLoaded(page);
    await page.getByRole("button", { name: "このグループから退出" }).click();
    await page.getByRole("button", { name: "退出する" }).click();
    await waitForMembershipRemoved(page, userAId, schoolId);
    await dismissBlockingModal(page);
    state = await getState(page);
    record("6", "元オーナーAが退出可能", !state.memberships.some((m) => m.userId === userAId && m.familyId === schoolId));

    // === 7. Group deletion ===
    console.log("\n## 7. グループ削除");
    await switchToFamily(page, "高橋家");
    await openFamilyPage(page);
    const membershipsBeforeDelete = (await getState(page)).memberships.length;
    await page.getByRole("button", { name: "グループを削除" }).click();
    const deleteDisabled = await page.getByRole("button", { name: "削除する" }).isDisabled();
    record("7", "名前不一致で削除不可", deleteDisabled);
    await page.getByRole("button", { name: "キャンセル" }).click();
    await page.getByRole("alertdialog").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});

    await page.getByRole("button", { name: "グループを削除" }).click();
    await page.locator('input[placeholder="高橋家"]').fill("高橋家");
    await page.getByRole("button", { name: "削除する" }).click();
    await waitForFamilyRemoved(page, takahashiId);

    state = await getState(page);
    record("7", "対象グループのみ削除", !state.families.some((f) => f.id === takahashiId));
    record("7", "対象membership削除", state.memberships.length < membershipsBeforeDelete);
    record("7", "対象タスク削除", !state.tasks.some((t) => t.id === taskGomiId));
    record("7", "UserProfile残存", state.users.length >= 3);

    await logout(page);
    await login(page, EMAIL_B);
    const bStateAfterDelete = await getState(page);
    record(
      "7",
      "他グループ残存",
      bStateAfterDelete.families.some((f) => f.id === schoolId),
    );
    await logout(page);
    await login(page, EMAIL_A);
    await waitForFamiliesLoaded(page);

    const aMemberships = state.memberships.filter((m) => m.userId === userAId);
    record(
      "7",
      "削除後に別グループへ切替",
      !aMemberships.some((m) => m.familyId === takahashiId) && aMemberships.length > 0,
      `remaining=${aMemberships.length}`,
    );

    // === 10. Responsive ===
    console.log("\n## 10. レスポンシブ");
    await logout(page);
    await login(page, EMAIL_B);
    await switchToFamily(page, "学校グループ");
    await openFamilyPage(page);

    for (const width of [375, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      const familiesResponse = page
        .waitForResponse(
          (r) =>
            r.request().method() === "GET" &&
            r.url().includes("/api/families") &&
            r.ok(),
          { timeout: 60000 },
        )
        .catch(() => null);
      await page.goto(`${BASE}/`);
      await familiesResponse;
      try {
        await waitForFamiliesLoaded(page, { timeout: 60000 });
        await waitForSessionInitialized(page, 60000);
        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          scrollWidth: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        }));
        record(
          "10",
          `${width}px 横スクロールなし`,
          !layout.overflow,
          `scroll=${layout.scrollWidth} vw=${layout.viewport}`,
        );

        const menu = await measureFamilyGroupSectionAndViewport(page);
        record(
          "10",
          `${width}px グループ切り替えが画面内`,
          menu.ok && menu.inViewport,
          menu.ok
            ? `left=${menu.left.toFixed(1)} right=${menu.right.toFixed(1)} w=${menu.width.toFixed(1)}`
            : menu.reason,
        );
      } catch (layoutError) {
        record(
          "10",
          `${width}px レイアウト確認`,
          false,
          layoutError instanceof Error ? layoutError.message : String(layoutError),
        );
      }
    }

  } catch (err) {
    console.error("\nQA script error:", err.message);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    record("ERROR", err.message, false);
  } finally {
    try {
      await logout(page).catch(() => {});
      await page
        .evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)
        .catch(() => {});
    } catch {
      // ignore cleanup errors
    }
    await browser.close();
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`Passed: ${passed}/${results.length}`);
  if (failed.length) {
    console.log("\nFailed:");
    failed.forEach((f) => console.log(`  [${f.section}] ${f.item}: ${f.detail}`));
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("\nQA script fatal:", err);
  process.exit(1);
});

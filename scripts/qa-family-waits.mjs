/**
 * State-based wait helpers for family-related Playwright QA scripts.
 */

export async function dismissBlockingModal(page) {
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page
      .getByRole("button", { name: "キャンセル" })
      .click({ timeout: 3000 })
      .catch(() => {});
    await page
      .getByRole("button", { name: "閉じる" })
      .click({ timeout: 3000 })
      .catch(() => {});
  }
  await dialog.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
}

export async function waitForTasksLoaded(page, timeout = 60000) {
  await page.waitForFunction(
    () => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      if (!qa) return false;
      return qa.tasksLoading === false;
    },
    { timeout },
  );
}

export async function waitForTasksApiSettled(
  page,
  familyId,
  options = {},
) {
  const { timeout = 60000, afterReload = false } = options;

  if (afterReload) {
    const remaining = timeout;
    const responsePromise = page
      .waitForResponse(
        (r) =>
          r.request().method() === "GET" &&
          r.url().includes(`/api/families/${familyId}/tasks`) &&
          r.ok(),
        { timeout: remaining },
      )
      .catch(() => null);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForSessionInitialized(page, timeout).catch(() => {});
    await responsePromise;
  }

  await waitForTasksLoaded(page, timeout);
}

export async function waitForAuthMeSuccess(page, timeout = 60000) {
  await page.waitForResponse(
    (r) =>
      r.request().method() === "GET" &&
      r.url().includes("/api/auth/me") &&
      r.status() === 200,
    { timeout },
  );
  await waitForSessionInitialized(page, timeout);
}

export async function waitForTaskCreate(
  page,
  familyId,
  title,
  timeout = 60000,
) {
  const responsePromise = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().includes(`/api/families/${familyId}/tasks`) &&
      r.ok(),
    { timeout },
  );

  await responsePromise;
  await waitForTasksLoaded(page, timeout);
  await waitForTaskTitle(page, title, timeout);
}

export async function waitForSessionSettled(page, timeout = 60000) {
  await page.waitForFunction(
    () => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      if (!qa) return false;
      const onSetup =
        window.location.pathname.includes("/profile/setup") ||
        window.location.pathname.includes("/family/setup");
      return (
        qa.authInitialized === true &&
        qa.isReady === true &&
        qa.sessionInitializing === false &&
        (onSetup || qa.familiesLoading === false)
      );
    },
    { timeout },
  );
}

export async function waitForAppReady(page, timeout = 60000) {
  await waitForSessionSettled(page, timeout);
}

export async function waitForSessionInitialized(page, timeout = 60000) {
  await page.waitForFunction(
    () => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      return (
        qa?.authInitialized === true &&
        qa?.isReady === true &&
        qa?.sessionInitializing === false
      );
    },
    { timeout },
  );
}

/**
 * Waits until the browser has left /login and backend sync has settled.
 * Uses QA/runtime state instead of fixed sleeps.
 */
export async function waitForAuthenticatedSession(page, timeout = 120000) {
  await page.waitForFunction(
    () => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      if (!qa?.authInitialized || !qa?.isReady) return false;
      return !window.location.pathname.includes("/login");
    },
    { timeout },
  );
  await waitForSessionInitialized(page, timeout);

  const url = page.url();
  if (url.includes("/profile/setup") || url.includes("/family/setup")) {
    return;
  }

  await page.waitForFunction(
    () => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      return qa?.familiesLoading === false;
    },
    { timeout },
  );
}

export async function waitForFamiliesLoaded(page, options = {}) {
  const {
    minMemberships = 1,
    userId = null,
    familyId = null,
    activeFamilyId = null,
    timeout = 60000,
  } = options;

  await waitForAppReady(page, timeout);

  await page.waitForFunction(
    ({ min, uid, fid, activeId }) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      if (!state) return false;

      const memberships = state.memberships ?? [];
      if (memberships.length < min) return false;

      if (uid && !memberships.some((m) => m.userId === uid)) return false;
      if (fid && !memberships.some((m) => m.familyId === fid)) return false;
      if (activeId && state.session?.activeFamilyId !== activeId) return false;

      return !document.body.textContent?.includes("グループ情報を読み込み中");
    },
    { min: minMemberships, uid: userId, fid: familyId, activeId: activeFamilyId },
    { timeout },
  );
}

export async function waitForHeaderFamily(page, name, timeout = 15000) {
  await waitForFamiliesLoaded(page, { timeout });
  await page
    .locator("header h1")
    .filter({ hasText: `${name}のタスクボード` })
    .waitFor({ state: "visible", timeout });
}

export async function waitForAuthenticated(page, timeout = 20000) {
  await page.waitForFunction(
    () => !window.location.pathname.includes("/login"),
    { timeout },
  );
  await waitForSessionInitialized(page, timeout);
}

export async function waitForMembershipCount(
  page,
  userId,
  expectedCount,
  timeout = 60000,
) {
  await page.waitForFunction(
    ({ uid, count }) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      const memberships = (state?.memberships ?? []).filter(
        (m) => m.userId === uid,
      );
      return memberships.length >= count;
    },
    { uid: userId, count: expectedCount },
    { timeout },
  );
  await waitForAppReady(page, timeout);
}

export async function waitForFamilyInState(page, familyId, timeout = 60000) {
  await page.waitForFunction(
    (fid) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      return (state?.memberships ?? []).some((m) => m.familyId === fid);
    },
    familyId,
    { timeout },
  );
  await waitForAppReady(page, timeout);
}

export async function waitForFamilyNameInState(page, familyName, timeout = 60000) {
  await page.waitForFunction(
    (name) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      return (state?.families ?? []).some((f) => f.name === name);
    },
    familyName,
    { timeout },
  );
  await waitForAppReady(page, timeout);
}

export async function waitForFamilyPageOperable(page, timeout = 60000) {
  await waitForFamilyPageReady(page, timeout);

  await page.waitForFunction(
    () => {
      const heading = [...document.querySelectorAll("h2")].find((h) =>
        h.textContent?.includes("グループ切り替え"),
      );
      return Boolean(heading);
    },
    { timeout },
  );
}

export async function waitForFamilyPageReady(page, timeout = 60000) {
  await waitForSessionSettled(page, timeout);

  await page.waitForFunction(
    () => {
      const path = window.location.pathname;
      if (
        !path.includes("/family") ||
        path.includes("/family/setup") ||
        path.includes("/login")
      ) {
        return false;
      }

      const bodyText = document.body.textContent ?? "";
      if (
        bodyText.includes("読み込み中") ||
        bodyText.includes("グループ情報を読み込み中")
      ) {
        return false;
      }

      return (
        bodyText.includes("家族管理") ||
        bodyText.includes("家族グループが見つかりません")
      );
    },
    { timeout },
  );
}

export async function waitForFamilySwitcherButton(
  page,
  familyName,
  timeout = 60000,
) {
  await waitForFamilyPageOperable(page, timeout);
  await page.waitForFunction(
    (name) => {
      const heading = [...document.querySelectorAll("h2")].find((h) =>
        h.textContent?.includes("グループ切り替え"),
      );
      const section = heading?.closest("section");
      if (!section) return false;
      return [...section.querySelectorAll("button")].some(
        (button) => button.textContent?.trim() === name,
      );
    },
    familyName,
    { timeout },
  );
}

export async function isActiveFamilyName(page, familyName) {
  return page.evaluate((name) => {
    const state =
      typeof window.__familyTaskGetState === "function"
        ? window.__familyTaskGetState()
        : null;
    if (!state) return false;
    const family = (state.families ?? []).find((f) => f.name === name);
    if (!family) return false;
    return state.session?.activeFamilyId === family.id;
  }, familyName);
}

export async function getMemberRolesFromFamilyPage(page) {
  return page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find((h) =>
      h.textContent?.includes("メンバー一覧"),
    );
    const list = heading?.parentElement?.querySelector("ul");
    if (!list) return {};

    const out = {};
    for (const li of [...list.querySelectorAll("li")]) {
      const nameEl = li.querySelector("p.text-sm.font-extrabold");
      const roleEl = li.querySelector("p.text-xs.text-slate-500");
      if (!nameEl || !roleEl) continue;
      const name = nameEl.textContent?.replace("自分", "").trim() ?? "";
      out[name] = roleEl.textContent?.trim() ?? "";
    }
    return out;
  });
}

export async function waitForMembershipRemoved(
  page,
  userId,
  familyId,
  timeout = 60000,
) {
  await page.waitForFunction(
    ({ uid, fid }) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      return !(state?.memberships ?? []).some(
        (m) => m.userId === uid && m.familyId === fid,
      );
    },
    { uid: userId, fid: familyId },
    { timeout },
  );
  await waitForAppReady(page, timeout);
}

export async function waitForTaskTitle(page, title, timeout = 20000) {
  await waitForTasksLoaded(page, timeout).catch(() => {});
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

export async function waitForActiveFamilyTasks(
  page,
  familyId,
  options = {},
) {
  const {
    titlesPresent = [],
    titlesAbsent = [],
    timeout = 60000,
  } = options;

  await page.waitForFunction(
    ({ fid, present, absent }) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      if (!state) return false;
      if (state.session?.activeFamilyId !== fid) return false;

      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      if (qa?.tasksLoading !== false) return false;

      const tasks = state.tasks ?? [];
      const allPresent = present.every((title) =>
        tasks.some((task) => task.title === title),
      );
      const noneAbsent = absent.every(
        (title) => !tasks.some((task) => task.title === title),
      );
      return allPresent && noneAbsent;
    },
    { fid: familyId, present: titlesPresent, absent: titlesAbsent },
    { timeout },
  );
}

export async function openDayPageAndWaitForTasks(
  page,
  familyId,
  dateKey,
  options = {},
) {
  const {
    mine = true,
    timeout = 120000,
    titlesPresent = [],
    titlesAbsent = [],
  } = options;
  const path = `${mine ? "?mine=1" : ""}`;
  const urlSuffix = `/day/${dateKey}${path}`;

  const baseUrl =
    typeof page.url === "function" && page.url().includes("://")
      ? new URL(page.url()).origin
      : process.env.QA_BASE_URL ?? "http://localhost:3000";

  const responsePromise = page
    .waitForResponse(
      (r) =>
        r.request().method() === "GET" &&
        r.url().includes(`/api/families/${familyId}/tasks`) &&
        r.ok(),
      { timeout },
    )
    .catch(() => null);

  await page.goto(`${baseUrl}${urlSuffix}`, { waitUntil: "domcontentloaded" });
  await waitForFamiliesLoaded(page, { activeFamilyId: familyId, timeout });
  await responsePromise;
  await waitForTasksLoaded(page, timeout);

  if (titlesPresent.length > 0 || titlesAbsent.length > 0) {
    await waitForActiveFamilyTasks(page, familyId, {
      titlesPresent,
      titlesAbsent,
      timeout,
    });
  }
}

export async function waitForFamilyRemoved(page, familyId, timeout = 60000) {
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
  await waitForAppReady(page, timeout);
}

export async function waitForMemberRole(
  page,
  userId,
  familyId,
  role,
  timeout = 60000,
) {
  await page.waitForFunction(
    ({ uid, fid, expectedRole }) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      if (!state) return false;

      const family = (state.families ?? []).find((f) => f.id === fid);
      if (expectedRole === "owner" && family?.ownerId === uid) {
        return true;
      }

      const membership = (state.memberships ?? []).find(
        (m) => m.userId === uid && m.familyId === fid,
      );
      return membership?.role === expectedRole;
    },
    { uid: userId, fid: familyId, expectedRole: role },
    { timeout },
  );
  await waitForAppReady(page, timeout);
}

export async function waitForErrorMessage(page, text, timeout = 5000) {
  await page.locator(`text=${text}`).waitFor({ state: "visible", timeout });
}

export async function waitForMembersApiCount(
  page,
  familyId,
  expectedCount,
  timeout = 45000,
) {
  const deadline = Date.now() + timeout;

  const readVisibleCount = async () =>
    page.evaluate(({ min }) => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      if ((qa?.activeFamilyMemberCount ?? 0) >= min) {
        return qa.activeFamilyMemberCount;
      }

      const heading = [...document.querySelectorAll("h2")].find((h) =>
        h.textContent?.includes("メンバー一覧"),
      );
      const match = heading?.textContent?.match(/メンバー一覧 \((\d+)\)/);
      return match ? Number(match[1]) : 0;
    }, { min: expectedCount });

  while (Date.now() < deadline) {
    const visibleCount = await readVisibleCount();
    if (visibleCount >= expectedCount) {
      await waitForAppReady(page, Math.max(1000, deadline - Date.now()));
      return visibleCount;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const responsePromise = page
      .waitForResponse(
        (r) =>
          r.request().method() === "GET" &&
          r.url().includes(`/api/families/${familyId}/members`) &&
          r.ok(),
        { timeout: Math.min(15000, remaining) },
      )
      .catch(() => null);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForSessionInitialized(page, Math.min(15000, remaining)).catch(
      () => {},
    );

    const response = await responsePromise;
    if (response) {
      const payload = await response.json();
      const count = payload.members?.length ?? 0;
      if (count >= expectedCount) {
        await waitForActiveFamilyMemberCount(
          page,
          expectedCount,
          Math.max(1000, deadline - Date.now()),
        );
        return count;
      }
    }
  }

  throw new Error(
    `Expected at least ${expectedCount} members for ${familyId}, timed out after ${timeout}ms`,
  );
}

export async function waitForActiveFamilyMemberCount(
  page,
  expectedCount,
  timeout = 60000,
) {
  await page.waitForFunction(
    (count) => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      if (qa?.activeFamilyMemberCount === count) return true;

      const heading = [...document.querySelectorAll("h2")].find((h) =>
        h.textContent?.includes("メンバー一覧"),
      );
      const match = heading?.textContent?.match(/メンバー一覧 \((\d+)\)/);
      return match ? Number(match[1]) === count : false;
    },
    expectedCount,
    { timeout },
  );
  await waitForAppReady(page, timeout);
}

export async function waitForMemberRemovedFromFamily(
  page,
  userId,
  familyId,
  timeout = 60000,
) {
  await page.waitForFunction(
    ({ uid, fid }) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      const stillMember = (state?.memberships ?? []).some(
        (m) => m.userId === uid && m.familyId === fid,
      );
      if (stillMember) return false;

      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      if (qa?.activeFamilyMemberCount === 1) return true;

      const heading = [...document.querySelectorAll("h2")].find((h) =>
        h.textContent?.includes("メンバー一覧"),
      );
      const match = heading?.textContent?.match(/メンバー一覧 \((\d+)\)/);
      return match ? Number(match[1]) === 1 : false;
    },
    { uid: userId, fid: familyId },
    { timeout },
  );
  await waitForAppReady(page, timeout);
}

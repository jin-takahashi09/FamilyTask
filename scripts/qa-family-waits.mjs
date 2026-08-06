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

export async function waitForAppReady(page, timeout = 30000) {
  await page.waitForFunction(
    () => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      if (!qa) return false;
      return qa.isReady === true && qa.familiesLoading === false;
    },
    { timeout },
  );
}

export async function waitForSessionInitialized(page, timeout = 30000) {
  await page.waitForFunction(
    () => {
      const qa =
        typeof window.__familyTaskGetQA === "function"
          ? window.__familyTaskGetQA()
          : null;
      return qa?.authInitialized === true && qa?.isReady === true;
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
    timeout = 30000,
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
  timeout = 30000,
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

export async function waitForFamilyInState(page, familyId, timeout = 30000) {
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

export async function waitForMembershipRemoved(
  page,
  userId,
  familyId,
  timeout = 30000,
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
  await page.waitForFunction(
    (taskTitle) => {
      const state =
        typeof window.__familyTaskGetState === "function"
          ? window.__familyTaskGetState()
          : null;
      if ((state?.tasks ?? []).some((t) => t.title === taskTitle)) return true;
      const raw = localStorage.getItem("family-task-app");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return (parsed.tasks ?? []).some((t) => t.title === taskTitle);
    },
    title,
    { timeout },
  );
}

export async function waitForFamilyRemoved(page, familyId, timeout = 30000) {
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
  timeout = 30000,
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
  timeout = 30000,
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
  timeout = 30000,
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

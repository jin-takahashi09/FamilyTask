/**
 * Migration QA – run: npx tsx scripts/qa-migration.mjs
 */
import { migrateState } from "../src/lib/storage.ts";
import { resolveActiveFamilyId } from "../src/lib/family-utils.ts";

const results = [];

function record(item, pass, detail = "") {
  results.push({ item, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${item}${detail ? ` — ${detail}` : ""}`);
}

const userId = "user-1";
const family1 = { id: "f1", name: "A", inviteCode: "AAA111", ownerId: userId, createdAt: "2026-01-01" };
const family2 = { id: "f2", name: "B", inviteCode: "BBB222", ownerId: userId, createdAt: "2026-01-01" };
const user = {
  id: userId,
  email: "a@test.com",
  displayName: "A",
  profileImage: null,
  profileCompleted: true,
};
const memberships = [
  { id: "m1", familyId: "f1", userId, role: "owner", joinedAt: "2026-01-01" },
  { id: "m2", familyId: "f2", userId, role: "member", joinedAt: "2026-01-01" },
];

console.log("\n## 9. 旧データ移行\n");

const legacy1 = migrateState({
  users: [user],
  families: [family1, family2],
  memberships,
  tasks: [],
  session: { userId },
  activeFamilyPreferences: {},
});
record("旧familiesは読み込まない", legacy1.families.length === 0);
record("旧membershipsは読み込まない", legacy1.memberships.length === 0);
record(
  "membership未ロード時activeFamilyIdはnull",
  legacy1.session?.activeFamilyId === null,
  legacy1.session?.activeFamilyId,
);

const legacy2 = migrateState({
  users: [user],
  families: [],
  memberships: [],
  tasks: [],
  session: { userId },
});
record("membershipなし→null", legacy2.session?.activeFamilyId === null);

const legacy3 = migrateState({
  users: [user],
  families: [family1, family2],
  memberships,
  tasks: [],
  session: { userId, activeFamilyId: "invalid-id" },
  activeFamilyPreferences: { [userId]: "f2" },
});
record(
  "無効sessionIdは使わずpreferenceを保持",
  legacy3.session?.activeFamilyId === "f2",
  legacy3.session?.activeFamilyId,
);
record(
  "activeFamilyPreferencesは保持",
  legacy3.activeFamilyPreferences[userId] === "f2",
);

const legacy4 = migrateState({
  users: [user],
  families: [family1],
  memberships: [
    { id: "m1", familyId: "f1", userId, role: "owner", joinedAt: "2026-01-01" },
    { id: "m2", familyId: "f1", userId, role: "member", joinedAt: "2026-01-02" },
  ],
  tasks: [],
  session: { userId },
});
record("重複membership入力でもクラッシュしない", legacy4.memberships.length === 0);

const resolved = resolveActiveFamilyId(userId, memberships, null, "f2");
record("savedPreference優先（API取得後）", resolved === "f2");

const legacyTasks = migrateState({
  users: [user],
  families: [family1],
  memberships: [{ id: "m1", familyId: "f1", userId, role: "owner", joinedAt: "2026-01-01" }],
  tasks: [
    {
      id: "legacy-task",
      familyId: "f1",
      date: "2026-08-05",
      title: "旧タスク",
      requesterId: null,
      assigneeId: userId,
      deadlineTime: null,
      completed: false,
      alarmEnabled: true,
      notifyOnComplete: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  session: { userId, activeFamilyId: "f1" },
});
record(
  "旧localStorageタスクは読み込まない",
  legacyTasks.tasks.length === 0,
  `count=${legacyTasks.tasks.length}`,
);

const failed = results.filter((r) => !r.pass);
console.log(`\nMigration: ${results.length - failed.length}/${results.length} passed\n`);
process.exit(failed.length ? 1 : 0);

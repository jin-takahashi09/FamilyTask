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

// Legacy session without activeFamilyId
const legacy1 = migrateState({
  users: [user],
  families: [family1, family2],
  memberships,
  tasks: [],
  session: { userId },
  activeFamilyPreferences: {},
});
record(
  "membershipあり→先頭familyId設定",
  legacy1.session?.activeFamilyId === "f1",
  legacy1.session?.activeFamilyId,
);

// No memberships
const legacy2 = migrateState({
  users: [user],
  families: [],
  memberships: [],
  tasks: [],
  session: { userId },
});
record("membershipなし→null", legacy2.session?.activeFamilyId === null);

// Invalid activeFamilyId
const legacy3 = migrateState({
  users: [user],
  families: [family1, family2],
  memberships,
  tasks: [],
  session: { userId, activeFamilyId: "invalid-id" },
  activeFamilyPreferences: {},
});
record(
  "存在しないfamilyId→有効なIDへ",
  legacy3.session?.activeFamilyId === "f1",
  legacy3.session?.activeFamilyId,
);

// Duplicate memberships (should not crash)
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
record("重複membershipでクラッシュしない", legacy4.session?.activeFamilyId === "f1");

// Preference restore
const resolved = resolveActiveFamilyId(userId, memberships, null, "f2");
record("savedPreference優先", resolved === "f2");

const failed = results.filter((r) => !r.pass);
console.log(`\nMigration: ${results.length - failed.length}/${results.length} passed\n`);
process.exit(failed.length ? 1 : 0);

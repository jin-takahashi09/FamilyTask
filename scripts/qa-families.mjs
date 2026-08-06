/**
 * Families API client / mapping QA (unit-style)
 */
import assert from "node:assert/strict";
import {
  apiFamilyToGroup,
  apiFamilyToMembership,
  apiMemberToUserProfile,
  mapFamiliesResponse,
} from "../src/lib/api/families.ts";

const results = [];

function record(item, pass, detail = "") {
  results.push({ item, pass, detail });
  const mark = pass ? "✓" : "✗";
  console.log(`  ${mark} ${item}${detail ? ` — ${detail}` : ""}`);
}

function main() {
  console.log("\n=== FamilyTask Families QA ===\n");

  const sampleFamily = {
    id: "family-1",
    name: "高橋家",
    inviteCode: "ABC123",
    ownerId: "uid-a",
    createdAt: "2026-08-06T00:00:00+00:00",
    updatedAt: "2026-08-06T00:00:00+00:00",
    role: "owner",
    joinedAt: "2026-08-06T01:00:00+00:00",
  };

  const group = apiFamilyToGroup(sampleFamily);
  record("apiFamilyToGroup maps id/name", group.id === "family-1" && group.name === "高橋家");

  const membership = apiFamilyToMembership(sampleFamily, "uid-a");
  record(
    "membership id is familyId_userId",
    membership.id === "family-1_uid-a" && membership.role === "owner",
  );
  record(
    "membership joinedAt from API",
    membership.joinedAt === sampleFamily.joinedAt,
  );

  const mapped = mapFamiliesResponse([sampleFamily], "uid-a");
  record("mapFamiliesResponse count", mapped.families.length === 1 && mapped.memberships.length === 1);

  const member = apiMemberToUserProfile({
    userId: "uid-b",
    displayName: "ユーザーB",
    email: "b@example.com",
    profileImage: null,
    role: "member",
    joinedAt: "2026-08-06T00:00:00+00:00",
  });
  record("apiMemberToUserProfile", member.id === "uid-b" && member.profileCompleted);

  try {
    assert.equal(group.inviteCode, "ABC123");
    record("invite code preserved", true);
  } catch (error) {
    record("invite code preserved", false, String(error));
  }

  console.log("\n=== SUMMARY ===");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`Passed: ${passed}/${results.length}`);
  if (failed.length) {
    console.log("\nFailed:");
    failed.forEach((f) => console.log(`  ${f.item}: ${f.detail}`));
    process.exit(1);
  }
}

main();

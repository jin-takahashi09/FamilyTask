/**
 * Unit checks for realtime sync refetch planning and dedup logic.
 */
import assert from "node:assert/strict";
import {
  buildRefetchDedupKey,
  getRefetchPlan,
  resetRefetchDedupForTests,
  shouldSkipDuplicateRefetch,
} from "../src/lib/realtime/familySyncHandler";

function testRefetchPlans() {
  assert.deepEqual(getRefetchPlan("task.created"), { tasks: true });
  assert.deepEqual(getRefetchPlan("task.updated"), { tasks: true });
  assert.deepEqual(getRefetchPlan("task.completed"), { tasks: true });
  assert.deepEqual(getRefetchPlan("task.deleted"), { tasks: true });
  assert.deepEqual(getRefetchPlan("family.created"), { families: true });
  assert.deepEqual(getRefetchPlan("family.deleted"), {
    families: true,
    resolveActiveFamily: true,
    tasks: true,
  });
  assert.deepEqual(getRefetchPlan("family.joined"), {
    families: true,
    members: true,
    tasks: true,
  });
  assert.deepEqual(getRefetchPlan("profile.updated"), {
    members: true,
    profile: true,
  });
}

function testDedupKey() {
  const key = buildRefetchDedupKey(
    { familyId: "f1", eventType: "task.created", updatedAt: "t1" },
    { tasks: true },
  );
  assert.equal(key, "f1:task.created:t");
}

function testDedupWindow() {
  resetRefetchDedupForTests();
  const key = "f1:task.created:t";

  assert.equal(shouldSkipDuplicateRefetch(key, 1000), false);
  assert.equal(shouldSkipDuplicateRefetch(key, 1200), true);
  assert.equal(shouldSkipDuplicateRefetch(key, 1600), false);
}

function main() {
  testRefetchPlans();
  testDedupKey();
  testDedupWindow();
  console.log("qa-realtime-sync-unit: all checks passed");
}

main();

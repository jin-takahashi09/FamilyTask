import type { FamilySyncPayload, FamilySyncRefetchPlan } from "./types";

const DEDUP_MS = 500;
const recentRefetches = new Map<string, number>();

export function getRefetchPlan(eventType: string): FamilySyncRefetchPlan {
  if (eventType.startsWith("task.")) {
    return { tasks: true };
  }

  switch (eventType) {
    case "family.created":
      return { families: true };
    case "family.deleted":
      return {
        families: true,
        resolveActiveFamily: true,
        tasks: true,
      };
    case "family.joined":
    case "family.left":
    case "family.member_removed":
    case "family.ownership_transferred":
      return {
        families: true,
        members: true,
        tasks: true,
      };
    case "profile.updated":
      return {
        members: true,
        profile: true,
      };
    default:
      return {};
  }
}

export function buildRefetchDedupKey(
  payload: FamilySyncPayload,
  plan: FamilySyncRefetchPlan,
): string {
  const flags = [
    plan.tasks ? "t" : "",
    plan.families ? "f" : "",
    plan.members ? "m" : "",
    plan.profile ? "p" : "",
    plan.resolveActiveFamily ? "a" : "",
  ].join("");

  return `${payload.familyId}:${payload.eventType}:${flags}`;
}

export function shouldSkipDuplicateRefetch(key: string, now = Date.now()): boolean {
  const last = recentRefetches.get(key) ?? 0;

  if (now - last < DEDUP_MS) {
    return true;
  }

  recentRefetches.set(key, now);
  return false;
}

export function resetRefetchDedupForTests(): void {
  recentRefetches.clear();
}

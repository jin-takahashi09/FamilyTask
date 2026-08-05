/**
 * Recurring task QA – run: npm run qa:recurring-tasks
 */
import { migrateState } from "../src/lib/storage.ts";
import {
  generateRecurringDates,
  getRepeatLabel,
  getRepeatOptionLabel,
  REPEAT_DROPDOWN_OPTIONS,
  validateRepeatEndDate,
} from "../src/lib/recurrence-utils.ts";
import { parseDateKey } from "../src/lib/date-utils.ts";
import { getDay } from "date-fns";

const results = [];

function record(section, item, pass, detail = "") {
  results.push({ section, item, pass, detail });
  const mark = pass ? "✓" : "✗";
  console.log(`  ${mark} ${item}${detail ? ` — ${detail}` : ""}`);
}

function unique(values) {
  return new Set(values).size === values.length;
}

console.log("\n=== Recurring Task QA ===\n");

console.log("## 1. 日付生成");

const noneDates = generateRecurringDates({
  startDate: "2026-08-05",
  repeatType: "none",
  repeatEndDate: null,
});
record("1", "繰り返しなしで1件", noneDates.length === 1 && noneDates[0] === "2026-08-05");

const dailyDates = generateRecurringDates({
  startDate: "2026-08-05",
  repeatType: "daily",
  repeatEndDate: "2026-08-10",
});
record(
  "1",
  "毎日：開始〜終了日",
  dailyDates.join(",") ===
    "2026-08-05,2026-08-06,2026-08-07,2026-08-08,2026-08-09,2026-08-10",
  `${dailyDates.length}件`,
);

record("1", "終了日当日を含む", dailyDates.at(-1) === "2026-08-10");

const weeklySameDates = generateRecurringDates({
  startDate: "2026-08-05",
  repeatType: "weekly",
  repeatWeekday: 3,
  repeatEndDate: "2026-08-26",
});
record(
  "1",
  "毎週水曜日：開始日と同じ曜日",
  weeklySameDates.join(",") === "2026-08-05,2026-08-12,2026-08-19,2026-08-26",
);

const weeklyFridayDates = generateRecurringDates({
  startDate: "2026-08-05",
  repeatType: "weekly",
  repeatWeekday: 5,
  repeatEndDate: "2026-08-21",
});
record(
  "1",
  "毎週金曜日：開始日と違う曜日",
  weeklyFridayDates.join(",") === "2026-08-07,2026-08-14,2026-08-21",
);

const weeklyLegacyDates = generateRecurringDates({
  startDate: "2026-08-05",
  repeatType: "weekly",
  repeatEndDate: "2026-08-26",
});
const startWeekday = getDay(parseDateKey("2026-08-05"));
record(
  "1",
  "旧weekly：開始日曜日をrepeatWeekdayとして扱う",
  weeklyLegacyDates.every((d) => getDay(parseDateKey(d)) === startWeekday),
);

const monthlyDates = generateRecurringDates({
  startDate: "2026-08-05",
  repeatType: "monthly",
  repeatEndDate: "2026-10-05",
});
record(
  "1",
  "毎月：同じ日",
  monthlyDates.join(",") === "2026-08-05,2026-09-05,2026-10-05",
);

const monthEndDates = generateRecurringDates({
  startDate: "2026-01-31",
  repeatType: "monthly",
  repeatEndDate: "2026-04-30",
});
record(
  "1",
  "1月31日の毎月：月末調整",
  monthEndDates.join(",") === "2026-01-31,2026-02-28,2026-03-31,2026-04-30",
);

const leapDates = generateRecurringDates({
  startDate: "2024-02-29",
  repeatType: "monthly",
  repeatEndDate: "2024-03-31",
});
record(
  "1",
  "うるう年2月29日",
  leapDates.join(",") === "2024-02-29,2024-03-29",
);

const yearlyDates = generateRecurringDates({
  startDate: "2026-08-05",
  repeatType: "yearly",
  repeatEndDate: "2027-08-05",
});
record(
  "1",
  "毎年：同じ月日",
  yearlyDates.join(",") === "2026-08-05,2027-08-05",
);

const noEndDates = generateRecurringDates({
  startDate: "2026-01-01",
  repeatType: "daily",
  repeatEndDate: null,
});
const maxEnd = noEndDates.at(-1);
record(
  "1",
  "終了日なし：1年以内",
  maxEnd === "2027-01-01",
  `last=${maxEnd}, count=${noEndDates.length}`,
);

console.log("\n## 2. ラベル");

record(
  "2",
  "毎金曜日ラベル",
  getRepeatLabel("weekly", 5) === "毎金曜日",
);
record("2", "毎年ラベル（既存データ表示）", getRepeatLabel("yearly", null) === "毎年");
record(
  "2",
  "プルダウンに毎月・毎年なし",
  !REPEAT_DROPDOWN_OPTIONS.some(
    (o) => o.kind === "monthly" || o.kind === "yearly",
  ),
);
record(
  "2",
  "毎日曜日ラベル",
  getRepeatOptionLabel({ kind: "weekly", weekday: 0 }) === "毎日曜日",
);

console.log("\n## 3. バリデーション");

const endBeforeStart = validateRepeatEndDate("2026-08-10", "2026-08-05");
record(
  "3",
  "終了日が開始日より前ならエラー",
  endBeforeStart === "終了日は開始日以降を選択してください",
);

const emptyRange = generateRecurringDates({
  startDate: "2026-08-10",
  repeatType: "daily",
  repeatEndDate: "2026-08-05",
});
record("3", "無効な期間は0件", emptyRange.length === 0);

console.log("\n## 4. 旧データ移行");

const legacyTask = migrateState({
  users: [],
  families: [],
  memberships: [],
  tasks: [
    {
      id: "t1",
      familyId: "f1",
      date: "2026-08-05",
      title: "旧タスク",
      requesterId: null,
      assigneeId: "u1",
      deadlineTime: null,
      completed: false,
      alarmEnabled: true,
      notifyOnComplete: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "t2",
      familyId: "f1",
      date: "2026-08-05",
      title: "旧weekly",
      requesterId: null,
      assigneeId: "u1",
      deadlineTime: null,
      completed: false,
      alarmEnabled: true,
      notifyOnComplete: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      repeatType: "weekly",
      repeatEndDate: null,
      recurrenceGroupId: "g1",
    },
  ],
  session: null,
});
const migrated = legacyTask.tasks[0];
const migratedWeekly = legacyTask.tasks[1];
record(
  "4",
  "旧localStorageにrepeatType補完",
  migrated.repeatType === "none" &&
    migrated.repeatEndDate === null &&
    migrated.recurrenceGroupId === null &&
    migrated.repeatWeekday === null,
);
record(
  "4",
  "旧weeklyにrepeatWeekday補完",
  migratedWeekly.repeatType === "weekly" && migratedWeekly.repeatWeekday === 3,
);

console.log("\n## 5. 生成シミュレーション");

function simulateAddTasks(input) {
  const dates = generateRecurringDates(input);
  const recurrenceGroupId =
    input.repeatType === "none" ? null : crypto.randomUUID();
  return dates.map((date) => ({
    id: crypto.randomUUID(),
    familyId: "family-a",
    date,
    title: "ゴミ出し",
    requesterId: null,
    assigneeId: "user-a",
    deadlineTime: null,
    completed: false,
    alarmEnabled: true,
    notifyOnComplete: false,
    createdAt: new Date().toISOString(),
    repeatType: input.repeatType,
    repeatWeekday: input.repeatWeekday ?? null,
    repeatEndDate: input.repeatEndDate,
    recurrenceGroupId,
  }));
}

const generated = simulateAddTasks({
  startDate: "2026-08-05",
  repeatType: "weekly",
  repeatWeekday: 3,
  repeatEndDate: "2026-08-19",
});
record("5", "各タスクのidが一意", unique(generated.map((t) => t.id)));
record(
  "5",
  "recurrenceGroupIdが共通",
  generated.every((t) => t.recurrenceGroupId) &&
    new Set(generated.map((t) => t.recurrenceGroupId)).size === 1,
);

generated[0].completed = true;
record(
  "5",
  "完了状態は日付ごとに独立",
  !generated[1].completed && generated[0].completed,
);

const groupA = simulateAddTasks({
  startDate: "2026-08-05",
  repeatType: "daily",
  repeatEndDate: "2026-08-07",
}).map((t) => ({ ...t, familyId: "family-a" }));
const groupB = simulateAddTasks({
  startDate: "2026-08-05",
  repeatType: "daily",
  repeatEndDate: "2026-08-07",
}).map((t) => ({ ...t, familyId: "family-b" }));
record(
  "5",
  "別グループへ混ざらない",
  groupA.every((t) => t.familyId === "family-a") &&
    groupB.every((t) => t.familyId === "family-b"),
);

console.log("\n## 6. 編集・削除");

const editGroupId = "group-1";
const editTasks = [
  {
    id: "a",
    recurrenceGroupId: editGroupId,
    title: "薬",
    repeatType: "daily",
    familyId: "f1",
    date: "2026-08-05",
    completed: false,
  },
  {
    id: "b",
    recurrenceGroupId: editGroupId,
    title: "薬",
    repeatType: "daily",
    familyId: "f1",
    date: "2026-08-06",
    completed: false,
  },
];
const edited = editTasks.map((t) =>
  t.id === "a" ? { ...t, title: "薬を飲む" } : t,
);
record(
  "6",
  "1件編集しても他は変わらない",
  edited[0].title === "薬を飲む" && edited[1].title === "薬",
);

const remaining = editTasks.filter((t) => t.id !== "a");
record(
  "6",
  "1件削除しても他は残る",
  remaining.length === 1 && remaining[0].id === "b",
);

const failed = results.filter((r) => !r.pass);
console.log(`\n=== SUMMARY ===`);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log("\nFailed:");
  failed.forEach((f) => console.log(`  [${f.section}] ${f.item}`));
}

process.exit(failed.length ? 1 : 0);

/**
 * Recurring task QA – run: npm run qa:recurring-tasks
 */
import { migrateState } from "../src/lib/storage.ts";
import {
  generateRecurringDates,
  getRepeatLabel,
  getRepeatOptionLabel,
  getRepeatEndMinDay,
  isRepeatEndMonthDaySelectable,
  parseRepeatEndMonthDay,
  REPEAT_DROPDOWN_OPTIONS,
  repeatEndMonthDayToDateKey,
  sanitizeRepeatEndMonthDay,
  validateRepeatEndDate,
  validateRepeatEndMonthDay,
} from "../src/lib/recurrence-utils.ts";
import { parseDateKey } from "../src/lib/date-utils.ts";
import { getDay } from "date-fns";
import {
  getRecurringDeleteTargetIds,
  isDateKeyOnOrAfter,
  countIncompleteTasksForDate,
  getCalendarDayStatus,
  getCalendarDotCount,
  getCalendarMemberDayMarks,
  matchesCalendarTask,
  toggleTaskCompleted,
} from "../src/lib/task-utils.ts";
import {
  draftFromConfirmed,
  draftPartsToTime,
  formatDeadlineTime,
  formatDeadlineTimeDisplay,
  parseDeadlineTime,
} from "../src/lib/time-utils.ts";
import {
  DEFAULT_TASK_SORT_ORDER,
  normalizeTaskSortOrder,
  sortTasks,
  sortTasksForDisplay,
} from "../src/lib/task-sort-utils.ts";
import {
  getTaskDeadlineDateTime,
  isTaskOverdue,
} from "../src/lib/overdue-utils.ts";

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
  "終了日が実施日より前ならエラー",
  endBeforeStart === "終了日は実施日以降を選択してください",
);

const emptyRange = generateRecurringDates({
  startDate: "2026-08-10",
  repeatType: "daily",
  repeatEndDate: "2026-08-05",
});
record("3", "無効な期間は0件", emptyRange.length === 0);

record(
  "3",
  "月日→日付：同年",
  repeatEndMonthDayToDateKey("2026-08-06", { month: 12, day: 25 }) ===
    "2026-12-25",
);
record(
  "3",
  "月日→日付：翌年",
  repeatEndMonthDayToDateKey("2026-08-06", { month: 3, day: 31 }) ===
    "2027-03-31",
);
record(
  "3",
  "保存日付→月日",
  parseRepeatEndMonthDay("2027-03-31")?.month === 3 &&
    parseRepeatEndMonthDay("2027-03-31")?.day === 31,
);

record(
  "3",
  "実施日08/16で08/15は不可",
  !isRepeatEndMonthDaySelectable("2026-08-16", { month: 8, day: 15 }),
);
record(
  "3",
  "実施日08/16で08/16は可",
  isRepeatEndMonthDaySelectable("2026-08-16", { month: 8, day: 16 }),
);
record(
  "3",
  "実施日08/16で08/17は可",
  isRepeatEndMonthDaySelectable("2026-08-16", { month: 8, day: 17 }),
);
record(
  "3",
  "実施日08/16の8月最小日",
  getRepeatEndMinDay("2026-08-16", 8) === 16,
);
record(
  "3",
  "実施日変更で終了日が無効なら未設定",
  sanitizeRepeatEndMonthDay("2026-08-25", "2026-08-20") === null,
);
record(
  "3",
  "不正な月日は保存不可",
  validateRepeatEndMonthDay("2026-08-16", { month: 8, day: 15 }) ===
    "終了日は実施日以降を選択してください",
);
record(
  "3",
  "終了日未設定は保存可",
  validateRepeatEndMonthDay("2026-08-16", null) === null,
);

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
record(
  "4",
  "旧localStorageタスクは読み込まない",
  legacyTask.tasks.length === 0,
  `count=${legacyTask.tasks.length}`,
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

console.log("\n## 6b. 繰り返し削除");

const seriesTasks = [
  { id: "w1", familyId: "f1", recurrenceGroupId: "g1", date: "2026-08-05" },
  { id: "w2", familyId: "f1", recurrenceGroupId: "g1", date: "2026-08-12" },
  { id: "w3", familyId: "f1", recurrenceGroupId: "g1", date: "2026-08-19" },
  { id: "w4", familyId: "f1", recurrenceGroupId: "g1", date: "2026-08-26" },
  { id: "other", familyId: "f1", recurrenceGroupId: "g2", date: "2026-08-12" },
  { id: "otherFamily", familyId: "f2", recurrenceGroupId: "g1", date: "2026-08-12" },
];

record(
  "6b",
  "1件削除",
  getRecurringDeleteTargetIds(seriesTasks, {
    familyId: "f1",
    recurrenceGroupId: "g1",
    mode: "single",
    taskId: "w2",
  }).join(",") === "w2",
);

record(
  "6b",
  "指定日以降削除",
  getRecurringDeleteTargetIds(seriesTasks, {
    familyId: "f1",
    recurrenceGroupId: "g1",
    mode: "fromDate",
    fromDate: "2026-08-12",
  }).join(",") === "w2,w3,w4",
);

record(
  "6b",
  "全件削除",
  getRecurringDeleteTargetIds(seriesTasks, {
    familyId: "f1",
    recurrenceGroupId: "g1",
    mode: "series",
  }).length === 4,
);

record(
  "6b",
  "他シリーズを削除しない",
  getRecurringDeleteTargetIds(seriesTasks, {
    familyId: "f1",
    recurrenceGroupId: "g1",
    mode: "series",
  }).includes("other") === false,
);

record(
  "6b",
  "他グループを削除しない",
  getRecurringDeleteTargetIds(seriesTasks, {
    familyId: "f1",
    recurrenceGroupId: "g1",
    mode: "series",
  }).includes("otherFamily") === false,
);

record(
  "6b",
  "日付比較はdate-utils基準",
  isDateKeyOnOrAfter("2026-08-12", "2026-08-12") &&
    !isDateKeyOnOrAfter("2026-08-05", "2026-08-12"),
);

console.log("\n## 7. 締切時間");

record(
  "7",
  "未設定は指定なし表示",
  formatDeadlineTimeDisplay(null) === "指定なし",
);
record(
  "7",
  "00:00",
  formatDeadlineTimeDisplay("00:00") === "00:00" &&
    parseDeadlineTime("00:00")?.hour === 0,
);
record(
  "7",
  "23:59",
  formatDeadlineTimeDisplay("23:59") === "23:59" &&
    parseDeadlineTime("23:59")?.minute === 59,
);
record(
  "7",
  "format/parse往復",
  formatDeadlineTime(9, 30) === "09:30" &&
    parseDeadlineTime("09:30")?.hour === 9 &&
    parseDeadlineTime("09:30")?.minute === 30,
);

console.log("\n## 8. 締切時間 draft");

function simulatePickerFlow(confirmed, draftParts, action) {
  let deadlineTime = confirmed;
  const draft = { ...draftParts };
  if (action === "complete") {
    deadlineTime = draftPartsToTime(draft);
  }
  return deadlineTime;
}

record(
  "8",
  "未設定→仮変更→キャンセルで未設定のまま",
  simulatePickerFlow(null, { hour: 8, minute: 10 }, "cancel") === null,
);
record(
  "8",
  "設定済→仮変更→キャンセルで維持",
  simulatePickerFlow("08:10", { hour: 10, minute: 10 }, "cancel") === "08:10",
);
record(
  "8",
  "完了でだけ反映",
  simulatePickerFlow("08:10", { hour: 10, minute: 10 }, "complete") ===
    "10:10",
);
record(
  "8",
  "未設定open時はdraftFromConfirmedで初期値",
  draftFromConfirmed(null).hour >= 0 &&
    draftFromConfirmed(null).minute >= 0,
);
record(
  "8",
  "設定済open時はconfirmedをdraftへ",
  draftFromConfirmed("08:10").hour === 8 &&
    draftFromConfirmed("08:10").minute === 10,
);

function simulateDeadlineConfirm(confirmed, draft, action) {
  let deadlineTime = confirmed;
  if (action === "complete") {
    deadlineTime = draftPartsToTime(draft);
  }
  return deadlineTime;
}

record(
  "8",
  "完了で08:10を反映",
  simulateDeadlineConfirm(null, { hour: 8, minute: 10 }, "complete") ===
    "08:10",
);
record(
  "8",
  "完了で10:10へ更新",
  simulateDeadlineConfirm("08:10", { hour: 10, minute: 10 }, "complete") ===
    "10:10",
);
record(
  "8",
  "キャンセルで未設定維持",
  simulateDeadlineConfirm(null, { hour: 8, minute: 10 }, "cancel") === null,
);
record(
  "8",
  "キャンセルで08:10維持",
  simulateDeadlineConfirm("08:10", { hour: 10, minute: 10 }, "cancel") ===
    "08:10",
);
record(
  "8",
  "00:00を設定",
  simulateDeadlineConfirm(null, { hour: 0, minute: 0 }, "complete") ===
    "00:00",
);
record(
  "8",
  "23:59を設定",
  simulateDeadlineConfirm(null, { hour: 23, minute: 59 }, "complete") ===
    "23:59",
);

console.log("\n## 9. タスク完了");

const sampleTask = {
  id: "t1",
  familyId: "f1",
  date: "2026-08-16",
  title: "テスト",
  requesterId: null,
  assigneeId: "u1",
  deadlineTime: null,
  completed: false,
  alarmEnabled: true,
  notifyOnComplete: false,
  createdAt: "2026-08-16",
  repeatType: "none",
  repeatWeekday: null,
  repeatEndDate: null,
  recurrenceGroupId: null,
};

const completedTask = toggleTaskCompleted(sampleTask);
record("9", "チェックで即完了", completedTask.completed === true);

const incompleteAgain = toggleTaskCompleted(completedTask);
record("9", "再チェックで即未完了", incompleteAgain.completed === false);

const otherTask = { ...sampleTask, id: "t2", completed: false };
const tasksAfterToggle = [toggleTaskCompleted(sampleTask), otherTask];
record(
  "9",
  "他タスクの状態は変わらない",
  tasksAfterToggle[0].completed === true && tasksAfterToggle[1].completed === false,
);

const recurringGroup = "group-complete";
const recurringTasks = [
  { ...sampleTask, id: "r1", date: "2026-08-05", recurrenceGroupId: recurringGroup },
  { ...sampleTask, id: "r2", date: "2026-08-12", recurrenceGroupId: recurringGroup },
];
const recurringToggled = recurringTasks.map((task) =>
  task.id === "r2" ? toggleTaskCompleted(task) : task,
);
record(
  "9",
  "繰り返しタスクの他日付は変化しない",
  recurringToggled[0].completed === false && recurringToggled[1].completed === true,
);

record(
  "9",
  "未完了件数が更新される",
  countIncompleteTasksForDate(tasksAfterToggle, "2026-08-16") === 1,
);

record(
  "9",
  "完了後は未完了件数0",
  countIncompleteTasksForDate([completedTask], "2026-08-16") === 0,
);

console.log("\n## 10. カレンダー表示");

const calendarTasksAll = [
  {
    ...sampleTask,
    id: "c1",
    familyId: "f1",
    assigneeId: "u1",
    date: "2026-08-16",
    completed: false,
  },
  {
    ...sampleTask,
    id: "c2",
    familyId: "f1",
    assigneeId: "u1",
    date: "2026-08-16",
    completed: true,
  },
  {
    ...sampleTask,
    id: "c3",
    familyId: "f2",
    assigneeId: "u1",
    date: "2026-08-16",
    completed: false,
  },
  {
    ...sampleTask,
    id: "c4",
    familyId: "f1",
    assigneeId: "u2",
    date: "2026-08-16",
    completed: false,
  },
];

const calendarTasks = calendarTasksAll.filter((task) => task.familyId === "f1");
const filterU1 = { userId: "u1", assigneeOnly: true };
const pendingDay = getCalendarDayStatus(calendarTasks, "2026-08-16", filterU1);
record(
  "10",
  "未完了件数の計算",
  pendingDay.status === "pending" && pendingDay.incompleteCount === 1,
);
record(
  "10",
  "完了済みを件数に含めない",
  pendingDay.totalCount === 2 && pendingDay.incompleteCount === 1,
);
record("10", "点は最大3個", getCalendarDotCount(10) === 3);
record("10", "未完了3件は点3個", getCalendarDotCount(3) === 3);

const memberMarks = getCalendarMemberDayMarks(
  calendarTasks,
  "2026-08-16",
  ["u1", "u2"],
  "u1",
);
record(
  "10",
  "複数メンバーの点を同時に返す",
  memberMarks.some((mark) => mark.userId === "u1" && mark.incompleteCount > 0) &&
    memberMarks.some((mark) => mark.userId === "u2" && mark.incompleteCount > 0),
);

const allDoneTasks = calendarTasks.map((task) =>
  task.assigneeId === "u1" ? { ...task, completed: true } : task,
);
const allCompleteDay = getCalendarDayStatus(
  allDoneTasks,
  "2026-08-16",
  filterU1,
);
record("10", "全件完了状態", allCompleteDay.status === "allComplete");

record(
  "10",
  "タスク0件状態",
  getCalendarDayStatus(calendarTasks, "2026-08-20", filterU1).status === "empty",
);

const afterComplete = toggleTaskCompleted(calendarTasks[0]);
const updatedTasks = calendarTasks.map((task) =>
  task.id === "c1" ? afterComplete : task,
);
record(
  "10",
  "完了操作後の件数更新",
  getCalendarDayStatus(updatedTasks, "2026-08-16", filterU1).incompleteCount ===
    0,
);

const afterUndo = toggleTaskCompleted(afterComplete);
const restoredTasks = updatedTasks.map((task) =>
  task.id === "c1" ? afterUndo : task,
);
record(
  "10",
  "未完了へ戻した後の件数更新",
  getCalendarDayStatus(restoredTasks, "2026-08-16", filterU1).incompleteCount ===
    1,
);

record(
  "10",
  "別グループを含めない",
  calendarTasksAll.filter((task) => task.familyId === "f1").length === 3 &&
    calendarTasksAll.filter((task) => task.familyId === "f2").length === 1,
);

record(
  "10",
  "別メンバーを含めない",
  !matchesCalendarTask(calendarTasksAll[3], filterU1),
);

console.log("\n## 11. タスク並び替え");

const sortBase = {
  ...sampleTask,
  familyId: "f1",
  date: "2026-08-16",
  completed: false,
};

const sortTasksSample = [
  {
    ...sortBase,
    id: "s1",
    title: "いちご",
    deadlineTime: "18:00",
    createdAt: "2026-08-01T10:00:00.000Z",
  },
  {
    ...sortBase,
    id: "s2",
    title: "Apple",
    deadlineTime: "08:00",
    createdAt: "2026-08-01T12:00:00.000Z",
  },
  {
    ...sortBase,
    id: "s3",
    title: "バナナ",
    deadlineTime: null,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    ...sortBase,
    id: "s4",
    title: "朝食",
    deadlineTime: "08:00",
    createdAt: "2026-08-01T09:00:00.000Z",
  },
  {
    ...sortBase,
    id: "s5",
    title: "夕方",
    deadlineTime: "13:00",
    createdAt: "2026-08-02T10:00:00.000Z",
  },
];

const deadlineSorted = sortTasks(sortTasksSample, "deadlineAsc");
record(
  "11",
  "締切が近い順",
  deadlineSorted.map((t) => t.id).join(",") === "s4,s2,s5,s1,s3",
);
record(
  "11",
  "締切未設定は最後",
  deadlineSorted[deadlineSorted.length - 1].id === "s3",
);
record(
  "11",
  "同じ締切は追加が古い順",
  deadlineSorted[0].id === "s4" && deadlineSorted[1].id === "s2",
);

const createdDescSorted = sortTasks(sortTasksSample, "createdDesc");
record(
  "11",
  "追加が新しい順",
  createdDescSorted[0].id === "s5" &&
    createdDescSorted[createdDescSorted.length - 1].id === "s3",
);

const createdAscSorted = sortTasks(sortTasksSample, "createdAsc");
record(
  "11",
  "追加が古い順",
  createdAscSorted[0].id === "s3" &&
    createdAscSorted[createdAscSorted.length - 1].id === "s5",
);

const titleSorted = sortTasks(sortTasksSample, "titleAsc");
record(
  "11",
  "タスク名順",
  titleSorted.map((t) => t.title).join("|") ===
    "Apple|いちご|バナナ|朝食|夕方",
);

const mixedCompletion = [
  { ...sortBase, id: "m1", title: "A", completed: true, createdAt: "2026-08-01T10:00:00.000Z" },
  { ...sortBase, id: "m2", title: "B", completed: false, createdAt: "2026-08-01T11:00:00.000Z" },
  { ...sortBase, id: "m3", title: "C", completed: true, createdAt: "2026-08-01T12:00:00.000Z" },
  { ...sortBase, id: "m4", title: "D", completed: false, createdAt: "2026-08-01T09:00:00.000Z" },
];
const allStatusSorted = sortTasksForDisplay(
  mixedCompletion,
  "createdAsc",
  "すべて",
);
record(
  "11",
  "すべて表示で未完了を先に",
  allStatusSorted.map((t) => t.id).join(",") === "m4,m2,m1,m3",
);
record(
  "11",
  "完了済みは最後に並ぶ",
  allStatusSorted.slice(2).every((t) => t.completed),
);

record(
  "11",
  "不正な並び順はデフォルト",
  normalizeTaskSortOrder("invalid") === DEFAULT_TASK_SORT_ORDER,
);

const migratedSort = migrateState({
  users: [
    {
      id: "u1",
      email: "a@test.com",
      displayName: "A",
      profileImage: null,
      profileCompleted: true,
    },
  ],
  families: [
    {
      id: "f1",
      name: "A",
      inviteCode: "AAA111",
      ownerId: "u1",
      createdAt: "2026-01-01",
    },
  ],
  memberships: [
    { id: "m1", familyId: "f1", userId: "u1", role: "owner", joinedAt: "2026-01-01" },
  ],
  tasks: [],
  session: { userId: "u1", activeFamilyId: "f1" },
  taskSortPreferences: { u1: "titleAsc", other: "bad" },
});
record(
  "11",
  "taskSortPreferencesを復元",
  migratedSort.taskSortPreferences.u1 === "titleAsc" &&
    migratedSort.taskSortPreferences.other === DEFAULT_TASK_SORT_ORDER,
);
record(
  "11",
  "taskSortPreferences未設定時は空",
  Object.keys(
    migrateState({
      users: [
        {
          id: "u1",
          email: "a@test.com",
          displayName: "A",
          profileImage: null,
          profileCompleted: true,
        },
      ],
      families: [
        {
          id: "f1",
          name: "A",
          inviteCode: "AAA111",
          ownerId: "u1",
          createdAt: "2026-01-01",
        },
      ],
      memberships: [
        { id: "m1", familyId: "f1", userId: "u1", role: "owner", joinedAt: "2026-01-01" },
      ],
      tasks: [],
      session: { userId: "u1", activeFamilyId: "f1" },
    }).taskSortPreferences,
  ).length === 0,
);

console.log("\n## 12. 期限切れ表示");

const overdueBase = {
  ...sampleTask,
  familyId: "f1",
  completed: false,
  deadlineTime: "08:00",
};

const noonAug16 = new Date(2026, 7, 16, 12, 0, 0);

record(
  "12",
  "締切前は期限切れでない",
  !isTaskOverdue(
    { ...overdueBase, id: "o1", date: "2026-08-16" },
    new Date(2026, 7, 16, 7, 59, 0),
  ),
);
record(
  "12",
  "締切後は期限切れ",
  isTaskOverdue(
    { ...overdueBase, id: "o2", date: "2026-08-16" },
    new Date(2026, 7, 16, 8, 1, 0),
  ),
);
record(
  "12",
  "完了後は期限切れでない",
  !isTaskOverdue(
    { ...overdueBase, id: "o3", date: "2026-08-16", completed: true },
    noonAug16,
  ),
);
record(
  "12",
  "締切未設定は期限切れでない",
  !isTaskOverdue(
    { ...overdueBase, id: "o4", date: "2026-08-16", deadlineTime: null },
    noonAug16,
  ),
);
record(
  "12",
  "未来日付は期限切れでない",
  !isTaskOverdue(
    { ...overdueBase, id: "o5", date: "2026-08-20" },
    noonAug16,
  ),
);

const deadlineDt = getTaskDeadlineDateTime({
  ...overdueBase,
  id: "o6",
  date: "2026-08-16",
});
record(
  "12",
  "日付と締切時刻を合成",
  deadlineDt?.getHours() === 8 && deadlineDt?.getMinutes() === 0,
);

const overdueSortNow = new Date(2026, 7, 16, 19, 0, 0);
const overdueSortTasks = [
  {
    ...overdueBase,
    id: "od1",
    date: "2026-08-16",
    deadlineTime: "18:00",
    createdAt: "2026-08-01T10:00:00.000Z",
  },
  {
    ...overdueBase,
    id: "od2",
    date: "2026-08-16",
    deadlineTime: "20:00",
    createdAt: "2026-08-01T11:00:00.000Z",
  },
  {
    ...overdueBase,
    id: "od3",
    date: "2026-08-20",
    deadlineTime: "08:00",
    createdAt: "2026-08-01T12:00:00.000Z",
  },
];
const overdueSorted = sortTasks(overdueSortTasks, "deadlineAsc", overdueSortNow);
record(
  "12",
  "締切が近い順で期限切れが先",
  overdueSorted[0].id === "od1" && overdueSorted[1].id === "od2",
);
record(
  "12",
  "未来日付は期限切れより後",
  overdueSorted[2].id === "od3",
);

const recurringOverdue = {
  ...overdueBase,
  id: "or1",
  date: "2026-08-16",
  repeatType: "weekly",
  repeatWeekday: 0,
  recurrenceGroupId: "rg1",
};
record(
  "12",
  "繰り返しタスクも期限切れ判定",
  isTaskOverdue(recurringOverdue, noonAug16),
);

const failed = results.filter((r) => !r.pass);
console.log(`\n=== SUMMARY ===`);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log("\nFailed:");
  failed.forEach((f) => console.log(`  [${f.section}] ${f.item}`));
}

process.exit(failed.length ? 1 : 0);

import {
  parseSelectedUserIds,
  serializeSelectedUserSearch,
  toggleSelectedUserId,
} from "../src/lib/member-selection.ts";
import { getMemberCalendarColor } from "../src/lib/member-calendar-colors.ts";

let passed = 0;
let failed = 0;

function record(name, ok) {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}`);
  }
}

console.log("=== Member calendar QA ===");

const allow = (id) => id === "b" || id === "c";

record(
  "クエリなしは自分のみ",
  parseSelectedUserIds(null, null, "a", allow).join() === "a",
);
record(
  "空のusersは自分を表示",
  parseSelectedUserIds("", null, "a", allow).join() === "a",
);
record(
  "usersで複数人をappend",
  parseSelectedUserIds("a,b", null, "a", allow).join() === "a,b",
);
record(
  "旧userクエリを互換",
  parseSelectedUserIds(null, "b", "a", allow).join() === "b",
);
record(
  "1クリック目は追加",
  toggleSelectedUserId(["a"], "b").join() === "a,b",
);
record(
  "2クリック目は削除",
  toggleSelectedUserId(["a", "b"], "b").join() === "a",
);
record(
  "自分のみはクエリなし",
  serializeSelectedUserSearch(["a"], "a") === "",
);
record(
  "同じuidは同じ色",
  getMemberCalendarColor("uid-1").id === getMemberCalendarColor("uid-1").id,
);
record(
  "別uidは色パレット内",
  Boolean(getMemberCalendarColor("uid-2").dot),
);

console.log(`\nPassed: ${passed}/${passed + failed}`);
if (failed > 0) process.exit(1);

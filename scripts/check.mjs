// npm run check: prints every rule's boards and compares them with the course's answer key
// (demos/binpack2.py, re-run in the Session 12 verify.py). Exits non-zero on any mismatch.
import { ALL } from "../src/rules.js";

const WANT = {
  "first-fit": { used: 4, boards: [[31, 128, 12], [32, 36, 4], [28, 124, 5], [25, 40, 3], [0, 0, 0]], big: 5, dead: 1, victims: 12, lost: ["worker-5", "web-2"] },
  pack: { used: 4, boards: [[31, 128, 12], [31, 56, 4], [30, 128, 6], [24, 16, 2], [0, 0, 0]], big: 5, dead: 1, victims: 12, lost: ["worker-5", "web-2", "cache-1"] },
  spread: { used: 5, boards: [[25, 60, 5], [17, 92, 4], [24, 76, 6], [20, 72, 5], [30, 28, 4]], big: null, dead: 3, victims: 6, lost: [] },
  "sort-first": { used: 5, boards: [[32, 64, 3], [32, 64, 3], [16, 128, 6], [32, 64, 10], [4, 8, 2]], big: 5, dead: 4, victims: 10, lost: ["worker-1", "worker-5", "worker-6", "web-3", "web-1", "web-5", "web-2"] },
};
let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${JSON.stringify(got)}${ok ? "" : `  (wanted ${JSON.stringify(want)})`}`);
  if (!ok) fails++;
};
for (const [rule, { summary }] of Object.entries(ALL)) {
  const w = WANT[rule];
  console.log(`\n== ${rule}`);
  check("hosts used", summary.used, w.used);
  check("boards (cores, GB, pods)", summary.boards.map((h) => [h.cores, h.gb, h.pods.length]), w.boards);
  check("free across five", [summary.free.cores, summary.free.gb], [44, 312]);
  check("BIG host", summary.bigHost, w.big);
  check("dead host", summary.deadId, w.dead);
  check("victims", summary.victims, w.victims);
  check("lost", summary.lost.map((p) => p.name), w.lost);
}
console.log(`\n${fails} failed`);
process.exit(fails ? 1 : 0);

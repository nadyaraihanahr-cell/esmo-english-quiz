// runnable check: node test-bank.js  (no deps)
const fs = require("fs");
const js = fs.readFileSync(__dirname + "/index.html", "utf8").split("<script>")[1].split("</script>")[0];

const store = {};
global.localStorage = { setItem: (k, v) => (store[k] = v), getItem: (k) => store[k] ?? null, removeItem: (k) => delete store[k] };
const el = () => ({ classList: { add() {}, remove() {} }, style: {}, textContent: "", innerHTML: "", querySelectorAll: () => [], onclick: null, dataset: {} });
global.document = { querySelector: el, querySelectorAll: () => [] };
global.window = {};
global.confirm = () => false;
global.location = { reload() {} };

const harness = `
(() => {
  const assert = [];
  const ok = (c, m) => { if (!c) assert.push(m); };
  const N = 20;

  // bank integrity
  ok(BANK.length === 80, "bank size " + BANK.length);
  ok(BANK.every(q => q.o.length === 4 && q.a >= 0 && q.a <= 3 && q.w && q.t), "malformed question");
  ok(new Set(BANK.map(q => q.t + "|" + q.q)).size === BANK.length, "duplicate question text");
  ok(BANK.every(q => new Set(q.o).size === 4), "duplicate option text");
  TOPICS.forEach(t => ok(BANK.filter(q => q.t === t).length >= N, "topic pool too small: " + t));

  const run = (accByTopic, trials) => {
    const total = {}, trips = [];
    for (let s = 0; s < trials; s++) {
      H = { t: {}, w: {}, sessions: 1 };
      TOPICS.forEach(t => (H.t[t] = { c: Math.round(accByTopic[t] * 10), n: 10 }));
      const { qs } = buildSession();
      ok(qs.length === N, "session length " + qs.length);
      ok(new Set(qs.map(q => q.id)).size === N, "duplicate question inside session");
      for (let i = 2; i < qs.length; i++)
        if (qs[i].t === qs[i - 1].t && qs[i].t === qs[i - 2].t) trips.push(i);
      qs.forEach(q => (total[q.t] = (total[q.t] || 0) + 1));
    }
    ok(trips.length === 0, "triple same-topic in a row at " + trips.slice(0, 5));
    const avg = {};
    TOPICS.forEach(t => (avg[SHORT[t]] = +(total[t] / trials).toFixed(1)));
    // adaptive rule: weaker topic must get strictly more questions than the strongest
    const weakest = TOPICS.reduce((a, b) => (accByTopic[a] <= accByTopic[b] ? a : b));
    const strongest = TOPICS.reduce((a, b) => (accByTopic[a] >= accByTopic[b] ? a : b));
    if (accByTopic[weakest] < accByTopic[strongest])
      ok(total[weakest] / trials >= total[strongest] / trials, "weak topic not prioritised: " + weakest);
    return avg;
  };

  const out = {};
  out.equal = run({ [R]: 1, [S]: 1, [P]: 1, [T]: 1 }, 200);
  out.timeWeak = run({ [R]: 1, [S]: 1, [P]: 1, [T]: 0.3 }, 200);
  out.readingWeak = run({ [R]: 0.1, [S]: 1, [P]: 1, [T]: 1 }, 200);
  out.allZero = run({ [R]: 0, [S]: 0, [P]: 0, [T]: 0 }, 50);

  // unanswered (timeout) must count as wrong and increase the topic error weight
  H = { t: {}, w: {}, sessions: 0 };
  qs = [BANK[0]]; i = 0;
  choose(-1);
  ok(H.w[qs[0].id] === 1, "timeout did not record error weight");
  ok(H.t[qs[0].t].n === 1 && H.t[qs[0].t].c === 0, "timeout not counted as wrong");

  // correct answer records success and clears weight
  H = { t: {}, w: { [BANK[5].id]: 2 }, sessions: 0 };
  qs = [BANK[5]]; i = 0; picked = null;
  choose(BANK[5].a);
  ok(H.t[BANK[5].t].c === 1 && H.t[BANK[5].t].n === 1, "correct not recorded");
  ok(!H.w[BANK[5].id], "weight not cleared after correct");

  console.log(JSON.stringify(out));
  console.log(assert.length ? "FAIL:\\n - " + assert.join("\\n - ") : "PASS: all checks");
  process.exit(assert.length ? 1 : 0);
})();
`;

eval(js + harness);

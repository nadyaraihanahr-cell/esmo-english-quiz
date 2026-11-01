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
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const N = 20;

  // ---- bank integrity ----
  ok(BANK.length >= 120, "bank too small: " + BANK.length);
  ok(BANK.every(q => q.o.length === 4 && q.a >= 0 && q.a <= 3), "malformed answer/options");
  ok(BANK.every(q => new Set(q.o).size === 4), "duplicate option inside a question");
  ok(BANK.every(q => q.w && q.t && TOPICS.includes(q.t)), "missing explanation or unknown topic");
  ok(new Set(BANK.map(q => q.id)).size === BANK.length, "duplicate id");
  const dupQ = new Set(), dups = [];
  BANK.forEach(q => { const k = q.q + "|" + q.o.join("~"); if (dupQ.has(k)) dups.push(q.q.slice(0, 50)); dupQ.add(k); });
  ok(dups.length === 0, "duplicate question text: " + dups.join("; "));
  TOPICS.forEach(t => ok(BANK.filter(q => q.t === t).length >= N, "pool too small for " + t));

  // ---- session shape + adaptivity ----
  const run = (accByTopic, trials) => {
    const total = {}, trips = [];
    for (let s = 0; s < trials; s++) {
      H = { t: {}, w: {}, sessions: 1 };
      TOPICS.forEach(t => (H.t[t] = { c: Math.round(accByTopic[t] * 10), n: 10 }));
      const { qs } = buildSession();
      ok(qs.length === N, "session length " + qs.length);
      ok(new Set(qs.map(q => q.id)).size === N, "duplicate question inside a session");
      for (let i = 2; i < qs.length; i++)
        if (qs[i].t === qs[i - 1].t && qs[i].t === qs[i - 2].t) trips.push(i);
      qs.forEach(q => (total[q.t] = (total[q.t] || 0) + 1));
    }
    ok(trips.length === 0, "triple same-topic in a row at " + trips.slice(0, 5));
    const avg = {};
    TOPICS.forEach(t => (avg[SHORT[t]] = +(total[t] / trials).toFixed(1)));
    const weakest = TOPICS.reduce((a, b) => (accByTopic[a] <= accByTopic[b] ? a : b));
    const strongest = TOPICS.reduce((a, b) => (accByTopic[a] >= accByTopic[b] ? a : b));
    if (accByTopic[weakest] < accByTopic[strongest])
      ok(total[weakest] / trials >= total[strongest] / trials, "weak topic not prioritised: " + weakest);
    return avg;
  };
  const flat = {}; TOPICS.forEach(t => (flat[t] = 1));
  const out = {};
  out.equal = run(flat, 200);
  out.timeWeak = run({ ...flat, [T]: 0.3 }, 200);
  out.readingWeak = run({ ...flat, [R]: 0.1 }, 200);
  const zero = {}; TOPICS.forEach(t => (zero[t] = 0));
  out.allZero = run(zero, 50);

  // ---- scoring rules ----
  H = { t: {}, w: {}, sessions: 0 };
  qs = [BANK[0]]; i = 0; picked = null;
  choose(-1);                                     // timeout
  ok(H.w[BANK[0].id] === 1, "timeout did not record error weight");
  ok(H.t[BANK[0].t].n === 1 && H.t[BANK[0].t].c === 0, "timeout not counted as wrong");

  H = { t: {}, w: { [BANK[5].id]: 2 }, sessions: 0 };
  qs = [BANK[5]]; i = 0; picked = null;
  choose(BANK[5].a);
  ok(H.t[BANK[5].t].c === 1 && H.t[BANK[5].t].n === 1, "correct answer not recorded");
  ok(!H.w[BANK[5].id], "error weight not cleared after a correct answer");

  // every question in the bank is reachable
  const reach = new Set();
  for (let s = 0; s < 400 && reach.size < BANK.length; s++) {
    H = { t: {}, w: {}, sessions: 1 };
    buildSession().qs.forEach(q => reach.add(q.id));
  }
  ok(reach.size === BANK.length, "unreachable questions: " + (BANK.length - reach.size));

  console.log(JSON.stringify(out));
  console.log(bad.length ? "FAIL:\\n - " + bad.join("\\n - ") : "PASS: all checks (" + BANK.length + " questions)");
  process.exit(bad.length ? 1 : 0);
})();
`;

eval(js + harness);

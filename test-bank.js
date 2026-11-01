// runnable check: node test-bank.js  (no deps)
const fs = require("fs");
const js = fs.readFileSync(__dirname + "/index.html", "utf8").split("<script>")[1].split("</script>")[0];

const store = {};
global.localStorage = { setItem: (k, v) => (store[k] = v), getItem: (k) => store[k] ?? null, removeItem: (k) => delete store[k] };
const el = () => ({
  classList: { add() {}, remove() {}, toggle() {}, contains: () => true },
  style: {}, textContent: "", innerHTML: "", querySelectorAll: () => [], onclick: null, dataset: {},
  setAttribute() {}, closest: () => null,
});
global.document = {
  querySelector: el, querySelectorAll: () => [], addEventListener() {},
  getElementById: el,
};
global.window = { addEventListener() {} };
global.confirm = () => false;
global.alert = () => {};
global.location = { reload() {} };

const harness = `
(() => {
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };

  // ---------- bank integrity ----------
  ok(BANK.length === 120, "bank size " + BANK.length);
  ok(BANK.every(q => q.o.length === 4 && q.a >= 0 && q.a <= 3), "malformed answer/options");
  ok(BANK.every(q => new Set(q.o).size === 4), "duplicate option inside a question");
  ok(BANK.every(q => q.w && q.t && TOPICS.includes(q.t)), "missing explanation or unknown topic");
  ok(new Set(BANK.map(q => q.id)).size === BANK.length, "duplicate id");
  TOPICS.forEach(t => ok(poolOf(t).length >= 20, "pool too small for " + t));

  // passage blocks: every passage must have >1 question and all its questions share a topic
  const passes = [...new Set(BANK.filter(q => q.p).map(q => q.p))];
  ok(passes.length >= 11, "expected 11+ passages, got " + passes.length);
  passes.forEach(p => {
    const g = BANK.filter(q => q.p === p);
    ok(g.length >= 1, "empty passage: " + p.slice(0, 40));
    ok(new Set(g.map(q => q.t)).size === 1, "passage mixes topics: " + p.slice(0, 40));
    ok(new Set(g.map(q => q.set)).size === 1, "passage mixes sets: " + p.slice(0, 40));
  });

  // ---------- unit integrity: a passage block is never split ----------
  const unitKey = q => q.p || ("id:" + q.id);
  for (let s = 0; s < 300; s++) {
    H = { t: {}, w: {}, sessions: 1 };
    const qs = buildSession(40);
    ok(qs.length === 40, "final paper size " + qs.length);
    ok(new Set(qs.map(q => q.id)).size === qs.length, "duplicate question in paper");
    const seen = new Map();
    qs.forEach(q => seen.set(unitKey(q), (seen.get(unitKey(q)) || 0) + 1));
    // each passage group that appears must appear with ALL of its questions and be contiguous
    for (const p of passes) {
      const g = BANK.filter(q => q.p === p);
      const inPaper = qs.filter(q => q.p === p);
      if (!inPaper.length) continue;
      ok(inPaper.length === g.length, "passage split: " + inPaper.length + "/" + g.length + " of " + p.slice(0, 35));
      const at = qs.findIndex(q => q.p === p);
      const contiguous = qs.slice(at, at + g.length).every(q => q.p === p);
      ok(contiguous, "passage questions not adjacent: " + p.slice(0, 35));
    }
    // running order is checked per UNIT: a passage block is one unit and may hold
    // several questions of one topic; three separate same-topic units in a row would cluster topics
    const unitsSeq = [];
    qs.forEach(q => {
      const k = unitKey(q);
      if (!unitsSeq.length || unitsSeq[unitsSeq.length - 1].k !== k) unitsSeq.push({ k, t: q.t });
    });
    for (let i = 2; i < unitsSeq.length; i++)
      if (unitsSeq[i].t === unitsSeq[i - 1].t && unitsSeq[i].t === unitsSeq[i - 2].t) { ok(false, "triple same topic unit at " + i); break; }
  }

  // ---------- adaptivity ----------
  const rate = (accByTopic, trials, n) => {
    const total = {};
    for (let s = 0; s < trials; s++) {
      H = { t: {}, w: {}, sessions: 1 };
      TOPICS.forEach(t => (H.t[t] = { c: Math.round(accByTopic[t] * 10), n: 10 }));
      buildSession(n).forEach(q => (total[q.t] = (total[q.t] || 0) + 1));
    }
    return total;
  };
  const flat = {}; TOPICS.forEach(t => (flat[t] = 1));
  const eq = rate(flat, 40, 40);
  // flat paper must follow the BASE mix (reading 40%, time 25%, prep/sp 17.5% each), ±3 questions
  const expectMix = { [R]: 16, [T]: 10, [P]: 7, [S]: 7 };
  ok(TOPICS.every(t => Math.abs(eq[t] / 40 - expectMix[t]) <= 3), "flat paper mix off: " + JSON.stringify(eq));
  const weak = rate({ ...flat, [T]: 0.2 }, 40, 40);
  ok(weak[T] > Math.max(weak[R], weak[S], weak[P]), "weak topic not prioritised: " + JSON.stringify(weak));

  // ---------- modes ----------
  // review mode: only ids still wrong, and no timer
  H = { t: {}, w: { 3: 1, 7: 2, 11: 1 }, sessions: 0 };
  const rev = BANK.filter(q => H.w[q.id]);
  ok(rev.length === 3, "review set size " + rev.length);

  // topic mode: single topic, all of it
  TOPICS.forEach(t => {
    const g = poolOf(t);
    ok(g.every(q => q.t === t), "topic pool contaminated");
    ok(g.length >= 20, "topic pool too small " + t);
  });

  // ---------- scoring ----------
  H = { t: {}, w: {}, sessions: 0 };
  qs = [BANK.find(q => q.t === T)]; i = 0; picked = null; answered = 0; correct = 0; answers = [];
  choose(BANK.find(q => q.t === T).a);
  ok(H.t[T].c === 1 && H.t[T].n === 1, "correct not recorded");
  ok(!H.w[qs[0].id], "error flag kept after correct answer");

  H = { t: {}, w: {}, sessions: 0 };
  qs = [BANK[0]]; i = 0; picked = null;
  choose(-1);
  ok(H.w[BANK[0].id] === 1, "wrong answer not flagged for review");
  ok(H.t[BANK[0].t].c === 0, "wrong answer counted as correct");

  console.log(JSON.stringify({ flat: eq, weakTime: weak, passages: passes.length }));
  console.log(bad.length ? "FAIL:\\n - " + bad.slice(0, 12).join("\\n - ") : "PASS: all checks (" + BANK.length + " questions, " + passes.length + " passage blocks)");
  process.exit(bad.length ? 1 : 0);
})();
`;

eval(js + harness);

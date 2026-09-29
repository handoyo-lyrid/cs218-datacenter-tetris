import { useEffect, useMemo, useState } from "react";
import { DECK, BIG, HOST, SHAPES, squares, totals, lowerBound } from "./deck.js";
import { RULES, RULE_IDS, ALL, emptyHosts, choose, place, orderFor, fits } from "./rules.js";

const CELLS = 32;

function Bar({ label, unit, pods, key_, per, cap, dead }) {
  let filled = 0;
  const segs = pods.map((p) => {
    const n = p[key_] / per;
    const seg = { start: filled, n, color: p.color, name: p.name };
    filled += n;
    return seg;
  });
  return (
    <div className="bar-row">
      <span className="bar-label">
        {label}
        <small>{unit}</small>
      </span>
      <div className={"bar" + (dead ? " dead" : "")}>
        {segs.map((s, i) => (
          <div
            key={i}
            className="seg"
            title={`${s.name}: ${s.n} squares`}
            style={{ left: `${(s.start / cap) * 100}%`, width: `${(s.n / cap) * 100}%`, background: s.color }}
          />
        ))}
        {Array.from({ length: CELLS - 1 }, (_, i) => (
          <i key={i} className={"tick" + ((i + 1) % 8 === 0 ? " major" : "")} style={{ left: `${((i + 1) / CELLS) * 100}%` }} />
        ))}
      </div>
      <span className="bar-num">
        {filled}/{CELLS}
      </span>
    </div>
  );
}

function Board({ host, highlight, onClick, clickable, candidate }) {
  const dead = !host.alive;
  return (
    <div
      className={
        "board" + (highlight ? " hl" : "") + (dead ? " dead" : "") + (clickable ? " clickable" : "") + (candidate === false ? " nofit" : "")
      }
      onClick={clickable ? onClick : undefined}
    >
      <div className="board-head">
        <b>host {host.id}</b>
        <span>{dead ? "lost power" : host.pods.length ? `${host.cores} c · ${host.gb} GB · ${host.pods.length} pods · ${squares(host.cores, host.gb)} sq` : "empty (off)"}</span>
      </div>
      <Bar label="CPU" unit="1 sq = 1 core" pods={host.pods} key_="cores" per={1} cap={CELLS} dead={dead} />
      <Bar label="mem" unit="1 sq = 4 GB" pods={host.pods} key_="gb" per={4} cap={CELLS} dead={dead} />
    </div>
  );
}

function Card({ p, small }) {
  if (!p) return null;
  return (
    <div className={"card" + (small ? " small" : "")} style={{ borderColor: p.color }}>
      <span className="card-n">{p.name === "BIG" ? "" : `#${p.n}`}</span>
      <b>{p.name}</b>
      <span>
        {p.cores} c / {p.gb} GB
      </span>
      <small>
        {p.cores} / {p.gb / 4} sq
      </small>
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      {Object.entries(SHAPES).map(([k, s]) => (
        <span key={k}>
          <i style={{ background: s.color }} /> {k} {s.cores} c / {s.gb} GB
        </span>
      ))}
      <span>
        <i style={{ background: BIG.color, outline: "2px solid #B00020" }} /> BIG 16 c / 64 GB
      </span>
    </div>
  );
}

/* ---------------- Watch: four rules side by side ---------------- */
function Watch() {
  const maxLen = Math.max(...RULE_IDS.map((r) => ALL[r].steps.length));
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  useEffect(() => {
    if (!playing) return;
    if (t >= maxLen - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setT((x) => x + 1), speed);
    return () => clearTimeout(id);
  }, [playing, t, speed, maxLen]);
  const marks = { start: 0, round1: 24, big: 25, fail: 26, end: maxLen - 1 };
  const phaseLabel = t === 0 ? "start" : t <= 24 ? `Round 1: card ${t} of 24` : t === 25 ? "Round 2: BIG arrives" : t === 26 ? "Round 3: a host dies" : "Round 3: re-placing the dead host's pods";
  return (
    <section>
      <div className="controls">
        <button onClick={() => setT(0)}>|◀</button>
        <button onClick={() => setT((x) => Math.max(0, x - 1))}>◀ step</button>
        <button className="primary" onClick={() => setPlaying((p) => !p)}>
          {playing ? "pause" : t >= maxLen - 1 ? "replay" : "play"}
        </button>
        <button onClick={() => setT((x) => Math.min(maxLen - 1, x + 1))}>step ▶</button>
        <button onClick={() => setT(maxLen - 1)}>▶|</button>
        <label>
          speed
          <select value={speed} onChange={(e) => setSpeed(+e.target.value)}>
            <option value={1500}>slow</option>
            <option value={700}>normal</option>
            <option value={250}>fast</option>
          </select>
        </label>
        <span className="jump">
          jump to:
          {Object.entries({ "Round 1": marks.round1, BIG: marks.big, failure: marks.fail, end: marks.end }).map(([k, v]) => (
            <button key={k} onClick={() => { setPlaying(false); setT(Math.min(v, maxLen - 1)); }}>
              {k}
            </button>
          ))}
        </span>
        <span className="phase">{phaseLabel}</span>
      </div>
      {t >= 1 && t <= 24 && (
        <div className="now">
          <span>Card {t} in arrival order:</span> <Card p={DECK[t - 1]} small />
          <span className="muted">SORT FIRST sees its own order (bigger bar first): its card {t} is {orderFor("sort-first")[t - 1].name}.</span>
        </div>
      )}
      <div className="grid4">
        {RULE_IDS.map((r) => {
          const { steps, summary } = ALL[r];
          const k = Math.min(t, steps.length - 1);
          const st = steps[k];
          const done = t >= steps.length - 1;
          return (
            <div className="col" key={r}>
              <h3>
                {RULES[r].label}
                <small>{RULES[r].aka}</small>
              </h3>
              <div className="note">{t > steps.length - 1 ? "finished" : st.note}</div>
              {st.hosts.map((h) => (
                <Board key={h.id} host={h} highlight={st.host === h.id && st.phase !== "fail"} />
              ))}
              <div className={"stats" + (done ? " done" : "")}>
                <div>
                  hosts used{t >= 24 ? " after Round 1" : ""} <b>{t >= 24 ? summary.used : st.hosts.filter((h) => h.pods.length).length}</b> · <b>${t >= 24 ? summary.used : st.hosts.filter((h) => h.pods.length).length}/hr</b>
                </div>
                {t >= 25 && (
                  <div>
                    BIG: <b>{summary.bigHost === null ? "fits nowhere" : `host ${summary.bigHost}`}</b>
                  </div>
                )}
                {t >= 26 && (
                  <div>
                    host {summary.deadId} died with {summary.victims} pods · lost so far: <b>{steps.slice(27, k + 1).filter((s) => s.host === null).length}</b>
                    {done && summary.lost.length > 0 && <span className="muted"> ({summary.lost.map((p) => p.name).join(", ")})</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Legend />
      {t >= maxLen - 1 && <Scoreboard />}
    </section>
  );
}

function wasted(summary) {
  const b = summary.boards;
  const strandedGb = b.filter((h) => h.cores === HOST.cores).reduce((s, h) => s + (HOST.gb - h.gb), 0);
  const strandedC = b.filter((h) => h.gb === HOST.gb).reduce((s, h) => s + (HOST.cores - h.cores), 0);
  const parts = [];
  if (strandedC) parts.push(`${strandedC} core${strandedC === 1 ? "" : "s"} stranded (memory full)`);
  if (strandedGb) parts.push(`${strandedGb} GB stranded (cores full)`);
  if (!parts.length) parts.push(`nothing stranded; ${summary.free.cores} cores and ${summary.free.gb} GB free but scattered`);
  return parts.join("; ");
}

function Scoreboard() {
  return (
    <table className="score">
      <thead>
        <tr>
          <th>Rule</th>
          <th>Hosts, $/hr</th>
          <th>Wasted where</th>
          <th>BIG (16 / 64)</th>
          <th>Host that died</th>
          <th>Pods with nowhere to go</th>
        </tr>
      </thead>
      <tbody>
        {RULE_IDS.map((r) => {
          const s = ALL[r].summary;
          return (
            <tr key={r}>
              <td>
                <b>{RULES[r].label}</b>
              </td>
              <td>
                {s.used}, ${s.dollars}
              </td>
              <td>{wasted(s)}</td>
              <td>{s.bigHost === null ? "fits nowhere" : `fits, host ${s.bigHost}`}</td>
              <td>
                host {s.deadId}: {s.victims} pods
              </td>
              <td>
                {s.lost.length} of {s.victims}
                {s.lost.length ? ` (${s.lost.map((p) => p.name).join(", ")})` : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
      <caption>
        Free across all five hosts is 44 cores and 312 GB under every rule; where it sits is the difference. An empty host at $1.00 an hour is $730 a month.
      </caption>
    </table>
  );
}

/* ---------------- Play: place by hand, checked against the rule ---------------- */
function Play() {
  const [rule, setRule] = useState(null);
  const [hosts, setHosts] = useState(emptyHosts());
  const [i, setI] = useState(0); // index into the round's queue
  const [phase, setPhase] = useState("round1"); // round1 | big | fail | done
  const [queue, setQueue] = useState([]);
  const [log, setLog] = useState([]);
  const [misses, setMisses] = useState(0);
  const [lost, setLost] = useState([]);
  const [dead, setDead] = useState(null);
  const [usedR1, setUsedR1] = useState(0);

  const start = (r) => {
    setRule(r);
    setHosts(emptyHosts());
    setQueue(orderFor(r));
    setI(0);
    setPhase("round1");
    setLog([]);
    setMisses(0);
    setLost([]);
    setDead(null);
    setUsedR1(0);
  };
  const current = phase === "big" ? BIG : queue[i];
  const answer = current ? choose(hosts, current, rule) : null;

  const advance = (h2) => {
    if (phase === "round1") {
      if (i + 1 < queue.length) setI(i + 1);
      else {
        setUsedR1(h2.filter((h) => h.pods.length).length);
        setPhase("big");
      }
    } else if (phase === "big") {
      // the host with the most pods dies
      const most = Math.max(...h2.map((h) => h.pods.length));
      const d = h2.find((h) => h.pods.length === most);
      const victims = d.pods;
      setDead(d.id);
      setHosts(h2.map((h) => (h.id === d.id ? { ...h, cores: 0, gb: 0, pods: [], alive: false } : h)));
      setQueue(victims);
      setI(0);
      setPhase("fail");
      setLog((l) => [...l, `Host ${d.id} loses power with ${victims.length} pods. Re-place them in card order.`]);
      return;
    } else if (phase === "fail") {
      if (i + 1 < queue.length) setI(i + 1);
      else setPhase("done");
    }
  };

  const tryPlace = (hostId) => {
    if (!current) return;
    const ok = hostId === answer;
    const reason = explain(hosts, current, rule, answer);
    if (!ok) setMisses((m) => m + 1);
    setLog((l) => [
      ...l,
      `${current.name} → you chose ${hostId === null ? "nowhere" : `host ${hostId}`}; the rule says ${answer === null ? "nowhere" : `host ${answer}`}. ${ok ? "Correct." : reason}`,
    ]);
    // the rule is the rule: the pod goes where the rule says, so the board stays comparable to the key
    let h2 = hosts;
    if (answer !== null) h2 = place(hosts, current, answer);
    else if (phase === "fail") setLost((x) => [...x, current]);
    setHosts(h2);
    advance(h2);
  };

  if (!rule)
    return (
      <section className="pick">
        <p>Pick a rule. You will place the same 24 cards the Watch tab uses, then BIG, then re-place the pods of a host that loses power. After each card the app says what the rule would have done, and moves the pod there, so your board stays comparable to the answer key.</p>
        <div className="rulepick">
          {RULE_IDS.map((r) => (
            <button key={r} onClick={() => start(r)}>
              <b>{RULES[r].label}</b>
              <span>{RULES[r].text}</span>
            </button>
          ))}
        </div>
      </section>
    );

  const used = hosts.filter((h) => h.pods.length).length;
  return (
    <section>
      <div className="playhead">
        <div>
          <b>{RULES[rule].label}</b> <span className="muted">{RULES[rule].text}</span>
        </div>
        <button onClick={() => setRule(null)}>choose another rule</button>
      </div>
      {phase !== "done" ? (
        <div className="now">
          <span>
            {phase === "round1" && `Card ${i + 1} of ${queue.length}${rule === "sort-first" ? " (sorted order)" : ""}:`}
            {phase === "big" && "Round 2. BIG arrives:"}
            {phase === "fail" && `Round 3. Re-place pod ${i + 1} of ${queue.length} from host ${dead}:`}
          </span>
          <Card p={current} small />
          <span className="muted">Click the host the rule names, or</span>
          <button onClick={() => tryPlace(null)}>fits nowhere</button>
        </div>
      ) : (
        <div className="now done">
          <b>Done.</b> After Round 1: {usedR1} hosts in use, ${usedR1}/hr. {misses === 0 ? "Every placement matched the rule." : `${misses} placement${misses === 1 ? "" : "s"} differed from the rule.`}{" "}
          {lost.length ? `${lost.length} pod${lost.length === 1 ? "" : "s"} had nowhere to go after the failure: ${lost.map((p) => p.name).join(", ")}.` : "Nothing was lost after the failure."}{" "}
          Compare with the other three rules on the Watch tab.
        </div>
      )}
      <div className="boards1">
        {hosts.map((h) => (
          <Board
            key={h.id}
            host={h}
            clickable={phase !== "done" && h.alive}
            candidate={current ? fits(h, current) : undefined}
            onClick={() => tryPlace(h.id)}
          />
        ))}
      </div>
      <div className="stats">
        hosts used <b>{phase === "round1" ? used : usedR1}</b> · <b>${phase === "round1" ? used : usedR1}/hr</b> · placements that differed from the rule: <b>{misses}</b>
      </div>
      <Legend />
      <ol className="log">
        {log
          .slice()
          .reverse()
          .map((l, k) => (
            <li key={k}>{l}</li>
          ))}
      </ol>
    </section>
  );
}

function explain(hosts, p, rule, answer) {
  if (answer === null) return "No host has room on both bars.";
  const base = rule === "sort-first" ? "first-fit" : rule;
  const cands = hosts.filter((h) => fits(h, p));
  if (base === "first-fit") return `Hosts where both bars have room: ${cands.map((h) => h.id).join(", ")}; the first is host ${answer}.`;
  const sc = cands.map((h) => `host ${h.id} → ${squares(h.cores + p.cores, h.gb + p.gb)} sq`).join(", ");
  return `Squares after placing: ${sc}; ${base === "pack" ? "highest" : "lowest"} wins, ties to the lowest number.`;
}

/* ---------------- About ---------------- */
function About() {
  return (
    <section className="about">
      <h2>What this is</h2>
      <p>
        CS 218, Topics in Cloud Computing, San José State University, Fall 2026. Session 12 (Tuesday, September 29): cluster scheduling and bin-packing in
        practice, the session that collects the Density Auction's promise from September 10 and the "how it picks is Tuesday" promise from September 24.
      </p>
      <p>
        Bin packing: given items of different sizes and bins of one fixed capacity, place every item using as few bins as possible. Here the items are pods
        (two sizes at once: cores and GB), the bins are hosts, and every host in use costs $1.00 an hour. No known method finds the fewest bins quickly as
        the number of items grows, so every real scheduler uses a rule of thumb. This app runs four of them on the same 24 pods in the same order, then
        hands each one a big pod, then kills each one's busiest host, so the only thing that differs between the columns is the rule.
      </p>
      <h2>The dataset</h2>
      <table className="deck">
        <thead>
          <tr>
            <th>#</th>
            <th>pod</th>
            <th>cores</th>
            <th>GB</th>
            <th>squares</th>
          </tr>
        </thead>
        <tbody>
          {DECK.map((p) => (
            <tr key={p.n}>
              <td>{p.n}</td>
              <td>
                <i className="dot" style={{ background: p.color }} /> {p.name}
              </td>
              <td>{p.cores}</td>
              <td>{p.gb}</td>
              <td>
                {p.cores} / {p.gb / 4}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Totals: {totals.cores} cores and {totals.gb} GB. No packing can use fewer than ceil(max({totals.cores}/32, {totals.gb}/128)) = {lowerBound} hosts.
        Whether {lowerBound} is reachable, and by which rule, is what the Watch tab shows. The arrival order is Python's <code>random.Random(218)</code>{" "}
        shuffle from the course's <code>demos/binpack2.py</code>, written out in <code>src/deck.js</code>; the placement code in <code>src/rules.js</code>{" "}
        gives the same boards as that script (<code>npm run check</code>).
      </p>
      <h2>The four rules</h2>
      <dl>
        {RULE_IDS.map((r) => (
          <div key={r}>
            <dt>
              {RULES[r].label} {RULES[r].aka && <small>({RULES[r].aka})</small>}
            </dt>
            <dd>{RULES[r].text}</dd>
          </div>
        ))}
      </dl>
      <h2>The three rounds</h2>
      <p>
        Round 1: place cards 1 to 24 by the rule; a host with at least one pod is in use and costs $1.00 an hour. Round 2: one more card, BIG, 16 cores and 64 GB;
        place it by the rule or declare that it fits nowhere. Round 3: the host with the most pods loses power (ties to the lowest number); its pods come off in card
        order and are re-placed on the surviving hosts by the rule. Count the ones that fit nowhere.
      </p>
      <h2>Two ways capacity goes to waste</h2>
      <p>
        Stranded resources, in Borg's words: resources that "cannot be used because another resource on the machine is fully allocated". A host with every core
        taken and 92 GB free has 92 GB stranded. Fragmentation: free capacity that is large in total but split across hosts in pieces each too small for the next pod.
        Five hosts with 44 free cores and 312 free GB between them, and no single host with 16 cores and 64 GB free at once, cannot place BIG.
      </p>
      <h2>Sources</h2>
      <p>
        Verma, Pedrosa, Korupolu, Oppenheimer, Tune, Wilkes, <em>Large-scale cluster management at Google with Borg</em>, EuroSys 2015:{" "}
        <a href="https://research.google.com/pubs/archive/43438.pdf">research.google.com/pubs/archive/43438.pdf</a> (section 3.2 for stranded resources, E-PVM, best fit and the hybrid).
        Kubernetes scheduler configuration (LeastAllocated is the default; MostAllocated; RequestedToCapacityRatio):{" "}
        <a href="https://kubernetes.io/docs/reference/scheduling/config/">kubernetes.io/docs/reference/scheduling/config</a>. Christensen, Khan, Pokutta, Tetali,
        <em> Approximation and online algorithms for multidimensional bin packing: A survey</em>, Computer Science Review 2017:{" "}
        <a href="https://doi.org/10.1016/j.cosrev.2016.12.001">doi.org/10.1016/j.cosrev.2016.12.001</a>.
      </p>
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState("watch");
  return (
    <div className="app">
      <header>
        <div>
          <span className="kicker">CS 218 · SESSION 12 · ACTIVITY TEN</span>
          <h1>Datacenter Tetris</h1>
          <p>The same 24 pods, four placement rules, one big arrival, one host failure. Only the rule differs.</p>
        </div>
        <nav>
          {[
            ["watch", "Watch: four rules side by side"],
            ["play", "Play: place by hand"],
            ["about", "About"],
          ].map(([k, v]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {v}
            </button>
          ))}
        </nav>
      </header>
      {tab === "watch" && <Watch />}
      {tab === "play" && <Play />}
      {tab === "about" && <About />}
      <footer>SJSU · CS 218 · Fall 2026 · ungraded · answer key: demos/binpack2.py in the course repository</footer>
    </div>
  );
}

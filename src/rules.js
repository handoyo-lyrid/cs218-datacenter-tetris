// The four placement rules and the three rounds, exactly as printed on the policy cards.
// This file is the answer key: demos/binpack2.py in the course repository gives the same boards.
import { DECK, BIG, HOST, HOSTS, squares } from "./deck.js";

export const RULES = {
  "first-fit": {
    label: "FIRST FIT",
    aka: "",
    text: "Try host 1, then 2, then 3, then 4, then 5. Place the pod on the first host where both bars have room.",
  },
  pack: {
    label: "PACK",
    aka: "best fit; Kubernetes MostAllocated",
    text: "Of the hosts where it fits, choose the one whose total filled squares (both bars added together) will be highest after placing. Tie: the lowest host number.",
  },
  spread: {
    label: "SPREAD",
    aka: "worst fit; Borg's E-PVM; Kubernetes LeastAllocated",
    text: "Of the hosts where it fits, choose the one whose total filled squares (both bars added together) will be lowest after placing. Tie: the lowest host number.",
  },
  "sort-first": {
    label: "SORT FIRST",
    aka: "first fit decreasing",
    text: "Before placing anything, re-order the deck: largest bigger bar first (a db is 12, an encoder is 12, a cache is 6, a batch is 6, a worker is 4, a web is 2); ties keep their card order. Then use FIRST FIT.",
  },
};
export const RULE_IDS = Object.keys(RULES);

export const MIN_HOSTS = 2, MAX_HOSTS = 8;
export const emptyHosts = (n = HOSTS) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, cores: 0, gb: 0, pods: [], alive: true }));

export const fits = (h, p) => h.alive && h.cores + p.cores <= HOST.cores && h.gb + p.gb <= HOST.gb;

// The host the rule names for this pod, or null when it fits nowhere. Pure: does not modify hosts.
export function choose(hosts, p, rule) {
  const base = rule === "sort-first" ? "first-fit" : rule;
  const cands = hosts.filter((h) => fits(h, p));
  if (cands.length === 0) return null;
  if (base === "first-fit") return cands[0].id;
  const score = (h) => squares(h.cores + p.cores, h.gb + p.gb);
  const target = base === "pack" ? Math.max(...cands.map(score)) : Math.min(...cands.map(score));
  return cands.find((h) => score(h) === target).id; // lowest id among ties, since hosts are in id order
}

export function place(hosts, p, hostId) {
  return hosts.map((h) =>
    h.id === hostId ? { ...h, cores: h.cores + p.cores, gb: h.gb + p.gb, pods: [...h.pods, p] } : h
  );
}

// The deck in the order a rule sees it.
export function orderFor(rule) {
  if (rule !== "sort-first") return DECK;
  const bigger = (p) => Math.max(p.cores, p.gb / 4);
  return [...DECK].sort((a, b) => bigger(b) - bigger(a) || a.n - b.n);
}

// Every step of all three rounds, so a viewer can scrub. Each step is a full snapshot.
// n is the number of hosts in the fleet. A pod that fits nowhere stays pending (Kubernetes leaves it unscheduled).
export function simulate(rule, n = HOSTS) {
  const order = orderFor(rule);
  let hosts = emptyHosts(n);
  const steps = [{ phase: "start", hosts, note: `${n} empty hosts.`, pod: null, host: null, pending: [] }];
  const unplaced = [];
  for (const p of order) {
    const id = choose(hosts, p, rule);
    if (id === null) unplaced.push(p);
    else hosts = place(hosts, p, id);
    steps.push({
      phase: "place",
      hosts,
      pod: p,
      host: id,
      pending: [...unplaced],
      note: id === null ? `${p.name} (${p.cores} c / ${p.gb} GB) fits nowhere: pending.` : `${p.name} (${p.cores} c / ${p.gb} GB) to host ${id}.`,
    });
  }
  const used = hosts.filter((h) => h.pods.length).length;
  // Round 2: BIG
  const bigHost = choose(hosts, BIG, rule);
  const hostsAfterBig = bigHost === null ? hosts : place(hosts, BIG, bigHost);
  steps.push({
    phase: "big",
    hosts: hostsAfterBig,
    pod: BIG,
    host: bigHost,
    pending: [...unplaced],
    note: bigHost === null ? "BIG (16 c / 64 GB) fits nowhere: pending." : `BIG (16 c / 64 GB) to host ${bigHost}.`,
  });
  // Round 3: with BIG on the board, the host with the most pods (ties to the lowest id) loses power
  const counts = hostsAfterBig.map((h) => h.pods.length);
  const most = Math.max(...counts);
  const deadId = hostsAfterBig.find((h) => h.pods.length === most).id;
  const victims = hostsAfterBig.find((h) => h.id === deadId).pods;
  let after = hostsAfterBig.map((h) => (h.id === deadId ? { ...h, cores: 0, gb: 0, pods: [], alive: false } : h));
  steps.push({
    phase: "fail",
    hosts: after,
    pod: null,
    host: deadId,
    pending: [...unplaced],
    note: `Host ${deadId} loses power with ${victims.length} pods on it. They come off in card order and are re-placed by the rule.`,
    victims,
  });
  const lost = [];
  for (const p of victims) {
    const id = choose(after, p, rule);
    if (id === null) lost.push(p);
    else after = place(after, p, id);
    steps.push({
      phase: "replace",
      hosts: after,
      pod: p,
      host: id,
      pending: [...unplaced, ...lost],
      note: id === null ? `${p.name} fits nowhere on the surviving hosts.` : `${p.name} re-placed on host ${id}.`,
    });
  }
  const free = hosts.reduce((t, h) => ({ cores: t.cores + HOST.cores - h.cores, gb: t.gb + HOST.gb - h.gb }), { cores: 0, gb: 0 });
  const summary = {
    rule,
    n,
    used,
    dollars: used * HOST.dollarsPerHour,
    unplaced,
    bigHost,
    deadId,
    victims: victims.length,
    lost,
    free,
    boards: hosts,
  };
  return { steps, summary };
}

const cache = new Map();
export function runAll(n = HOSTS) {
  if (!cache.has(n)) cache.set(n, Object.fromEntries(RULE_IDS.map((r) => [r, simulate(r, n)])));
  return cache.get(n);
}
export const ALL = runAll(HOSTS);

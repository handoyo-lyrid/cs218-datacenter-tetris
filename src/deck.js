// The Activity Ten dataset. CS 218, Session 12 (Tuesday, September 29, 2026).
//
// Every host is the auction host: 32 cores, 128 GB, $1.00 an hour while in use.
// Drawn as two bars of 32 squares: one square is 1 core on the CPU bar and 4 GB on the memory bar.
//
// The 24 pods arrive in a fixed order. The order is Python's random.Random(218).shuffle of the
// six shapes below (the course's demos/binpack2.py); it is written out here rather than re-shuffled,
// because JavaScript has no way to reproduce Python's generator and the order is the experiment.

export const HOST = { cores: 32, gb: 128, dollarsPerHour: 1.0 };
export const HOSTS = 5;
export const GB_PER_SQUARE = 4;

export const SHAPES = {
  web: { cores: 2, gb: 4, color: "#0055A2" },
  worker: { cores: 4, gb: 8, color: "#5B8FCB" },
  cache: { cores: 1, gb: 24, color: "#E5A823" },
  encoder: { cores: 12, gb: 8, color: "#B00020" },
  db: { cores: 8, gb: 48, color: "#1B7A3D" },
  batch: { cores: 6, gb: 16, color: "#939597" },
};

const ORDER = [
  "web-3", "web-1", "web-5", "worker-4", "worker-2", "worker-3", "cache-3", "worker-1",
  "worker-5", "encoder-4", "batch-2", "encoder-3", "batch-1", "db-2", "cache-2", "db-1",
  "web-2", "cache-1", "encoder-1", "encoder-2", "worker-6", "web-4", "web-6", "cache-4",
];

export const DECK = ORDER.map((name, i) => {
  const kind = name.split("-")[0];
  const s = SHAPES[kind];
  return { n: i + 1, name, kind, cores: s.cores, gb: s.gb, color: s.color };
});

export const BIG = { n: 25, name: "BIG", kind: "big", cores: 16, gb: 64, color: "#B00020" };

export const squares = (cores, gb) => cores + gb / GB_PER_SQUARE;

export const totals = DECK.reduce(
  (t, p) => ({ cores: t.cores + p.cores, gb: t.gb + p.gb }),
  { cores: 0, gb: 0 }
);
export const lowerBound = Math.ceil(Math.max(totals.cores / HOST.cores, totals.gb / HOST.gb));

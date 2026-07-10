import { describe, it, expect } from "vitest";
import { loadDataset } from "../src/load";
import {
  PreferenceModel,
  explain,
  rankJobs,
  diverseTopJobs,
  randomPair,
  mostInformativePair,
  mulberry32,
} from "../src/engine";
import type { Job } from "../src/types";

const data = loadDataset();
const dim = data.axes.length;
const axisIndex = (name: string) => data.axes.findIndex((a) => a.name === name);

function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

/**
 * Simulate a user whose *true* utility is wTrue · x. For each random pair the
 * user prefers the higher-utility job (with logistic noise), and we feed those
 * choices to a fresh model. If the engine works, the learned w should point the
 * same way as wTrue.
 */
function simulateUser(wTrue: number[], nComparisons: number, seed: number): PreferenceModel {
  const rand = mulberry32(seed);
  const model = new PreferenceModel({ dim, learningRate: 0.2, l2: 0.01 });
  const util = (v: number[]) => v.reduce((s, x, i) => s + wTrue[i] * x, 0);
  for (let n = 0; n < nComparisons; n++) {
    const [a, b] = randomPair(data.jobs, rand);
    const pa = 1 / (1 + Math.exp(-(util(a.v) - util(b.v))));
    const aWins = rand() < pa;
    model.observe(aWins ? a.v : b.v, aWins ? b.v : a.v);
  }
  return model;
}

describe("dataset artifact", () => {
  it("loads jobs with vectors matching the axis count", () => {
    expect(data.jobs.length).toBeGreaterThan(800);
    expect(data.axes.length).toBe(28);
    for (const j of data.jobs) expect(j.v.length).toBe(dim);
  });
});

/** Run a simulated user with a given pair-selection strategy; return cosine(w, wTrue). */
function convergence(
  wTrue: number[],
  nComparisons: number,
  seed: number,
  select: (m: PreferenceModel, rand: () => number) => [Job, Job],
): number {
  const rand = mulberry32(seed);
  const model = new PreferenceModel({ dim, learningRate: 0.2, l2: 0.01 });
  const util = (v: number[]) => v.reduce((s, x, i) => s + wTrue[i] * x, 0);
  for (let k = 0; k < nComparisons; k++) {
    const [a, b] = select(model, rand);
    const pa = 1 / (1 + Math.exp(-(util(a.v) - util(b.v))));
    const aWins = rand() < pa;
    model.observe(aWins ? a.v : b.v, aWins ? b.v : a.v);
  }
  return cosine(model.w, wTrue);
}

describe("active learning (info-gain pair selection)", () => {
  it("returns a valid distinct pair", () => {
    const model = new PreferenceModel({ dim });
    const [a, b] = mostInformativePair(model, data.jobs, mulberry32(1), 64);
    expect(a.code).not.toBe(b.code);
  });

  it("converges faster than random selection", () => {
    // multi-axis true preference; average over seeds (deterministic given fixed seeds)
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const N = 25;
    const wTrue = new Array(dim).fill(0);
    wTrue[axisIndex("Investigative")] = 1.3;
    wTrue[axisIndex("Artistic")] = 0.9;
    wTrue[axisIndex("Social")] = -1.1;

    const mean = (f: (s: number) => number) =>
      seeds.reduce((acc, s) => acc + f(s), 0) / seeds.length;

    const randomMean = mean((s) =>
      convergence(wTrue, N, s, (_m, r) => randomPair(data.jobs, r)),
    );
    const infoMean = mean((s) =>
      convergence(wTrue, N, s, (m, r) => mostInformativePair(m, data.jobs, r, 256)),
    );

    expect(infoMean).toBeGreaterThan(randomMean + 0.03);
  });
});

describe("diversified results (MMR)", () => {
  function meanPairwiseCos(jobs: Job[]): number {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < jobs.length; i++) {
      for (let j = i + 1; j < jobs.length; j++) {
        sum += cosine(jobs[i].v, jobs[j].v);
        count++;
      }
    }
    return sum / count;
  }

  it("preserves the #1 match but reduces redundancy vs the raw ranking", () => {
    // multi-faceted preference (like a real user) -> raw ranking clusters, but
    // there are distinct good-fit sub-clusters for diversification to surface.
    const wTrue = new Array(dim).fill(0);
    wTrue[axisIndex("Investigative")] = 1.6;
    wTrue[axisIndex("Realistic")] = 0.8;
    wTrue[axisIndex("Independence (Value)")] = 0.7;
    wTrue[axisIndex("Social")] = -1.0;
    const rand = mulberry32(3);
    const model = new PreferenceModel({ dim, learningRate: 0.2, l2: 0.01 });
    const util = (v: number[]) => v.reduce((s, x, i) => s + wTrue[i] * x, 0);
    for (let k = 0; k < 300; k++) {
      const [a, b] = randomPair(data.jobs, rand);
      const pa = 1 / (1 + Math.exp(-(util(a.v) - util(b.v))));
      const aWins = rand() < pa;
      model.observe(aWins ? a.v : b.v, aWins ? b.v : a.v);
    }

    const raw = rankJobs(model, data.jobs).slice(0, 12).map((s) => s.job);
    const diverse = diverseTopJobs(model, data.jobs, { count: 12 }).map((s) => s.job);

    // best match is unchanged
    expect(diverse[0].code).toBe(raw[0].code);
    // and the list is genuinely less redundant (clear margin, not float noise)
    expect(meanPairwiseCos(diverse)).toBeLessThan(meanPairwiseCos(raw) - 0.05);
  });
});

describe("preference recovery", () => {
  it("recovers a single preferred axis (Investigative)", () => {
    const wTrue = new Array(dim).fill(0);
    wTrue[axisIndex("Investigative")] = 1;
    const model = simulateUser(wTrue, 500, 1);

    const topLikes = explain(model, data.axes, 3).likes.map((l) => l.axis);
    expect(topLikes).toContain("Investigative");
    expect(model.w[axisIndex("Investigative")]).toBeGreaterThan(0);
    expect(cosine(model.w, wTrue)).toBeGreaterThan(0.5);
  });

  it("recovers two preferred axes (Investigative + Independence value)", () => {
    const wTrue = new Array(dim).fill(0);
    wTrue[axisIndex("Investigative")] = 1;
    wTrue[axisIndex("Independence (Value)")] = 1;
    const model = simulateUser(wTrue, 700, 2);

    const topLikes = explain(model, data.axes, 5).likes.map((l) => l.axis);
    expect(topLikes).toContain("Investigative");
    expect(topLikes).toContain("Independence (Value)");
    expect(cosine(model.w, wTrue)).toBeGreaterThan(0.5);
  });

  it("recovers an aversion (negative preference for Realistic)", () => {
    const wTrue = new Array(dim).fill(0);
    wTrue[axisIndex("Realistic")] = -1;
    const model = simulateUser(wTrue, 500, 3);

    const topDislikes = explain(model, data.axes, 3).dislikes.map((l) => l.axis);
    expect(topDislikes).toContain("Realistic");
    expect(model.w[axisIndex("Realistic")]).toBeLessThan(0);
  });

  it("ranks a full ordering of every job", () => {
    const wTrue = new Array(dim).fill(0);
    wTrue[axisIndex("Investigative")] = 1;
    const model = simulateUser(wTrue, 400, 4);
    const ranked = rankJobs(model, data.jobs);
    expect(ranked.length).toBe(data.jobs.length);
    // sorted descending
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });
});

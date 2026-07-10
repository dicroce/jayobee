import { describe, it, expect } from "vitest";
import { loadDataset } from "../src/load";
import {
  PreferenceModel,
  explain,
  rankJobs,
  randomPair,
  mulberry32,
} from "../src/engine";

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

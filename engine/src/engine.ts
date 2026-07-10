import type { Axis, Job } from "./types";

/**
 * The preference engine.
 *
 * We model a user's utility for a job as a linear function u(x) = w · x over the
 * interpretable taste axes. Each A-vs-B comparison is a Bradley-Terry observation:
 *
 *     P(A ≻ B) = sigmoid( w · (x_A - x_B) )
 *
 * `w` is learned online (one SGD step per click) with ridge (L2) shrinkage, since
 * the taste axes are collinear. `w` *is* the discovered preference — reading off
 * its largest components tells the user what they value; scoring every job by
 * u(x) ranks all of them, including jobs never shown.
 */

export interface ModelOptions {
  dim: number;
  /** SGD step size per comparison. */
  learningRate?: number;
  /** Ridge (L2) shrinkage strength; keeps collinear axes from fighting. */
  l2?: number;
}

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

export class PreferenceModel {
  /** The learned preference direction. Public so callers can inspect/serialize. */
  readonly w: Float64Array;
  private readonly lr: number;
  private readonly l2: number;
  private nUpdates = 0;

  constructor(opts: ModelOptions) {
    this.w = new Float64Array(opts.dim);
    this.lr = opts.learningRate ?? 0.2;
    this.l2 = opts.l2 ?? 0.01;
  }

  /** Utility of a feature vector: u(x) = w · x. */
  utility(v: readonly number[]): number {
    const w = this.w;
    let s = 0;
    for (let i = 0; i < w.length; i++) s += w[i] * v[i];
    return s;
  }

  /** Probability the model currently assigns to A being preferred over B. */
  prefProb(a: readonly number[], b: readonly number[]): number {
    const w = this.w;
    let z = 0;
    for (let i = 0; i < w.length; i++) z += w[i] * (a[i] - b[i]);
    return sigmoid(z);
  }

  /**
   * Learn from a single comparison where `winner` was preferred over `loser`.
   * Ascends the Bradley-Terry log-likelihood with ridge shrinkage:
   *   w += lr * ( (1 - p) * (winner - loser) - l2 * w )
   */
  observe(winner: readonly number[], loser: readonly number[]): void {
    const w = this.w;
    let z = 0;
    for (let i = 0; i < w.length; i++) z += w[i] * (winner[i] - loser[i]);
    const g = 1 - sigmoid(z);
    for (let i = 0; i < w.length; i++) {
      const d = winner[i] - loser[i];
      w[i] += this.lr * (g * d - this.l2 * w[i]);
    }
    this.nUpdates++;
  }

  get updates(): number {
    return this.nUpdates;
  }
}

export interface ScoredJob {
  job: Job;
  score: number;
}

/** All jobs ranked by learned utility, best first. */
export function rankJobs(model: PreferenceModel, jobs: readonly Job[]): ScoredJob[] {
  return jobs
    .map((job) => ({ job, score: model.utility(job.v) }))
    .sort((a, b) => b.score - a.score);
}

export interface AxisWeight {
  axis: string;
  block: string;
  weight: number;
}

/** The plain-English readout: the axes the user leans toward and away from. */
export function explain(
  model: PreferenceModel,
  axes: readonly Axis[],
  topK = 6,
): { likes: AxisWeight[]; dislikes: AxisWeight[] } {
  const weighted: AxisWeight[] = axes.map((a, i) => ({
    axis: a.name,
    block: a.block,
    weight: model.w[i],
  }));
  const byWeight = [...weighted].sort((a, b) => b.weight - a.weight);
  const likes = byWeight.filter((x) => x.weight > 0).slice(0, topK);
  const dislikes = byWeight
    .filter((x) => x.weight < 0)
    .slice(-topK)
    .reverse();
  return { likes, dislikes };
}

/* ------------------------------------------------------------------ */
/* Pair selection                                                      */
/* ------------------------------------------------------------------ */

/** Small seedable PRNG (mulberry32) so games/tests are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A uniformly random distinct pair of jobs. */
export function randomPair(jobs: readonly Job[], rand: () => number): [Job, Job] {
  const i = Math.floor(rand() * jobs.length);
  let j = Math.floor(rand() * jobs.length);
  if (j === i) j = (j + 1) % jobs.length;
  return [jobs[i], jobs[j]];
}

/**
 * Active learning: sample `sampleSize` candidate pairs and return the one the
 * model is currently most uncertain about (prefProb closest to 0.5) — the most
 * informative question to ask next.
 */
export function mostUncertainPair(
  model: PreferenceModel,
  jobs: readonly Job[],
  rand: () => number,
  sampleSize = 64,
): [Job, Job] {
  let best: [Job, Job] | null = null;
  let bestGap = Infinity;
  for (let s = 0; s < sampleSize; s++) {
    const pair = randomPair(jobs, rand);
    const gap = Math.abs(model.prefProb(pair[0].v, pair[1].v) - 0.5);
    if (gap < bestGap) {
      bestGap = gap;
      best = pair;
    }
  }
  return best!;
}

import type { Axis, Job } from "./types";
import { invert, quadForm } from "./linalg";

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
  /**
   * Running Fisher information of w (row-major n×n): A = l2·I + Σ p(1-p)·d·dᵀ over
   * observed comparisons. A⁻¹ is the posterior covariance of w — the active-learning
   * selector uses it to find the pair that reveals the most about still-uncertain axes.
   * Public so it can be serialized/restored alongside w.
   */
  readonly info: Float64Array;
  private readonly dim: number;
  private readonly scratch: Float64Array;
  private readonly lr: number;
  /** ridge strength; also the prior precision (prior variance per axis = 1/l2). */
  readonly l2: number;
  private nUpdates = 0;

  constructor(opts: ModelOptions) {
    const n = opts.dim;
    this.dim = n;
    this.w = new Float64Array(n);
    this.scratch = new Float64Array(n);
    this.info = new Float64Array(n * n);
    this.lr = opts.learningRate ?? 0.2;
    this.l2 = opts.l2 ?? 0.01;
    for (let i = 0; i < n; i++) this.info[i * n + i] = this.l2; // ridge prior precision
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
    const n = this.dim;
    const d = this.scratch;
    let z = 0;
    for (let i = 0; i < n; i++) {
      d[i] = winner[i] - loser[i];
      z += w[i] * d[i];
    }
    const p = sigmoid(z);
    const g = 1 - p; // gradient scale of the log-likelihood
    for (let i = 0; i < n; i++) w[i] += this.lr * (g * d[i] - this.l2 * w[i]);
    // accumulate Fisher information: A += p(1-p)·d·dᵀ
    const pq = p * (1 - p);
    const info = this.info;
    for (let i = 0; i < n; i++) {
      const di = pq * d[i];
      const base = i * n;
      for (let j = 0; j < n; j++) info[base + j] += di * d[j];
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

export interface DiverseOptions {
  /** how many jobs to return */
  count?: number;
  /** draw from this many top-utility jobs, so diversity never surfaces a bad fit */
  poolSize?: number;
  /** relevance vs. diversity: 1 = pure utility (clones), lower = more varied */
  lambda?: number;
}

function unit(v: readonly number[]): Float64Array {
  const u = new Float64Array(v.length);
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  const inv = 1 / (Math.sqrt(n) + 1e-12);
  for (let i = 0; i < v.length; i++) u[i] = v[i] * inv;
  return u;
}

function dot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Diversified top matches via Maximal Marginal Relevance. A strong single-axis
 * preference makes the raw utility ranking collapse into near-clones (12 flavors
 * of physicist); MMR instead greedily picks jobs that are high-utility *and*
 * dissimilar from those already chosen, so the list spans your distinct good-fit
 * clusters. The #1 pick is still your single best match (no diversity penalty on
 * the first selection).
 */
export function diverseTopJobs(
  model: PreferenceModel,
  jobs: readonly Job[],
  opts: DiverseOptions = {},
): ScoredJob[] {
  const count = opts.count ?? 12;
  const poolSize = opts.poolSize ?? 60;
  // 0.5 is the standard MMR balance; empirically it surfaces distinct good-fit
  // clusters (e.g. hands-on roles beside research roles) rather than near-clones,
  // while the poolSize cap keeps every pick a genuine top match.
  const lambda = opts.lambda ?? 0.5;

  const pool = rankJobs(model, jobs).slice(0, Math.max(poolSize, count));
  // normalize utility to [0,1] within the pool so it's comparable to cosine sim
  const scores = pool.map((r) => r.score);
  const min = Math.min(...scores);
  const span = Math.max(...scores) - min || 1;
  const rel = pool.map((r) => (r.score - min) / span);
  const units = pool.map((r) => unit(r.job.v));

  const selected: number[] = [];
  const remaining = new Set(pool.map((_, i) => i));
  while (selected.length < count && remaining.size > 0) {
    let bestIdx = -1;
    let bestVal = -Infinity;
    for (const i of remaining) {
      let maxSim = 0;
      if (selected.length > 0) {
        maxSim = -Infinity;
        for (const s of selected) {
          const sim = dot(units[i], units[s]);
          if (sim > maxSim) maxSim = sim;
        }
      }
      const mmr = lambda * rel[i] - (1 - lambda) * maxSim;
      if (mmr > bestVal) {
        bestVal = mmr;
        bestIdx = i;
      }
    }
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }
  return selected.map((i) => pool[i]);
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

export interface AxisStat extends AxisWeight {
  /** posterior std of this axis's weight (from A⁻¹). */
  std: number;
  /** Wald score weight/std — how many std devs the preference is from zero. */
  z: number;
  /** fraction of this axis's prior uncertainty resolved so far, 0..1. */
  resolution: number;
}

/** Per-axis weight plus its posterior uncertainty (Laplace approx: cov = A⁻¹). */
export function axisStats(model: PreferenceModel, axes: readonly Axis[]): AxisStat[] {
  const n = model.w.length;
  const cov = invert(model.info, n);
  const priorVar = 1 / model.l2;
  return axes.map((a, i) => {
    const variance = Math.max(cov[i * n + i], 0);
    const std = Math.sqrt(variance);
    const weight = model.w[i];
    return {
      axis: a.name,
      block: a.block,
      weight,
      std,
      z: std > 1e-12 ? weight / std : 0,
      resolution: Math.min(1, Math.max(0, 1 - variance / priorVar)),
    };
  });
}

/** z at/above which an axis reads as fully confident (used for tiering + stability). */
export const Z_CONFIDENT = 2.0;

export type Confidence = "high" | "medium" | "low";

/** Map a Wald score to a coarse confidence tier for display. */
export function confidenceTier(z: number): Confidence {
  const a = Math.abs(z);
  if (a >= Z_CONFIDENT) return "high";
  if (a >= 1.0) return "medium";
  return "low";
}

export interface Readout {
  /** strongest positive preferences (top by weight), each carrying its confidence */
  likes: AxisStat[];
  /** strongest aversions */
  dislikes: AxisStat[];
  /**
   * 0..1 "how settled": each axis's confidence saturates at Z_CONFIDENT and is
   * weighted by how strong the preference is, so it tracks the axes you care about.
   */
  stability: number;
}

/**
 * Confidence-aware readout. We always surface the top axes by weight (so the screen
 * is never empty), but each one carries a `z` / confidence tier from its posterior
 * uncertainty — the UI fades low-confidence axes so a noisy secondary that would flip
 * between sessions is visibly marked "still forming" rather than asserted as fact.
 */
export function readout(
  model: PreferenceModel,
  axes: readonly Axis[],
  opts: { topK?: number } = {},
): Readout {
  const topK = opts.topK ?? 5;
  const stats = axisStats(model, axes);

  const likes = stats
    .filter((s) => s.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topK);
  const dislikes = stats
    .filter((s) => s.weight < 0)
    .sort((a, b) => a.weight - b.weight)
    .slice(0, topK);

  // strength-weighted, saturating confidence over all axes
  let num = 0;
  let den = 0;
  for (const s of stats) {
    const conf = Math.min(1, Math.abs(s.z) / Z_CONFIDENT);
    num += Math.abs(s.weight) * conf;
    den += Math.abs(s.weight);
  }
  const stability = den > 0 ? num / den : 0;

  return { likes, dislikes, stability };
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

/**
 * Active learning, tuned for fastest learning: from a sampled pool of candidate
 * pairs, return the one with the greatest expected information gain about w:
 *
 *     gain(a, b) = p(1-p) · (dᵀ A⁻¹ d),   d = a - b,  p = P(a ≻ b)
 *
 * The first factor p(1-p) is "surprise" (largest when the outcome is a toss-up —
 * a predictable answer teaches nothing). The second factor dᵀA⁻¹d is how far the
 * pair differs *along directions we're still uncertain about* — it shrinks axes
 * we've already pinned down, so the selector automatically stops re-probing known
 * axes and explores new ones. Early on (A = l2·I, w = 0) this reduces to picking
 * the most different pairs; it sharpens as evidence accumulates.
 */
export function mostInformativePair(
  model: PreferenceModel,
  jobs: readonly Job[],
  rand: () => number,
  sampleSize = 256,
): [Job, Job] {
  const n = model.w.length;
  const cov = invert(model.info, n); // A⁻¹ = posterior covariance of w (once per call)
  const d = new Float64Array(n);
  let best: [Job, Job] | null = null;
  let bestGain = -Infinity;
  for (let s = 0; s < sampleSize; s++) {
    const [a, b] = randomPair(jobs, rand);
    let z = 0;
    for (let i = 0; i < n; i++) {
      d[i] = a.v[i] - b.v[i];
      z += model.w[i] * d[i];
    }
    const p = sigmoid(z);
    const gain = p * (1 - p) * quadForm(cov, d, n);
    if (gain > bestGain) {
      bestGain = gain;
      best = [a, b];
    }
  }
  return best!;
}

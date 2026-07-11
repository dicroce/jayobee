import { useCallback, useRef, useState } from "react";
import {
  PreferenceModel,
  readout,
  diverseTopJobs,
  explainMatch,
  randomPair,
  mostInformativePair,
  mulberry32,
  type ScoredJob,
  type AxisStat,
} from "@engine/engine";
import type { Job } from "@engine/types";
import { dataset } from "./data";

const STORAGE_KEY = "jayobee.v1";

interface Saved {
  w: number[];
  info: number[];
  count: number;
}

function loadSaved(): Saved | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? (JSON.parse(s) as Saved) : null;
  } catch {
    return null;
  }
}

export interface GameResults {
  likes: AxisStat[];
  dislikes: AxisStat[];
  stability: number;
}

export function usePreferenceGame() {
  const dim = dataset.axes.length;

  // Persistent-across-renders singletons.
  const modelRef = useRef<PreferenceModel | null>(null);
  const randRef = useRef<(() => number) | null>(null);
  if (modelRef.current === null) {
    const model = new PreferenceModel({ dim });
    const saved = loadSaved();
    if (saved && saved.w.length === dim) {
      model.w.set(saved.w);
      if (saved.info?.length === dim * dim) model.info.set(saved.info);
    }
    modelRef.current = model;
    randRef.current = mulberry32((Date.now() & 0xffffffff) >>> 0);
  }

  const initialCount = loadSaved()?.count ?? 0;
  const [count, setCount] = useState(initialCount);
  const [pair, setPair] = useState<[Job, Job]>(() =>
    randomPair(dataset.jobs, randRef.current!),
  );

  const persist = useCallback((c: number) => {
    const model = modelRef.current!;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          w: Array.from(model.w),
          info: Array.from(model.info),
          count: c,
        }),
      );
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, []);

  const nextPair = useCallback(() => {
    const model = modelRef.current!;
    const rand = randRef.current!;
    // Info-gain selects diverse pairs when it knows nothing and sharpens as it
    // learns, so no separate random warmup is needed.
    setPair(mostInformativePair(model, dataset.jobs, rand, 256));
  }, []);

  /** Record a choice (winner = 0 for left/top card, 1 for right/bottom). */
  const choose = useCallback(
    (winner: 0 | 1) => {
      const model = modelRef.current!;
      const [a, b] = pair;
      if (winner === 0) model.observe(a.v, b.v);
      else model.observe(b.v, a.v);
      const n = count + 1;
      setCount(n);
      persist(n);
      nextPair();
    },
    [pair, count, persist, nextPair],
  );

  const skip = useCallback(() => nextPair(), [nextPair]);

  // The "you" part of the results — independent of any salary filter.
  const results = useCallback(
    (): GameResults => readout(modelRef.current!, dataset.axes, { topK: 5 }),
    [],
  );

  // The matched-careers list, optionally floored by median wage. Filtering happens
  // on the OUTPUT only — the preference model is always learned over all jobs.
  const matches = useCallback((minWage = 0): ScoredJob[] => {
    const model = modelRef.current!;
    const pool =
      minWage > 0
        ? dataset.jobs.filter((j) => (j.wage?.median ?? -1) >= minWage)
        : dataset.jobs;
    return diverseTopJobs(model, pool, { count: 12 });
  }, []);

  const explainJob = useCallback(
    (job: Job) => explainMatch(modelRef.current!, job, dataset.axes, { topK: 3 }),
    [],
  );

  const reset = useCallback(() => {
    const model = new PreferenceModel({ dim });
    modelRef.current = model;
    localStorage.removeItem(STORAGE_KEY);
    setCount(0);
    nextPair();
  }, [dim, nextPair]);

  return { pair, count, choose, skip, results, matches, reset, explainJob };
}

/** One interpretable dimension of the taste space (e.g. "Investigative"). */
export interface Axis {
  name: string;
  /** which O*NET block it came from: "interest" | "value" | "style" */
  block: string;
}

/** Annual wage percentiles (BLS OEWS), USD. Display/filter only — never a taste axis. */
export interface Wage {
  median: number;
  p10: number | null;
  p90: number | null;
}

/** Preparation level (O*NET Job Zone 1–5). */
export interface JobZone {
  zone: number;
  name: string;
  education: string;
}

export interface RelatedJob {
  code: string;
  title: string;
}

/** One occupation with its z-scored taste vector `v` (length === axes.length). */
export interface Job {
  code: string;
  title: string;
  desc: string;
  v: number[];
  /** null when OEWS has no wage for this SOC (or no wage file was built in). */
  wage?: Wage | null;
  jobZone?: JobZone | null;
  tasks?: string[];
  related?: RelatedJob[];
}

/** The static artifact emitted by the Python ETL (data/taste_vectors.json). */
export interface Dataset {
  meta?: Record<string, unknown>;
  axes: Axis[];
  jobs: Job[];
}

/** One interpretable dimension of the taste space (e.g. "Investigative"). */
export interface Axis {
  name: string;
  /** which O*NET block it came from: "interest" | "value" | "style" */
  block: string;
}

/** One occupation with its z-scored taste vector `v` (length === axes.length). */
export interface Job {
  code: string;
  title: string;
  desc: string;
  v: number[];
}

/** The static artifact emitted by the Python ETL (data/taste_vectors.json). */
export interface Dataset {
  meta?: Record<string, unknown>;
  axes: Axis[];
  jobs: Job[];
}

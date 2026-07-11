import raw from "@data/taste_vectors.json";
import type { Dataset, Job } from "@engine/types";

/** The static ETL artifact, bundled as an app asset (offline, no server). */
export const dataset = raw as unknown as Dataset;

/** Fast lookup for navigating between related jobs. */
export const jobByCode = new Map<string, Job>(dataset.jobs.map((j) => [j.code, j]));

import raw from "@data/taste_vectors.json";
import type { Dataset } from "@engine/types";

/** The static ETL artifact, bundled as an app asset (offline, no server). */
export const dataset = raw as unknown as Dataset;

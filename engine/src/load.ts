import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Dataset } from "./types";

/**
 * Node-only loader for the ETL artifact. The browser/Capacitor build will import
 * the JSON directly as a bundled asset instead — the engine itself stays I/O-free.
 */
const here = dirname(fileURLToPath(import.meta.url));
export const ARTIFACT_PATH = resolve(here, "../../data/taste_vectors.json");

export function loadDataset(path: string = ARTIFACT_PATH): Dataset {
  return JSON.parse(readFileSync(path, "utf-8")) as Dataset;
}

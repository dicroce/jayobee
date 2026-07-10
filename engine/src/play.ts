import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadDataset } from "./load";
import {
  PreferenceModel,
  rankJobs,
  explain,
  randomPair,
  mostUncertainPair,
  mulberry32,
} from "./engine";

/**
 * Terminal harness to *feel* the engine. Not the product — just a way to play
 * the comparison game against the real data before any UI exists.
 *
 *   npm run play
 */

const data = loadDataset();
const model = new PreferenceModel({ dim: data.axes.length, learningRate: 0.2, l2: 0.01 });
const rand = mulberry32(12345);
const rl = createInterface({ input, output });

function showResults(): void {
  const { likes, dislikes } = explain(model, data.axes, 5);
  console.log(`\n  ── after ${model.updates} choices ──`);
  console.log("  Drawn toward:  " + (likes.map((l) => l.axis).join(", ") || "(nothing yet)"));
  console.log("  Away from:     " + (dislikes.map((l) => l.axis).join(", ") || "(nothing yet)"));
  console.log("  Top job matches:");
  for (const s of rankJobs(model, data.jobs).slice(0, 8)) {
    console.log(`     ${s.score.toFixed(2).padStart(6)}  ${s.job.title}`);
  }
  console.log();
}

console.log(`\njayobee — ${data.jobs.length} jobs, ${data.axes.length} taste axes`);
console.log("Which appeals to you more? Type 1 or 2.");
console.log("Commands: s=skip  r=results  q=quit\n");

let round = 0;
while (true) {
  round++;
  // warm up with random pairs, then switch to active learning
  const [a, b] =
    round <= 5 ? randomPair(data.jobs, rand) : mostUncertainPair(model, data.jobs, rand);

  const ans = (await rl.question(`(${round})  [1] ${a.title}\n     [2] ${b.title}\n  > `))
    .trim()
    .toLowerCase();

  if (ans === "q") break;
  if (ans === "s") continue;
  if (ans === "r") {
    showResults();
    round--;
    continue;
  }
  if (ans === "1") model.observe(a.v, b.v);
  else if (ans === "2") model.observe(b.v, a.v);
  else {
    console.log("  (didn't understand — 1, 2, s, r, or q)");
    round--;
  }
}

showResults();
rl.close();

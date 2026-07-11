import { useState } from "react";
import { confidenceTier, type AxisStat, type MatchReason } from "@engine/engine";
import type { Job } from "@engine/types";
import type { GameResults } from "../usePreferenceGame";
import { jobByCode } from "../data";
import { JobDetail } from "./JobDetail";

const usd = (n?: number | null) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US");

interface Props {
  count: number;
  results: GameResults;
  explainJob: (job: Job) => { reasons: MatchReason[]; tradeoffs: MatchReason[] };
  onKeepPlaying: () => void;
  onReset: () => void;
}

function Chip({ stat, kind }: { stat: AxisStat; kind: "like" | "dislike" }) {
  const tier = confidenceTier(stat.z);
  return (
    <span
      className={`chip chip-${kind} conf-${tier}`}
      title={`${stat.block} · confidence: ${tier}`}
    >
      {stat.axis}
    </span>
  );
}

export function Results({ count, results, explainJob, onKeepPlaying, onReset }: Props) {
  const { likes, dislikes, stability, top } = results;
  const pct = Math.round(stability * 100);
  const settled = pct >= 60;

  const [selected, setSelected] = useState<Job | null>(null);
  const [sort, setSort] = useState<"fit" | "pay">("fit");
  const hasWages = top.some((s) => s.job.wage);
  const shown =
    sort === "pay"
      ? [...top].sort((a, b) => (b.job.wage?.median ?? -1) - (a.job.wage?.median ?? -1))
      : top;

  return (
    <div className="results">
      <h2>Your preferences</h2>

      <div className="stability">
        <div className="stability-head">
          <span>Profile {settled ? "settled" : "still forming"}</span>
          <span className="muted">{pct}%</span>
        </div>
        <div className="meter">
          <div className="meter-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="muted stability-note">
          {settled
            ? `Learned from ${count} choices. Faded tags are still firming up.`
            : `Learned from ${count} choices — keep playing to lock these in.`}
        </p>
      </div>

      <section>
        <h3>You're drawn to</h3>
        <div className="chips">
          {likes.length === 0 && <span className="muted">Not enough signal yet.</span>}
          {likes.map((s) => (
            <Chip key={s.axis} stat={s} kind="like" />
          ))}
        </div>
      </section>

      <section>
        <h3>And away from</h3>
        <div className="chips">
          {dislikes.length === 0 && <span className="muted">Not enough signal yet.</span>}
          {dislikes.map((s) => (
            <Chip key={s.axis} stat={s} kind="dislike" />
          ))}
        </div>
      </section>

      <section>
        <div className="matches-head">
          <h3>Careers that fit</h3>
          {hasWages && (
            <div className="sort-toggle" role="group" aria-label="Sort matches">
              <button
                className={sort === "fit" ? "on" : ""}
                onClick={() => setSort("fit")}
                type="button"
              >
                Best fit
              </button>
              <button
                className={sort === "pay" ? "on" : ""}
                onClick={() => setSort("pay")}
                type="button"
              >
                Top pay
              </button>
            </div>
          )}
        </div>
        <ul className="matches">
          {shown.map((s) => (
            <li key={s.job.code}>
              <button className="match-row" onClick={() => setSelected(s.job)} type="button">
                <span className="match-title">{s.job.title}</span>
                <span className="match-right">
                  {hasWages && (
                    <span className="match-wage" title="Median annual wage (BLS OEWS 2025)">
                      {usd(s.job.wage?.median)}
                    </span>
                  )}
                  <span className="match-chevron" aria-hidden="true">
                    ›
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="actions">
        <button className="btn btn-primary" onClick={onKeepPlaying} type="button">
          Keep playing
        </button>
        <button className="btn btn-ghost" onClick={onReset} type="button">
          Start over
        </button>
      </div>

      {selected && (
        <JobDetail
          job={selected}
          explanation={explainJob(selected)}
          onClose={() => setSelected(null)}
          onOpenRelated={(code) => {
            const j = jobByCode.get(code);
            if (j) setSelected(j);
          }}
        />
      )}
    </div>
  );
}

import type { Job } from "@engine/types";
import type { MatchReason } from "@engine/engine";

const usd = (n?: number | null) =>
  n == null ? null : "$" + Math.round(n).toLocaleString("en-US");

function reasonLabel(r: MatchReason) {
  return `${r.level === "high" ? "High" : "Low"} ${r.axis}`;
}

interface Props {
  job: Job;
  /** optional — Explore mode has no preference model, so it's omitted there */
  explanation?: { reasons: MatchReason[]; tradeoffs: MatchReason[] };
  onOpenRelated: (code: string) => void;
}

/** The shared body describing one occupation. Used inline in Explore and inside the detail sheet. */
export function JobInfo({ job, explanation, onOpenRelated }: Props) {
  const median = usd(job.wage?.median);
  const p10 = usd(job.wage?.p10);
  const p90 = usd(job.wage?.p90);
  const reasons = explanation?.reasons ?? [];
  const tradeoffs = explanation?.tradeoffs ?? [];

  return (
    <>
      <h2 className="jobinfo-title">{job.title}</h2>

      <p className="job-desc-full">{job.desc}</p>

      {job.imputed && (
        <p className="imputed-note">
          ⓘ Estimated profile — O*NET hasn't rated this occupation yet, so its fit is
          inferred from closely related careers.
        </p>
      )}

      {median && (
        <div className="detail-block">
          <div className="pay-median">{median}</div>
          <div className="muted">
            median annual wage
            {p10 && p90 ? ` · ${p10}–${p90} range` : ""} · source: U.S. BLS
          </div>
        </div>
      )}

      {reasons.length > 0 && (
        <div className="detail-block">
          <h3>Why it fits you</h3>
          <div className="chips">
            {reasons.map((r) => (
              <span key={r.axis} className="chip chip-like" title={r.block}>
                {reasonLabel(r)}
              </span>
            ))}
          </div>
          {tradeoffs.length > 0 && (
            <p className="muted tradeoff">
              Trade-off: {tradeoffs.map(reasonLabel).join(" · ")}
            </p>
          )}
        </div>
      )}

      {job.jobZone && (
        <div className="detail-block">
          <h3>Preparation</h3>
          <div className="match-title">{job.jobZone.name}</div>
          <p className="muted">{job.jobZone.education}</p>
        </div>
      )}

      {job.tasks && job.tasks.length > 0 && (
        <div className="detail-block">
          <h3>What you'd do</h3>
          <ul className="tasks">
            {job.tasks.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {job.related && job.related.length > 0 && (
        <div className="detail-block">
          <h3>Related careers</h3>
          <div className="chips">
            {job.related.map((r) => (
              <button
                key={r.code}
                className="chip chip-related"
                onClick={() => onOpenRelated(r.code)}
                type="button"
              >
                {r.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

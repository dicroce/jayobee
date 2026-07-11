import type { Job } from "@engine/types";
import type { MatchReason } from "@engine/engine";

const usd = (n?: number | null) =>
  n == null ? null : "$" + Math.round(n).toLocaleString("en-US");

interface Props {
  job: Job;
  explanation: { reasons: MatchReason[]; tradeoffs: MatchReason[] };
  onClose: () => void;
  onOpenRelated: (code: string) => void;
}

function reasonLabel(r: MatchReason) {
  return `${r.level === "high" ? "High" : "Low"} ${r.axis}`;
}

export function JobDetail({ job, explanation, onClose, onOpenRelated }: Props) {
  const { reasons, tradeoffs } = explanation;
  const median = usd(job.wage?.median);
  const p10 = usd(job.wage?.p10);
  const p90 = usd(job.wage?.p90);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{job.title}</h2>
          <button className="sheet-close" onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>

        <p className="job-desc-full">{job.desc}</p>

        {median && (
          <div className="detail-block">
            <div className="pay-median">{median}</div>
            <div className="muted">
              median annual wage
              {p10 && p90 ? ` · ${p10}–${p90} range` : ""}
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
      </div>
    </div>
  );
}

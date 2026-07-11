import { useMemo, useState } from "react";
import { stepAlongAxis } from "@engine/engine";
import type { Job } from "@engine/types";
import { dataset, jobByCode } from "../data";
import { JobInfo } from "./JobInfo";

interface Crumb {
  job: Job;
  via: string | null;
}

const randomJob = () => dataset.jobs[Math.floor(Math.random() * dataset.jobs.length)];

// axis indices grouped by block, for the direction controls
const AXES_BY_BLOCK = (() => {
  const g: Record<string, { name: string; idx: number }[]> = {
    interest: [],
    value: [],
    style: [],
  };
  dataset.axes.forEach((a, i) => g[a.block]?.push({ name: a.name, idx: i }));
  return g;
})();

export function Explore({ onHome }: { onHome: () => void }) {
  const [trail, setTrail] = useState<Crumb[]>(() => [{ job: randomJob(), via: null }]);
  const [showMore, setShowMore] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const current = trail[trail.length - 1].job;

  const profile = useMemo(() => {
    const p = dataset.axes
      .map((a, i) => ({ name: a.name, v: current.v[i] }))
      .sort((x, y) => y.v - x.v);
    return {
      highs: p.slice(0, 2).filter((x) => x.v > 0),
      lows: p.slice(-2).filter((x) => x.v < 0).reverse(),
    };
  }, [current]);

  const step = (idx: number, dir: 1 | -1, name: string) => {
    const cands = stepAlongAxis(current, idx, dir, dataset.jobs, { count: 1 });
    if (!cands.length) {
      setNote(
        `${current.title} is already at the ${dir > 0 ? "most" : "least"} ${name} end here — try another direction.`,
      );
      return;
    }
    setNote(null);
    setTrail([...trail, { job: cands[0].job, via: `${dir > 0 ? "+" : "−"}${name}` }]);
  };

  const jumpTo = (i: number) => {
    setNote(null);
    setTrail(trail.slice(0, i + 1));
  };

  const openRelated = (code: string) => {
    const j = jobByCode.get(code);
    if (j) {
      setNote(null);
      setTrail([...trail, { job: j, via: "related" }]);
    }
  };

  const dirRow = ({ name, idx }: { name: string; idx: number }) => (
    <div className="dir-row" key={idx}>
      <span className="dir-name">{name}</span>
      <div className="dir-btns">
        <button onClick={() => step(idx, -1, name)} type="button">
          less
        </button>
        <button onClick={() => step(idx, 1, name)} type="button">
          more
        </button>
      </div>
    </div>
  );

  return (
    <div className="app">
      <header className="topbar">
        <button className="back-btn" onClick={onHome} type="button">
          ‹ Menu
        </button>
        <button
          className="reset-btn"
          onClick={() => {
            setNote(null);
            setTrail([{ job: randomJob(), via: null }]);
          }}
          type="button"
        >
          🎲 New start
        </button>
      </header>

      <main className="explore">
        {trail.length > 1 && (
          <div className="trail">
            {trail.map((c, i) => (
              <span key={i} className="trail-item">
                {c.via && <span className="trail-via">{c.via}</span>}
                <button className="trail-job" onClick={() => jumpTo(i)} type="button">
                  {c.job.title}
                </button>
                {i < trail.length - 1 && <span className="trail-arrow">→</span>}
              </span>
            ))}
          </div>
        )}

        <div className="explore-profile">
          {profile.highs.map((h) => (
            <span key={h.name} className="chip chip-like">
              High {h.name}
            </span>
          ))}
          {profile.lows.map((l) => (
            <span key={l.name} className="chip chip-dislike">
              Low {l.name}
            </span>
          ))}
        </div>

        <div className="explore-card">
          <JobInfo job={current} onOpenRelated={openRelated} />
        </div>

        <div className="directions">
          <h3>Walk toward…</h3>
          {note && <p className="muted dir-note">{note}</p>}
          <div className="dir-group">{AXES_BY_BLOCK.interest.map(dirRow)}</div>

          <button
            className="btn btn-ghost dir-toggle"
            onClick={() => setShowMore((s) => !s)}
            type="button"
          >
            {showMore ? "Fewer directions" : "More directions (values & styles)"}
          </button>

          {showMore && (
            <>
              <div className="dir-group">{AXES_BY_BLOCK.value.map(dirRow)}</div>
              <div className="dir-group">{AXES_BY_BLOCK.style.map(dirRow)}</div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

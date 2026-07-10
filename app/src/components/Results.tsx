import { confidenceTier, type AxisStat } from "@engine/engine";
import type { GameResults } from "../usePreferenceGame";

interface Props {
  count: number;
  results: GameResults;
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

export function Results({ count, results, onKeepPlaying, onReset }: Props) {
  const { likes, dislikes, stability, top } = results;
  const pct = Math.round(stability * 100);
  const settled = pct >= 60;

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
        <h3>Careers that fit</h3>
        <ol className="matches">
          {top.map((s) => (
            <li key={s.job.code}>
              <span className="match-title">{s.job.title}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="actions">
        <button className="btn btn-primary" onClick={onKeepPlaying} type="button">
          Keep playing
        </button>
        <button className="btn btn-ghost" onClick={onReset} type="button">
          Start over
        </button>
      </div>
    </div>
  );
}

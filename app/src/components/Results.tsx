import type { GameResults } from "../usePreferenceGame";

interface Props {
  count: number;
  results: GameResults;
  onKeepPlaying: () => void;
  onReset: () => void;
}

export function Results({ count, results, onKeepPlaying, onReset }: Props) {
  const { likes, dislikes, top } = results;

  return (
    <div className="results">
      <h2>Your preferences</h2>
      <p className="muted">
        Learned from {count} choice{count === 1 ? "" : "s"}
        {count < 15 ? " — keep going for a sharper read." : "."}
      </p>

      <section>
        <h3>You're drawn to</h3>
        <div className="chips">
          {likes.length === 0 && <span className="muted">Not enough signal yet.</span>}
          {likes.map((l) => (
            <span key={l.axis} className="chip chip-like" title={l.block}>
              {l.axis}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3>And away from</h3>
        <div className="chips">
          {dislikes.length === 0 && <span className="muted">Not enough signal yet.</span>}
          {dislikes.map((l) => (
            <span key={l.axis} className="chip chip-dislike" title={l.block}>
              {l.axis}
            </span>
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

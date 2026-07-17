import { useMemo, useState } from "react";
import { JobCard } from "./JobCard";
import { Results } from "./Results";
import { JobDetail } from "./JobDetail";
import { usePreferenceGame } from "../usePreferenceGame";
import { jobByCode } from "../data";
import { useBackHandler } from "../backNav";
import type { Job } from "@engine/types";

type View = "intro" | "play" | "results";

export function Discover({ onHome }: { onHome: () => void }) {
  const game = usePreferenceGame();
  const [view, setView] = useState<View>("intro");
  const [detailJob, setDetailJob] = useState<Job | null>(null);

  const results = useMemo(
    () => (view === "results" ? game.results() : null),
    [view, game],
  );

  // hardware back: close the sheet, else step back a view, else leave to Home
  useBackHandler(() => {
    if (detailJob) {
      setDetailJob(null);
      return true;
    }
    if (view === "results") {
      setView("play");
      return true;
    }
    onHome();
    return true;
  }, [detailJob, view, onHome]);

  const [a, b] = game.pair;

  const handleReset = () => {
    if (
      game.count === 0 ||
      window.confirm("Start over? This clears your current preferences.")
    ) {
      game.reset();
      setView("play");
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="back-btn" onClick={onHome} type="button">
          ‹ Menu
        </button>
        <div className="topbar-right">
          <span className="count">{game.count} choices</span>
          <button
            className="reset-btn"
            onClick={handleReset}
            type="button"
            disabled={game.count === 0}
          >
            Reset
          </button>
        </div>
      </header>

      {view === "intro" ? (
        <main className="intro">
          <h2>How it works</h2>
          <p className="intro-lead">
            You'll see two jobs at a time. Pick the one you'd rather do — that's the
            whole game.
          </p>
          <ul className="intro-points">
            <li>
              <span className="intro-emoji">📈</span>
              <span>The more choices you make, the sharper your results get.</span>
            </li>
            <li>
              <span className="intro-emoji">🎯</span>
              <span>
                Aim for at least <strong>40 choices</strong> before your results get
                really good.
              </span>
            </li>
            <li>
              <span className="intro-emoji">🤷</span>
              <span>
                Hate both? Skim the descriptions and pick the one you hate <em>least</em>.
              </span>
            </li>
            <li>
              <span className="intro-emoji">⚡</span>
              <span>Don't get bogged down. Go, go, go!</span>
            </li>
          </ul>
          <button
            className="btn btn-primary intro-start"
            onClick={() => setView("play")}
            type="button"
          >
            {game.count > 0 ? "Keep playing" : "Start"}
          </button>
        </main>
      ) : view === "play" ? (
        <main className="play">
          <p className="prompt">Which would you rather do?</p>

          <div className="cards">
            <JobCard job={a} onPick={() => game.choose(0)} />
            <div className="vs">or</div>
            <JobCard job={b} onPick={() => game.choose(1)} />
          </div>

          <div className="playbar">
            <button className="btn btn-ghost" onClick={game.skip} type="button">
              Skip
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setView("results")}
              type="button"
            >
              See my results
            </button>
          </div>
        </main>
      ) : (
        <main className="results-wrap">
          {results && (
            <Results
              count={game.count}
              results={results}
              matches={game.matches}
              onOpenJob={setDetailJob}
              onKeepPlaying={() => setView("play")}
              onReset={() => {
                game.reset();
                setView("play");
              }}
            />
          )}
        </main>
      )}

      {detailJob && (
        <JobDetail
          job={detailJob}
          explanation={game.explainJob(detailJob)}
          onClose={() => setDetailJob(null)}
          onOpenRelated={(code) => {
            const j = jobByCode.get(code);
            if (j) setDetailJob(j);
          }}
        />
      )}
    </div>
  );
}

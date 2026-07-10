import { useMemo, useState } from "react";
import { JobCard } from "./components/JobCard";
import { Results } from "./components/Results";
import { usePreferenceGame } from "./usePreferenceGame";

type View = "play" | "results";

export function App() {
  const game = usePreferenceGame();
  const [view, setView] = useState<View>("play");

  // recompute results only when viewing them
  const results = useMemo(
    () => (view === "results" ? game.results() : null),
    [view, game],
  );

  const [a, b] = game.pair;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">jayobee</div>
        <div className="count">{game.count} choices</div>
      </header>

      {view === "play" ? (
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
              onKeepPlaying={() => setView("play")}
              onReset={() => {
                game.reset();
                setView("play");
              }}
            />
          )}
        </main>
      )}
    </div>
  );
}

type Activity = "discover" | "explore";

export function Home({ onPick }: { onPick: (a: Activity) => void }) {
  return (
    <div className="app home">
      <header className="home-head">
        <div className="brand-lg">jayobee</div>
        <p className="muted">Find work that fits — and explore what's out there.</p>
      </header>

      <div className="activities">
        <button className="activity" onClick={() => onPick("discover")} type="button">
          <span className="activity-emoji">🧭</span>
          <span className="activity-title">Discover</span>
          <span className="activity-desc">
            Pick between jobs and let the game surface the preferences you didn't know
            you had.
          </span>
        </button>

        <button className="activity" onClick={() => onPick("explore")} type="button">
          <span className="activity-emoji">🗺️</span>
          <span className="activity-title">Explore</span>
          <span className="activity-desc">
            Start on any job and walk the map of careers one trait at a time — more
            artistic, less social, more hands-on.
          </span>
        </button>
      </div>

      <footer className="home-footer">
        <p>
          Career data from{" "}
          <a href="https://www.onetcenter.org" target="_blank" rel="noopener noreferrer">
            O*NET
          </a>{" "}
          (sponsored by the U.S. Department of Labor) and the{" "}
          <a href="https://www.bls.gov/oes/" target="_blank" rel="noopener noreferrer">
            U.S. Bureau of Labor Statistics
          </a>
          .
        </p>
        <p>
          jayobee is an independent app and is not affiliated with, endorsed by, or
          representing any government agency.
        </p>
      </footer>
    </div>
  );
}

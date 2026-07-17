import { useState } from "react";
import { Home } from "./components/Home";
import { Discover } from "./components/Discover";
import { Explore } from "./components/Explore";
import { BackButtonProvider } from "./backNav";

type Screen = "home" | "discover" | "explore";

export function App() {
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <BackButtonProvider>
      {screen === "discover" ? (
        <Discover onHome={() => setScreen("home")} />
      ) : screen === "explore" ? (
        <Explore onHome={() => setScreen("home")} />
      ) : (
        <Home onPick={setScreen} />
      )}
    </BackButtonProvider>
  );
}

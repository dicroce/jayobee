import { useState } from "react";
import { Home } from "./components/Home";
import { Discover } from "./components/Discover";
import { Explore } from "./components/Explore";

type Screen = "home" | "discover" | "explore";

export function App() {
  const [screen, setScreen] = useState<Screen>("home");

  if (screen === "discover") return <Discover onHome={() => setScreen("home")} />;
  if (screen === "explore") return <Explore onHome={() => setScreen("home")} />;
  return <Home onPick={setScreen} />;
}

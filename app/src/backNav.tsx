import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { App as CapApp } from "@capacitor/app";

/**
 * Android hardware back-button routing. The app navigates via React state (not
 * browser history), so without this the OS back button would exit the app from
 * any screen. We register ONE native listener and delegate to the active screen's
 * handler; if it returns false (or there's none, i.e. we're on Home), we exit.
 *
 * Only one activity is mounted at a time, so a single handler slot is enough.
 * A handler returns true when it consumed the press (navigated internally).
 */
type BackHandler = () => boolean;

const BackCtx = createContext<(h: BackHandler | null) => void>(() => {});

export function BackButtonProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<BackHandler | null>(null);
  const setHandler = (h: BackHandler | null) => {
    handlerRef.current = h;
  };

  useEffect(() => {
    let remove: (() => void) | undefined;
    CapApp.addListener("backButton", () => {
      const handled = handlerRef.current?.();
      if (!handled) CapApp.exitApp();
    }).then((sub) => {
      remove = () => sub.remove();
    });
    return () => remove?.();
  }, []);

  return <BackCtx.Provider value={setHandler}>{children}</BackCtx.Provider>;
}

/** Register the active screen's back handler. Re-registers when `deps` change so it sees fresh state. */
export function useBackHandler(handler: BackHandler, deps: unknown[]) {
  const setHandler = useContext(BackCtx);
  useEffect(() => {
    setHandler(handler);
    return () => setHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

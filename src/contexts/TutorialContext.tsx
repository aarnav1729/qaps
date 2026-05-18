import React, { createContext, useContext, useEffect, useState } from "react";

interface TutorialContextValue {
  tutorialMode: boolean;
  setTutorialMode: (enabled: boolean) => void;
}

const TutorialContext = createContext<TutorialContextValue>({
  tutorialMode: true,
  setTutorialMode: () => {},
});

const STORAGE_KEY = "global-tutorial-mode";

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tutorialMode, setTutorialModeState] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) setTutorialModeState(raw === "true");
    } catch {}
  }, []);

  const setTutorialMode = (next: boolean) => {
    setTutorialModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {}
  };

  return (
    <TutorialContext.Provider value={{ tutorialMode, setTutorialMode }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorialContext = () => useContext(TutorialContext);

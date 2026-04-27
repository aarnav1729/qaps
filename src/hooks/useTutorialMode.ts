import { useEffect, useState } from "react";

export const useTutorialMode = (
  storageKey: string,
  defaultValue = true
) => {
  const [enabled, setEnabled] = useState<boolean>(defaultValue);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) {
        setEnabled(defaultValue);
        return;
      }
      setEnabled(raw === "true");
    } catch {
      setEnabled(defaultValue);
    }
  }, [defaultValue, storageKey]);

  const updateEnabled = (next: boolean) => {
    setEnabled(next);
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      // ignore storage failures and still update in-memory state
    }
  };

  return [enabled, updateEnabled] as const;
};

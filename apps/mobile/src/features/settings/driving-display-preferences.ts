import { useCallback, useEffect, useState } from "react";
import { mobileStorage } from "../../lib/storage/mobile-storage";

export type DrivingDisplayPreferences = {
  keepScreenOnWhileDriving: boolean;
};

const drivingDisplayPreferencesKey = "gigeze.mobile.preferences.driving-display";

export const defaultDrivingDisplayPreferences: DrivingDisplayPreferences = {
  keepScreenOnWhileDriving: true,
};

function normalizeDrivingDisplayPreferences(value: unknown): DrivingDisplayPreferences {
  if (!value || typeof value !== "object") {
    return defaultDrivingDisplayPreferences;
  }

  const preferences = value as Partial<DrivingDisplayPreferences>;
  return {
    keepScreenOnWhileDriving:
      typeof preferences.keepScreenOnWhileDriving === "boolean"
        ? preferences.keepScreenOnWhileDriving
        : defaultDrivingDisplayPreferences.keepScreenOnWhileDriving,
  };
}

export async function loadDrivingDisplayPreferences() {
  const rawPreferences = await mobileStorage.getItem(drivingDisplayPreferencesKey);
  if (!rawPreferences) {
    return defaultDrivingDisplayPreferences;
  }

  try {
    return normalizeDrivingDisplayPreferences(JSON.parse(rawPreferences) as unknown);
  } catch {
    return defaultDrivingDisplayPreferences;
  }
}

export async function saveDrivingDisplayPreferences(preferences: DrivingDisplayPreferences) {
  const normalizedPreferences = normalizeDrivingDisplayPreferences(preferences);
  await mobileStorage.setItem(drivingDisplayPreferencesKey, JSON.stringify(normalizedPreferences));
  return normalizedPreferences;
}

export function useDrivingDisplayPreferences() {
  const [preferences, setPreferences] = useState<DrivingDisplayPreferences>(defaultDrivingDisplayPreferences);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      const storedPreferences = await loadDrivingDisplayPreferences();
      if (!cancelled) {
        setPreferences(storedPreferences);
        setLoaded(true);
      }
    }

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  const setKeepScreenOnWhileDriving = useCallback(async (keepScreenOnWhileDriving: boolean) => {
    const nextPreferences = await saveDrivingDisplayPreferences({
      ...preferences,
      keepScreenOnWhileDriving,
    });
    setPreferences(nextPreferences);
    return nextPreferences;
  }, [preferences]);

  return {
    preferences,
    loaded,
    setKeepScreenOnWhileDriving,
  };
}

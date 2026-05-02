import { mobileStorage } from "../../../lib/storage/mobile-storage";
import type { TrackingDiagnostics } from "./types";

export type TrackingSessionMetadata = {
  sessionId: string;
  startedAt: string;
  samplingIntervalSeconds: number;
  lifecycleOwner: TrackingDiagnostics["lifecycleOwner"];
  continuityMode: TrackingDiagnostics["continuityMode"];
  lastDrainAt?: string;
  lastImportAt?: string;
};

const trackingSessionKey = "gigeze.mobile.tracking.active-session";

export const trackingSessionStorage = {
  async getActiveSession() {
    const raw = await mobileStorage.getItem(trackingSessionKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<TrackingSessionMetadata>;
      if (!parsed.sessionId || !parsed.startedAt) {
        return null;
      }

      return parsed as TrackingSessionMetadata;
    } catch {
      return null;
    }
  },
  async saveActiveSession(session: TrackingSessionMetadata) {
    await mobileStorage.setItem(trackingSessionKey, JSON.stringify(session));
  },
  async clearActiveSession() {
    await mobileStorage.removeItem(trackingSessionKey);
  },
};

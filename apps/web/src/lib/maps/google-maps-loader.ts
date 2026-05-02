let googleMapsLoadPromise: Promise<void> | null = null;
let googleMapsAuthErrorMessage: string | null = null;

function getGoogleMapsScriptUrl(apiKey: string) {
  const params = new URLSearchParams({
    key: apiKey,
    v: "weekly",
    loading: "async",
  });

  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

async function ensureGoogleMapsConstructors() {
  const mapsNamespace = window.google?.maps as
    | {
        Map?: unknown;
        Polyline?: unknown;
        LatLngBounds?: unknown;
        importLibrary?: (name: string) => Promise<unknown>;
      }
    | undefined;

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const hasCoreConstructors = () =>
    typeof mapsNamespace?.Map === "function"
    && typeof mapsNamespace?.Polyline === "function"
    && typeof mapsNamespace?.LatLngBounds === "function";

  if (!mapsNamespace) {
    throw new Error("Google Maps script loaded, but Maps API is unavailable.");
  }

  if (hasCoreConstructors()) {
    return;
  }

  if (typeof mapsNamespace.importLibrary === "function") {
    const mapsLibrary = (await mapsNamespace.importLibrary("maps")) as {
      Map?: unknown;
      Polyline?: unknown;
      LatLngBounds?: unknown;
    };

    if (mapsLibrary.Map && typeof mapsNamespace.Map !== "function") {
      mapsNamespace.Map = mapsLibrary.Map;
    }

    if (mapsLibrary.Polyline && typeof mapsNamespace.Polyline !== "function") {
      mapsNamespace.Polyline = mapsLibrary.Polyline;
    }

    if (mapsLibrary.LatLngBounds && typeof mapsNamespace.LatLngBounds !== "function") {
      mapsNamespace.LatLngBounds = mapsLibrary.LatLngBounds;
    }

    await mapsNamespace.importLibrary("marker").catch(() => undefined);
  }

  // Google can briefly lag in exposing constructors after script load on first render.
  for (let attempt = 0; attempt < 8 && !hasCoreConstructors(); attempt += 1) {
    await wait(40);
  }

  if (typeof mapsNamespace.Map !== "function") {
    throw new Error("Google Maps loaded, but Map constructor is unavailable.");
  }

  if (typeof mapsNamespace.Polyline !== "function" || typeof mapsNamespace.LatLngBounds !== "function") {
    throw new Error("Google Maps loaded, but required map constructors are unavailable.");
  }
}

export function loadGoogleMapsApi(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only be loaded in the browser."));
  }

  if (window.google?.maps) {
    return ensureGoogleMapsConstructors();
  }

  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  googleMapsLoadPromise = new Promise<void>((resolve, reject) => {
    const settleError = (message: string) => {
      googleMapsLoadPromise = null;
      reject(new Error(message));
    };

    const authFailureHandler = () => {
      const allowedReferrer = `${window.location.origin}/*`;
      googleMapsAuthErrorMessage = `Google Maps authentication failed. Add ${allowedReferrer} to this API key's allowed HTTP referrers in Google Cloud.`;
      settleError(googleMapsAuthErrorMessage);
    };

    window.gm_authFailure = authFailureHandler;

    const existingScript = document.getElementById("google-maps-js") as HTMLScriptElement | null;

    if (existingScript) {
      if (window.google?.maps) {
        ensureGoogleMapsConstructors().then(resolve).catch((error: unknown) => {
          settleError(error instanceof Error ? error.message : "Failed to initialize Google Maps.");
        });
        return;
      }

      existingScript.addEventListener("load", () => {
        ensureGoogleMapsConstructors().then(resolve).catch((error: unknown) => {
          settleError(error instanceof Error ? error.message : "Failed to initialize Google Maps.");
        });
      }, { once: true });
      existingScript.addEventListener("error", () => settleError("Failed to load Google Maps script."), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-js";
    script.async = true;
    script.defer = true;
    script.src = getGoogleMapsScriptUrl(apiKey);

    script.addEventListener("load", () => {
      if (googleMapsAuthErrorMessage) {
        settleError(googleMapsAuthErrorMessage);
        return;
      }

      ensureGoogleMapsConstructors().then(resolve).catch((error: unknown) => {
        settleError(error instanceof Error ? error.message : "Failed to initialize Google Maps.");
      });
    });

    script.addEventListener("error", () => settleError("Failed to load Google Maps script."));

    document.head.appendChild(script);
  });

  return googleMapsLoadPromise.finally(() => {
    if (window.google?.maps) {
      window.gm_authFailure = undefined;
      googleMapsAuthErrorMessage = null;
    }
  });
}

declare global {
  interface Window {
    google?: {
      maps?: unknown;
    };
    gm_authFailure?: () => void;
  }
}

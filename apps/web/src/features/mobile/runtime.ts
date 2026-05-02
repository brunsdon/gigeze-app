export type MobileRuntimeMode = "web" | "non-browser";

export type MobileRuntime = {
  mode: MobileRuntimeMode;
  isBrowser: boolean;
  isNativeShell: false;
  platform: "web" | "server";
};

export function detectMobileRuntime(): MobileRuntime {
  const isBrowser = typeof window !== "undefined";

  return {
    mode: isBrowser ? "web" : "non-browser",
    isBrowser,
    isNativeShell: false,
    platform: isBrowser ? "web" : "server",
  };
}

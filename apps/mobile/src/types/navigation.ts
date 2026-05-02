export type AuthRouteName = "welcome";
export type MainRouteName =
  | "home"
  | "liveTrip"
  | "tripHistory"
  | "tripDetail"
  | "settingsDebug"
  | "diagnostics"
  | "vehicles"
  | "vehicleForm"
  | "Tours"
  | "journeyForm";

export type RootRouteName = AuthRouteName | MainRouteName;

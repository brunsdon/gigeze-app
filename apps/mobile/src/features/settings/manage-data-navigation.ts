import type { MainRouteName } from "../../types/navigation";

export type ManageDataNavigationItem = {
  label: string;
  description: string;
  routeName: Extract<MainRouteName, "vehicles" | "Tours">;
};

export const manageDataNavigationItems: ManageDataNavigationItem[] = [
  {
    label: "Vehicles",
    description: "Set default vehicles, odometers, and personal/business defaults.",
    routeName: "vehicles",
  },
  {
    label: "Tours",
    description: "Organise trips by Tour and date range.",
    routeName: "Tours",
  },
];

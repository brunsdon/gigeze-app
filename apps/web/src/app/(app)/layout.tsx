import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { listJourneys } from "@/features/tours/service";
import { AppNav } from "@/components/layout/app-nav";
import { ActivityTracker } from "@/components/layout/activity-tracker";
import { QuickAddMenu } from "@/components/layout/quick-add-menu";
import { TrustIndicators } from "@/components/layout/trust-indicators";
import { getLatestOdometerForVehicle, listVehicles } from "@/features/vehicles/service";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const workspace = await requireCurrentWorkspace();
  const [Tours, vehicles] = await Promise.all([
    listJourneys(workspace.id),
    listVehicles(workspace.id),
  ]);

  const quickAddJourneys = Tours.map((Tour) => ({
    id: Tour.id,
    title: Tour.title,
    Gigs: Tour.Gigs.map((Gig) => ({
      id: Gig.id,
      title: Gig.title,
    })),
  }));

  const activeJourneyId = Tours.find((Tour) => Tour.status === "ACTIVE")?.id ?? Tours[0]?.id;
  const quickAddVehicles = vehicles.map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.name,
    isDefault: vehicle.isDefault,
  }));
  const defaultVehicle = vehicles.find((vehicle) => vehicle.isDefault) ?? vehicles[0];
  const vehicleOdometerEntries = await Promise.all(
    vehicles.map(async (vehicle) => [vehicle.id, await getLatestOdometerForVehicle(workspace.id, vehicle.id)] as const),
  );
  const quickAddVehicleOdometerMap = Object.fromEntries(vehicleOdometerEntries);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#08070A] bg-[radial-gradient(circle_at_18%_-8%,rgba(255,46,99,0.16),transparent_30%),radial-gradient(circle_at_90%_4%,rgba(255,176,0,0.1),transparent_24%),linear-gradient(180deg,#0B0B0F,#08070A_62%)] md:flex">
      <AppNav />
      <main className="w-full min-w-0 px-4 pt-5 pb-28 sm:px-6 md:py-6 lg:px-8">
        <ActivityTracker />
        <div className="mb-4 flex items-center justify-end gap-2">
          <TrustIndicators />
          <QuickAddMenu
            Tours={quickAddJourneys}
            vehicles={quickAddVehicles}
            vehicleOdometerMap={quickAddVehicleOdometerMap}
            defaultJourneyId={activeJourneyId}
            defaultVehicleId={defaultVehicle?.id}
            defaultStopVisibility={workspace.defaultJourneyVisibility}
            defaultMediaVisibility={workspace.defaultMediaVisibility}
            showDesktopStatusBadge={false}
          />
        </div>
        <div className="animate-page-enter space-y-6">{children}</div>
      </main>
    </div>
  );
}

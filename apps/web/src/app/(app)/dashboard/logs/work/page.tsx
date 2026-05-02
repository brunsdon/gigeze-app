import { redirect } from "next/navigation";

export default async function LegacyActivityRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ journeyId?: string; stopId?: string }>;
}) {
  const { journeyId, stopId } = await searchParams;
  const params = new URLSearchParams();
  if (journeyId) {
    params.set("journeyId", journeyId);
  }
  if (stopId) {
    params.set("stopId", stopId);
  }

  redirect(`/dashboard/activity${params.size ? `?${params.toString()}` : ""}`);
}

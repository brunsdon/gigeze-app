import { redirect } from "next/navigation";

export default async function UppercaseTourDetailPage({
  params,
}: {
  params: Promise<{ tourId: string }>;
}) {
  const { tourId } = await params;
  redirect(`/tours/${tourId}`);
}

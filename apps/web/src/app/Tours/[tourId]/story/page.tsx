import { redirect } from "next/navigation";

export default async function UppercaseTourStoryPage({
  params,
}: {
  params: Promise<{ tourId: string }>;
}) {
  const { tourId } = await params;
  redirect(`/tours/${tourId}/story`);
}

import { listPublicJourneys } from "@/features/tours/service";
import { type JourneyMapData, type MapMarker, type MapRoutePoint } from "@/types/maps";

type JourneyStopLike = {
  id: string;
  title: string;
  description?: string | null;
  latitude: unknown;
  longitude: unknown;
  locationName?: string | null;
  orderIndex: number;
};

type JourneyWithStopsLike = {
  id: string;
  title: string;
  slug: string;
  Gigs: JourneyStopLike[];
};

function toMapMarker(
  Gig: JourneyStopLike,
  Tour: JourneyWithStopsLike,
  includePublicJourneyHref: boolean,
  journeyHrefBase?: string,
  currentStopId?: string,
): MapMarker {
  const href = journeyHrefBase
    ? `${journeyHrefBase}/${Tour.slug}`
    : includePublicJourneyHref
      ? `/Tours/${Tour.slug}`
      : undefined;

  return {
    id: Gig.id,
    label: Gig.title,
    lat: Number(Gig.latitude),
    lng: Number(Gig.longitude),
    orderIndex: Gig.orderIndex,
    isCurrent: Gig.id === currentStopId,
    description: Gig.locationName ?? Gig.description,
    journeyId: Tour.id,
    journeyTitle: Tour.title,
    href,
  };
}

function toRoutePoint(Gig: JourneyStopLike): MapRoutePoint {
  return {
    id: Gig.id,
    lat: Number(Gig.latitude),
    lng: Number(Gig.longitude),
    orderIndex: Gig.orderIndex,
    label: Gig.title,
  };
}

export function mapJourneyToMapData(
  Tour: JourneyWithStopsLike,
  options?: { includePublicJourneyHref?: boolean; journeyHrefBase?: string },
): JourneyMapData {
  const includePublicJourneyHref = options?.includePublicJourneyHref ?? false;
  const journeyHrefBase = options?.journeyHrefBase;
  const orderedStops = [...Tour.Gigs].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentStopId = orderedStops.at(-1)?.id;

  return {
    journeyId: Tour.id,
    journeyTitle: Tour.title,
    journeySlug: Tour.slug,
    markers: orderedStops.map((Gig) => toMapMarker(Gig, Tour, includePublicJourneyHref, journeyHrefBase, currentStopId)),
    routePoints: orderedStops.map((Gig) => toRoutePoint(Gig)),
  };
}

export async function listPublicJourneyMapData() {
  const Tours = await listPublicJourneys();
  return Tours.map((Tour) => mapJourneyToMapData(Tour, { includePublicJourneyHref: true }));
}

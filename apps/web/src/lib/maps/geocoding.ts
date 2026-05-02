export type GpsCoordinate = {
  latitude: number;
  longitude: number;
};

type GoogleGeocodeAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  address_components?: GoogleGeocodeAddressComponent[];
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: GoogleGeocodeResult[];
};

function isValidCoordinate(sample: GpsCoordinate) {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    sample.longitude >= -180 &&
    sample.longitude <= 180
  );
}

export function getFirstAndLastValidGpsSamples(samples: GpsCoordinate[]) {
  const validSamples = samples.filter(isValidCoordinate);

  return {
    start: validSamples[0] ?? null,
    end: validSamples.at(-1) ?? null,
  };
}

function getGoogleMapsGeocodingKey() {
  return (
    process.env.GOOGLE_MAPS_GEOCODING_API_KEY ||
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  );
}

function pickAddressComponent(components: GoogleGeocodeAddressComponent[] | undefined, types: string[]) {
  return components?.find((component) => types.every((type) => component.types.includes(type)));
}

function hasDisplayLocality(result: GoogleGeocodeResult | undefined) {
  return Boolean(
    pickAddressComponent(result?.address_components, ["locality"]) ||
      pickAddressComponent(result?.address_components, ["postal_town"]) ||
      pickAddressComponent(result?.address_components, ["administrative_area_level_2"]) ||
      pickAddressComponent(result?.address_components, ["sublocality"]),
  );
}

export function formatGoogleGeocodeDisplayLocation(result: GoogleGeocodeResult | undefined) {
  if (!result) {
    return null;
  }

  const locality =
    pickAddressComponent(result.address_components, ["locality"]) ||
    pickAddressComponent(result.address_components, ["postal_town"]) ||
    pickAddressComponent(result.address_components, ["administrative_area_level_2"]) ||
    pickAddressComponent(result.address_components, ["sublocality"]);
  const state = pickAddressComponent(result.address_components, ["administrative_area_level_1"]);

  if (locality?.long_name && state?.short_name) {
    return `${locality.long_name} ${state.short_name}`;
  }

  return result.formatted_address?.trim() || null;
}

export function pickGoogleGeocodeDisplayLocation(results: GoogleGeocodeResult[] | undefined) {
  if (!results?.length) {
    return null;
  }

  return formatGoogleGeocodeDisplayLocation(results.find(hasDisplayLocality) ?? results[0]);
}

function warnReverseGeocodeSkipped(reason: string) {
  if (process.env.NODE_ENV !== "test") {
    console.warn(`[maps] Reverse geocoding skipped: ${reason}`);
  }
}

export async function reverseGeocodeDisplayLocation(coordinate: GpsCoordinate) {
  if (!isValidCoordinate(coordinate)) {
    return null;
  }

  const key = getGoogleMapsGeocodingKey();
  if (!key) {
    warnReverseGeocodeSkipped("no Google Maps geocoding key configured");
    return null;
  }

  try {
    const params = new URLSearchParams({
      latlng: `${coordinate.latitude},${coordinate.longitude}`,
      key,
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      warnReverseGeocodeSkipped(`Google returned HTTP ${response.status}`);
      return null;
    }

    const body = (await response.json().catch(() => null)) as GoogleGeocodeResponse | null;
    if (body?.status !== "OK") {
      warnReverseGeocodeSkipped(`Google returned status ${body?.status ?? "unknown"}`);
      return null;
    }

    const displayLocation = pickGoogleGeocodeDisplayLocation(body.results);
    if (!displayLocation) {
      warnReverseGeocodeSkipped("Google returned no displayable address");
    }

    return displayLocation;
  } catch (error) {
    warnReverseGeocodeSkipped(error instanceof Error ? error.message : "provider request failed");
    return null;
  }
}

export async function reverseGeocodeTripEndpoints(samples: GpsCoordinate[]) {
  const { start, end } = getFirstAndLastValidGpsSamples(samples);

  const [startLocation, endLocation] = await Promise.all([
    start ? reverseGeocodeDisplayLocation(start) : Promise.resolve(null),
    end ? reverseGeocodeDisplayLocation(end) : Promise.resolve(null),
  ]);

  return { startLocation, endLocation };
}

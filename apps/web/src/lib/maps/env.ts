const mapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const mapEnv = {
  googleMapsApiKey: mapApiKey ?? "",
};

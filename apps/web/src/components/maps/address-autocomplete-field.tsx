"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mapEnv } from "@/lib/maps/env";
import { loadGoogleMapsApi } from "@/lib/maps/google-maps-loader";

type AddressAutocompleteFieldProps = {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  helperText?: string;
  formattedAddressName: string;
  placeIdName: string;
  latitudeName: string;
  longitudeName: string;
  defaultFormattedAddress?: string | null;
  defaultPlaceId?: string | null;
  defaultLatitude?: number | string | { toString(): string } | null;
  defaultLongitude?: number | string | { toString(): string } | null;
};

type GooglePlaceResult = {
  formatted_address?: string;
  name?: string;
  place_id?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
};

type GooglePlacesLibrary = {
  Autocomplete: new (
    input: HTMLInputElement,
    options: {
      fields: string[];
      types?: string[];
    },
  ) => {
    addListener: (eventName: "place_changed", handler: () => void) => void;
    getPlace: () => GooglePlaceResult;
  };
};

function stringifyDefault(value: AddressAutocompleteFieldProps["defaultLatitude"]) {
  return value === null || value === undefined ? "" : value.toString();
}

async function loadPlacesLibrary() {
  await loadGoogleMapsApi(mapEnv.googleMapsApiKey);
  const maps = window.google?.maps as
    | {
        importLibrary?: (name: "places") => Promise<GooglePlacesLibrary>;
        places?: GooglePlacesLibrary;
      }
    | undefined;

  if (typeof maps?.importLibrary === "function") {
    return maps.importLibrary("places");
  }

  if (maps?.places?.Autocomplete) {
    return maps.places;
  }

  return null;
}

export function AddressAutocompleteField({
  label,
  name,
  defaultValue,
  placeholder,
  helperText,
  formattedAddressName,
  placeIdName,
  latitudeName,
  longitudeName,
  defaultFormattedAddress,
  defaultPlaceId,
  defaultLatitude,
  defaultLongitude,
}: AddressAutocompleteFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedDisplayValueRef = useRef(defaultFormattedAddress || defaultValue || "");
  const [value, setValue] = useState(defaultValue ?? "");
  const [formattedAddress, setFormattedAddress] = useState(defaultFormattedAddress ?? "");
  const [placeId, setPlaceId] = useState(defaultPlaceId ?? "");
  const [latitude, setLatitude] = useState(stringifyDefault(defaultLatitude));
  const [longitude, setLongitude] = useState(stringifyDefault(defaultLongitude));
  const [isAutocompleteReady, setIsAutocompleteReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!mapEnv.googleMapsApiKey || !inputRef.current) {
      return;
    }

    loadPlacesLibrary()
      .then((places) => {
        if (cancelled || !places?.Autocomplete || !inputRef.current) {
          return;
        }

        const autocomplete = new places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry.location", "name", "place_id"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const location = place.geometry?.location;

          if (!location || !place.place_id) {
            return;
          }

          const nextFormattedAddress = place.formatted_address?.trim() || place.name?.trim() || "";
          const nextDisplayValue = nextFormattedAddress || inputRef.current?.value || "";

          selectedDisplayValueRef.current = nextDisplayValue;
          setValue(nextDisplayValue);
          setFormattedAddress(nextFormattedAddress);
          setPlaceId(place.place_id);
          setLatitude(String(location.lat()));
          setLongitude(String(location.lng()));
        });

        setIsAutocompleteReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setIsAutocompleteReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        ref={inputRef}
        id={name}
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);

          if (nextValue !== selectedDisplayValueRef.current) {
            selectedDisplayValueRef.current = "";
            setFormattedAddress("");
            setPlaceId("");
            setLatitude("");
            setLongitude("");
          }
        }}
      />
      <input type="hidden" name={formattedAddressName} value={formattedAddress} />
      <input type="hidden" name={placeIdName} value={placeId} />
      <input type="hidden" name={latitudeName} value={latitude} />
      <input type="hidden" name={longitudeName} value={longitude} />
      {helperText ? (
        <p className="text-xs text-muted-foreground">
          {helperText}
          {!mapEnv.googleMapsApiKey || !isAutocompleteReady ? " Manual entry is available." : ""}
        </p>
      ) : null}
    </div>
  );
}

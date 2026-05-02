import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AddressAutocompleteField } from "@/components/maps/address-autocomplete-field";

describe("AddressAutocompleteField", () => {
  it("renders the visible location input and hidden geocode fields", () => {
    const html = renderToStaticMarkup(
      <AddressAutocompleteField
        label="Start location"
        name="startLocation"
        defaultValue="Coburg VIC"
        helperText="Use suburb/state or a recognisable place name."
        formattedAddressName="startFormattedAddress"
        placeIdName="startPlaceId"
        latitudeName="startLatitude"
        longitudeName="startLongitude"
        defaultFormattedAddress="Coburg VIC, Australia"
        defaultPlaceId="place-1"
        defaultLatitude="-37.743110"
        defaultLongitude="144.969830"
      />,
    );

    expect(html).toContain("Start location");
    expect(html).toContain('name="startLocation"');
    expect(html).toContain('name="startFormattedAddress"');
    expect(html).toContain('value="Coburg VIC, Australia"');
    expect(html).toContain('name="startPlaceId"');
    expect(html).toContain('value="place-1"');
    expect(html).toContain('name="startLatitude"');
    expect(html).toContain('value="-37.743110"');
    expect(html).toContain('name="startLongitude"');
    expect(html).toContain('value="144.969830"');
  });
});

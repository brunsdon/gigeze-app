import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OdometerInputs } from "./odometer-inputs";

describe("OdometerInputs", () => {
  it("uses Business use wording when split fields are shown", () => {
    const markup = renderToStaticMarkup(
      <OdometerInputs
        initialStartOdometer={10}
        initialEndOdometer={17}
        initialBusinessKm={0}
        initialPersonalKm={7}
        showBusinessSplit
      />,
    );

    expect(markup).toContain("Business use");
    expect(markup).toContain("Personal km");
  });
});

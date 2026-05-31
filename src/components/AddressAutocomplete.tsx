"use client";

import { useEffect, useRef, useState } from "react";
import { Field, Input } from "@/components/ui";

/**
 * Four address inputs (street/city/state/zip) wired to Google Places
 * Autocomplete on the street field. When the user selects a suggestion,
 * city/state/zip auto-fill. If the Maps script isn't loaded (no API key
 * set), this degrades to plain manual inputs — same UX, no errors.
 *
 * The Google Maps JS API loader lives in `src/app/layout.tsx`; this
 * component just consumes `window.google.maps.places.Autocomplete` when
 * it's present.
 */
export default function AddressAutocomplete({
  defaultStreet = "",
  defaultCity = "",
  defaultState = "",
  defaultZip = "",
}: {
  defaultStreet?: string;
  defaultCity?: string;
  defaultState?: string;
  defaultZip?: string;
}) {
  const [street, setStreet] = useState(defaultStreet);
  const [city, setCity] = useState(defaultCity);
  const [stateCode, setStateCode] = useState(defaultState);
  const [zip, setZip] = useState(defaultZip);

  const streetRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<unknown>(null);

  useEffect(() => {
    if (!streetRef.current) return;
    let cancelled = false;

    function attach() {
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (!g?.maps?.places?.Autocomplete) {
        // Poll once a second until the script finishes loading, then stop.
        const t = setTimeout(attach, 800);
        return () => clearTimeout(t);
      }
      const ac = new g.maps.places.Autocomplete(streetRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["address_components", "formatted_address"],
      });
      autocompleteRef.current = ac;
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const comps: { types: string[]; long_name: string; short_name: string }[] =
          place.address_components || [];
        const get = (type: string, useShort = false) => {
          const c = comps.find((x) => x.types.includes(type));
          return c ? (useShort ? c.short_name : c.long_name) : "";
        };
        const streetNumber = get("street_number");
        const route = get("route");
        const newStreet = [streetNumber, route].filter(Boolean).join(" ");
        const newCity =
          get("locality") || get("postal_town") || get("sublocality_level_1");
        const newState = get("administrative_area_level_1", true);
        const newZip = get("postal_code");
        if (newStreet) setStreet(newStreet);
        if (newCity) setCity(newCity);
        if (newState) setStateCode(newState);
        if (newZip) setZip(newZip);
      });
    }
    attach();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="sm:col-span-2">
        <Field label="Street" hint="Start typing — addresses autofill city/state/ZIP.">
          <Input
            ref={streetRef}
            name="street"
            autoComplete="off"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
          />
        </Field>
      </div>
      <Field label="City">
        <Input name="city" value={city} onChange={(e) => setCity(e.target.value)} />
      </Field>
      <Field label="State">
        <Input name="state" value={stateCode} onChange={(e) => setStateCode(e.target.value)} />
      </Field>
      <Field label="ZIP">
        <Input name="zip" value={zip} onChange={(e) => setZip(e.target.value)} />
      </Field>
    </>
  );
}

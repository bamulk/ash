"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";

/**
 * Single-line address input with Google Places Autocomplete. On select,
 * the input value becomes the formatted address (e.g. "123 Main St,
 * Sacramento, CA 95825, USA"). Degrades to a plain input when the Maps
 * script isn't loaded.
 */
export default function AddressLineInput({
  name = "address",
  defaultValue = "",
  placeholder,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    function attach() {
      if (cancelled || !ref.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (!g?.maps?.places?.Autocomplete) {
        const t = setTimeout(attach, 800);
        return () => clearTimeout(t);
      }
      const ac = new g.maps.places.Autocomplete(ref.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["formatted_address"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place?.formatted_address) setValue(place.formatted_address);
      });
    }
    attach();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Input
      ref={ref}
      name={name}
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

"use client";

import { useEffect, useState } from "react";

export interface PropertySummary {
  name: string;
  brand: string;
  city: string;
  state: string;
  url: string;
  category: string;
  propertyType: string;
  slidesUrl: string;
  backlinkSlidesUrl: string;
}

type SearchStatus = "idle" | "loading" | "ready" | "unauthorized" | "error";

/** Search-as-you-type against the authenticated roster endpoint. */
export function usePropertySearch(query = "") {
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<SearchStatus>("idle");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/properties?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (response.status === 401) {
          setStatus("unauthorized");
          setProperties([]);
          return;
        }
        if (!response.ok) {
          throw new Error(`Property search failed: ${response.status}`);
        }
        const payload = (await response.json()) as { total: number; results: PropertySummary[] };
        setProperties(payload.results);
        setTotal(payload.total);
        setStatus("ready");
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus("error");
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { properties, total, status };
}

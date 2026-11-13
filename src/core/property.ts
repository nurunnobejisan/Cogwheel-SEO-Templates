import "server-only";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Property, SitemapPage } from "@/lib/types";

export interface PropertyRecord extends Property {
  id: string;
}

/**
 * Upserts a property profile in Supabase when configured, returning its UUID.
 * Returns null if Supabase is not configured so callers can degrade gracefully.
 */
export async function upsertPropertyProfile(
  property: Property,
  pages: SitemapPage[] = [],
): Promise<{ propertyId: string | null }> {
  if (!isSupabaseConfigured()) {
    return { propertyId: null };
  }
  const db = getSupabase();
  const { data, error } = await db
    .from("properties")
    .upsert(
      {
        name: property.name,
        url: property.url ?? "",
        brand: property.brand,
        city: property.city,
        state: property.state,
        notes: property.notes ?? "",
        allowed_locations: property.allowedLocations,
        excluded_locations: property.excludedLocations,
        pages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name,city,state" },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Property upsert failed");
  }
  return { propertyId: data.id as string };
}

export async function getPropertyProfile(propertyId: string): Promise<PropertyRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getSupabase();
  const { data, error } = await db.from("properties").select("*").eq("id", propertyId).single();
  if (error || !data) return null;

  return {
    id: data.id as string,
    name: data.name as string,
    url: (data.url as string) ?? "",
    brand: (data.brand as string) ?? "",
    city: data.city as string,
    state: data.state as string,
    notes: (data.notes as string) ?? "",
    allowedLocations: (data.allowed_locations as string[]) ?? [],
    excludedLocations: (data.excluded_locations as string[]) ?? [],
  };
}

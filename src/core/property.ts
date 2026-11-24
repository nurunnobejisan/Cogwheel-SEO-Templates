import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Client, Property, SitemapPage } from "@/lib/types";

export interface PropertyRecord extends Property {
  id: string;
}

// In-memory fallback stores when Supabase is not connected
const memoryClients: Map<string, Client> = new Map([
  [
    "client-default",
    {
      id: "client-default",
      name: "Cogwheel Hospitality Portfolio",
      contactEmail: "director@cogwheelmarketing.com",
      contactName: "Portfolio Director",
      industry: "Hospitality & Luxury Hotels",
      status: "active",
      propertyCount: 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
]);

const memoryProperties: Map<string, PropertyRecord> = new Map();

/**
 * List agency clients with property counts.
 */
export async function listClients(): Promise<Client[]> {
  if (!isSupabaseConfigured()) {
    return Array.from(memoryClients.values());
  }
  const db = getSupabase();
  const { data, error } = await db.from("clients").select("*").order("name");
  if (error || !data) {
    return Array.from(memoryClients.values());
  }
  return data.map((d) => ({
    id: d.id,
    name: d.name,
    contactEmail: d.contact_email,
    contactName: d.contact_name,
    industry: d.industry,
    status: d.status ?? "active",
    propertyCount: d.property_count ?? 0,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

/**
 * Upserts a client organization.
 */
export async function upsertClient(client: Partial<Client> & { name: string }): Promise<Client> {
  const id = client.id ?? randomUUID();
  const record: Client = {
    id,
    name: client.name,
    contactEmail: client.contactEmail ?? "",
    contactName: client.contactName ?? "",
    industry: client.industry ?? "Hospitality",
    status: client.status ?? "active",
    propertyCount: client.propertyCount ?? 0,
    createdAt: client.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    memoryClients.set(id, record);
    return record;
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("clients")
    .upsert(
      {
        id,
        name: record.name,
        contact_email: record.contactEmail,
        contact_name: record.contactName,
        industry: record.industry,
        status: record.status,
        updated_at: record.updatedAt,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    memoryClients.set(id, record);
    return record;
  }

  return {
    id: data.id,
    name: data.name,
    contactEmail: data.contact_email,
    contactName: data.contact_name,
    industry: data.industry,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Upserts a property profile in Supabase when configured, returning its UUID.
 * Returns in-memory ID if Supabase is not configured so callers can degrade gracefully.
 */
export async function upsertPropertyProfile(
  property: Property,
  pages: SitemapPage[] = [],
): Promise<{ propertyId: string | null }> {
  const id = property.id ?? randomUUID();
  const propertyRecord: PropertyRecord = {
    ...property,
    id,
    url: property.url ?? "",
    notes: property.notes ?? "",
  };

  if (!isSupabaseConfigured()) {
    memoryProperties.set(id, propertyRecord);
    return { propertyId: id };
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("properties")
    .upsert(
      {
        id,
        client_id: property.clientId ?? null,
        group_name: property.groupName ?? "",
        name: property.name,
        url: property.url ?? "",
        brand: property.brand,
        property_type: property.propertyType ?? "Hotel",
        market: property.market ?? "",
        address: property.address ?? "",
        city: property.city,
        state: property.state,
        country: property.country ?? "US",
        phone: property.phone ?? "",
        email: property.email ?? "",
        notes: property.notes ?? "",
        target_audience: property.targetAudience ?? [],
        amenities: property.amenities ?? [],
        dining_info: property.diningInfo ?? [],
        room_info: property.roomInfo ?? [],
        meeting_event_info: property.meetingEventInfo ?? [],
        sitemap_urls: property.sitemapUrls ?? [],
        brand_guidelines: property.brandGuidelines ?? "",
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
    memoryProperties.set(id, propertyRecord);
    return { propertyId: id };
  }
  return { propertyId: data.id as string };
}

export async function getPropertyProfile(propertyId: string): Promise<PropertyRecord | null> {
  if (!isSupabaseConfigured()) {
    return memoryProperties.get(propertyId) ?? null;
  }
  const db = getSupabase();
  const { data, error } = await db.from("properties").select("*").eq("id", propertyId).single();
  if (error || !data) {
    return memoryProperties.get(propertyId) ?? null;
  }

  return {
    id: data.id as string,
    clientId: data.client_id ?? undefined,
    groupName: data.group_name ?? undefined,
    name: data.name as string,
    url: (data.url as string) ?? "",
    brand: (data.brand as string) ?? "",
    propertyType: data.property_type ?? "Hotel",
    market: data.market ?? "",
    address: data.address ?? "",
    city: data.city as string,
    state: data.state as string,
    country: data.country ?? "US",
    phone: data.phone ?? "",
    email: data.email ?? "",
    notes: (data.notes as string) ?? "",
    targetAudience: data.target_audience ?? [],
    amenities: data.amenities ?? [],
    diningInfo: data.dining_info ?? [],
    roomInfo: data.room_info ?? [],
    meetingEventInfo: data.meeting_event_info ?? [],
    sitemapUrls: data.sitemap_urls ?? [],
    brandGuidelines: data.brand_guidelines ?? "",
    allowedLocations: (data.allowed_locations as string[]) ?? [],
    excludedLocations: (data.excluded_locations as string[]) ?? [],
  };
}

export async function listProperties(clientId?: string): Promise<PropertyRecord[]> {
  if (!isSupabaseConfigured()) {
    const all = Array.from(memoryProperties.values());
    if (clientId) return all.filter((p) => p.clientId === clientId);
    return all;
  }
  const db = getSupabase();
  let query = db.from("properties").select("*").order("name");
  if (clientId) {
    query = query.eq("client_id", clientId);
  }
  const { data, error } = await query;
  if (error || !data) {
    const all = Array.from(memoryProperties.values());
    if (clientId) return all.filter((p) => p.clientId === clientId);
    return all;
  }
  return data.map((d) => ({
    id: d.id,
    clientId: d.client_id,
    groupName: d.group_name,
    name: d.name,
    url: d.url ?? "",
    brand: d.brand ?? "",
    propertyType: d.property_type ?? "Hotel",
    market: d.market ?? "",
    address: d.address ?? "",
    city: d.city,
    state: d.state,
    country: d.country ?? "US",
    phone: d.phone ?? "",
    email: d.email ?? "",
    notes: d.notes ?? "",
    targetAudience: d.target_audience ?? [],
    amenities: d.amenities ?? [],
    diningInfo: d.dining_info ?? [],
    roomInfo: d.room_info ?? [],
    meetingEventInfo: d.meeting_event_info ?? [],
    sitemapUrls: d.sitemap_urls ?? [],
    brandGuidelines: d.brand_guidelines ?? "",
    allowedLocations: d.allowed_locations ?? [],
    excludedLocations: d.excluded_locations ?? [],
  }));
}

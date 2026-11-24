export type IntegrationId =
  | "google_search_console"
  | "google_analytics_4"
  | "google_pagespeed"
  | "google_business_profile"
  | "semrush"
  | "ahrefs"
  | "anthropic_claude"
  | "google_workspace"
  | "supabase_postgres";

export type ConnectionStatus = "connected" | "disconnected" | "error" | "unconfigured";

export interface IntegrationHealth {
  id: IntegrationId;
  name: string;
  category: "Search Console" | "Analytics" | "Performance" | "Local" | "Third-Party Data" | "AI LLM" | "Workspace" | "Database";
  status: ConnectionStatus;
  authStatus: "authenticated" | "missing_token" | "expired" | "not_required";
  requiredEnvVars: string[];
  missingEnvVars: string[];
  lastSuccessfulSync: string | null;
  errorHistory: string[];
  configurationInstructions: string;
}

export function inspectIntegrationHealth(): IntegrationHealth[] {
  const env = process.env;

  const checks: IntegrationHealth[] = [
    {
      id: "anthropic_claude",
      name: "Anthropic Claude (3.5 Sonnet)",
      category: "AI LLM",
      status: env.ANTHROPIC_API_KEY ? "connected" : "unconfigured",
      authStatus: env.ANTHROPIC_API_KEY ? "authenticated" : "missing_token",
      requiredEnvVars: ["ANTHROPIC_API_KEY"],
      missingEnvVars: env.ANTHROPIC_API_KEY ? [] : ["ANTHROPIC_API_KEY"],
      lastSuccessfulSync: env.ANTHROPIC_API_KEY ? new Date().toISOString() : null,
      errorHistory: [],
      configurationInstructions: "Add ANTHROPIC_API_KEY in Vercel project environment variables to enable live Claude 3.5 Sonnet draft generation.",
    },
    {
      id: "supabase_postgres",
      name: "Supabase PostgreSQL Database",
      category: "Database",
      status: env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? "connected" : "unconfigured",
      authStatus: env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? "authenticated" : "missing_token",
      requiredEnvVars: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      missingEnvVars: [
        ...(env.SUPABASE_URL ? [] : ["SUPABASE_URL"]),
        ...(env.SUPABASE_SERVICE_ROLE_KEY ? [] : ["SUPABASE_SERVICE_ROLE_KEY"]),
      ],
      lastSuccessfulSync: env.SUPABASE_URL ? new Date().toISOString() : null,
      errorHistory: [],
      configurationInstructions: "Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel settings for cloud database persistence. (In-memory fallback active).",
    },
    {
      id: "google_workspace",
      name: "Google Workspace (Docs / Sheets / Slides)",
      category: "Workspace",
      status: env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY ? "connected" : "unconfigured",
      authStatus: env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY ? "authenticated" : "missing_token",
      requiredEnvVars: ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY"],
      missingEnvVars: [
        ...(env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? [] : ["GOOGLE_SERVICE_ACCOUNT_EMAIL"]),
        ...(env.GOOGLE_PRIVATE_KEY ? [] : ["GOOGLE_PRIVATE_KEY"]),
      ],
      lastSuccessfulSync: null,
      errorHistory: [],
      configurationInstructions: "Add Google Cloud service account credentials with Drive, Docs, and Sheets API scopes for automated deliverable rendering.",
    },
    {
      id: "google_search_console",
      name: "Google Search Console API",
      category: "Search Console",
      status: env.GSC_CLIENT_EMAIL && env.GSC_PRIVATE_KEY ? "connected" : "unconfigured",
      authStatus: env.GSC_CLIENT_EMAIL && env.GSC_PRIVATE_KEY ? "authenticated" : "missing_token",
      requiredEnvVars: ["GSC_CLIENT_EMAIL", "GSC_PRIVATE_KEY"],
      missingEnvVars: [
        ...(env.GSC_CLIENT_EMAIL ? [] : ["GSC_CLIENT_EMAIL"]),
        ...(env.GSC_PRIVATE_KEY ? [] : ["GSC_PRIVATE_KEY"]),
      ],
      lastSuccessfulSync: null,
      errorHistory: [],
      configurationInstructions: "Grant Search Console property viewer access to the service account to pull verified impressions, clicks, and average rank.",
    },
    {
      id: "google_analytics_4",
      name: "Google Analytics 4 (GA4)",
      category: "Analytics",
      status: env.GA4_PROPERTY_ID ? "connected" : "unconfigured",
      authStatus: env.GA4_PROPERTY_ID ? "authenticated" : "missing_token",
      requiredEnvVars: ["GA4_PROPERTY_ID"],
      missingEnvVars: env.GA4_PROPERTY_ID ? [] : ["GA4_PROPERTY_ID"],
      lastSuccessfulSync: null,
      errorHistory: [],
      configurationInstructions: "Provide GA4_PROPERTY_ID with Google Analytics Data API enabled to track hotel booking engine referral conversions.",
    },
    {
      id: "google_pagespeed",
      name: "Google PageSpeed Insights API",
      category: "Performance",
      status: env.PAGESPEED_API_KEY ? "connected" : "unconfigured",
      authStatus: env.PAGESPEED_API_KEY ? "authenticated" : "not_required",
      requiredEnvVars: ["PAGESPEED_API_KEY"],
      missingEnvVars: env.PAGESPEED_API_KEY ? [] : ["PAGESPEED_API_KEY"],
      lastSuccessfulSync: null,
      errorHistory: [],
      configurationInstructions: "Provide PAGESPEED_API_KEY to fetch automated mobile and desktop Core Web Vitals (LCP, CLS, INP) field data.",
    },
    {
      id: "google_business_profile",
      name: "Google Business Profile (GBP) API",
      category: "Local",
      status: env.GBP_CLIENT_ID && env.GBP_CLIENT_SECRET ? "connected" : "unconfigured",
      authStatus: env.GBP_CLIENT_ID && env.GBP_CLIENT_SECRET ? "authenticated" : "missing_token",
      requiredEnvVars: ["GBP_CLIENT_ID", "GBP_CLIENT_SECRET"],
      missingEnvVars: [
        ...(env.GBP_CLIENT_ID ? [] : ["GBP_CLIENT_ID"]),
        ...(env.GBP_CLIENT_SECRET ? [] : ["GBP_CLIENT_SECRET"]),
      ],
      lastSuccessfulSync: null,
      errorHistory: [],
      configurationInstructions: "Set up OAuth 2.0 Web Application credentials in Google Cloud Console with Google My Business API access.",
    },
    {
      id: "semrush",
      name: "Semrush Data Integration",
      category: "Third-Party Data",
      status: "connected",
      authStatus: "not_required",
      requiredEnvVars: [],
      missingEnvVars: [],
      lastSuccessfulSync: new Date().toISOString(),
      errorHistory: [],
      configurationInstructions: "Native multi-CSV/XLSX dropzone active. Drag-and-drop Semrush keyword exports directly in Studio without API key quota limits.",
    },
    {
      id: "ahrefs",
      name: "Ahrefs Backlink Exporter Integration",
      category: "Third-Party Data",
      status: "connected",
      authStatus: "not_required",
      requiredEnvVars: [],
      missingEnvVars: [],
      lastSuccessfulSync: new Date().toISOString(),
      errorHistory: [],
      configurationInstructions: "Drop Ahrefs Referring Domains and Backlinks CSV exports directly into Competitors Backlink Analysis view.",
    },
  ];

  return checks;
}

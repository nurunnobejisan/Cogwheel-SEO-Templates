export type SiteType =
  | 'hospitality'
  | 'ecommerce'
  | 'saas'
  | 'local_business'
  | 'editorial'
  | 'general';

export type EngineMode = 'auto' | 'hospitality' | 'universal';

export interface SiteConfig {
  siteType: SiteType;
  mode: EngineMode;
  brandName: string;
  domain: string;
  locale: string;
  targetAudience: string;
  primaryKeywords: string[];
  competitors: string[];
}

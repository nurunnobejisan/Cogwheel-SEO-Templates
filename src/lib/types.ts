export type TemplateId = "A" | "B";

export interface Property {
  name: string;
  url?: string;
  brand: string;
  city: string;
  /** 2-letter USPS code */
  state: string;
  notes?: string;
  allowedLocations: string[];
  excludedLocations: string[];
}

export interface SitemapPage {
  id: string;
  path: string;
  title: string;
  /** Ordered bucket ids eligible for this page's primary keyword. */
  buckets: string[];
  active: boolean;
}

export type KeywordFlag =
  | "kd-na"
  | "low-sv-exception"
  | "kd-unknown"
  | "kd-exception"
  | "high-sv-exception-available"
  | "no-candidates"
  | "manual-override";

export interface KeywordRecord {
  id: string;
  keyword: string;
  volume: number;
  kd: number | null;
  cpc: number | null;
  intent: string | null;
  /** Group/Topic column value, or cleaned filename. */
  sourceGroup: string;
  sourceFiles: string[];
  flags: KeywordFlag[];
  /** Assigned by the bucketing engine. */
  bucketId?: string;
  bucketName?: string;
  bucketSource?: "keyword" | "group" | "custom" | "fallback";
}

export type DropReason = "empty" | "low-volume" | "geo";

export interface DroppedRow {
  keyword: string;
  volume: number;
  kd: number | null;
  sourceFile: string;
  reason: DropReason;
  detail?: string;
}

export interface FileStat {
  fileName: string;
  rows: number;
  sourceGroup: string;
  usedGroupColumn: boolean;
  error?: string;
}

export interface IngestStats {
  files: number;
  rawRows: number;
  uniqueKeywords: number;
  duplicatesMerged: number;
  kdCleaned: number;
  dropped: Record<DropReason, number>;
  kept: number;
}

export interface IngestResult {
  keywords: KeywordRecord[];
  dropped: DroppedRow[];
  files: FileStat[];
  stats: IngestStats;
}

export interface BucketSummary {
  bucketId: string;
  bucketName: string;
  count: number;
  totalVolume: number;
}

export type PoolRole = "primary" | "secondary" | "fill" | "reserve";

export interface PoolEntry extends KeywordRecord {
  role: PoolRole;
  pageId?: string;
}

export interface Allocation {
  pool: PoolEntry[];
  reserve: PoolEntry[];
  quota: number;
  filled: number;
}

export type MatrixStatus = "pending" | "approved" | "edited";

export interface KeywordRef {
  id: string;
  keyword: string;
  volume: number;
  kd: number | null;
  bucketId?: string;
}

export interface MatrixRow {
  pageId: string;
  path: string;
  title: string;
  primary: KeywordRef | null;
  secondary: KeywordRef | null;
  alternatives: KeywordRef[];
  exceptionCandidate: KeywordRef | null;
  flags: KeywordFlag[];
  status: MatrixStatus;
}


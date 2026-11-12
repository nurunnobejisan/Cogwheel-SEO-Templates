/**
 * Phase 1 business rules. Every threshold used by the engine lives here.
 * See SPEC.md §4.
 */
export interface EngineRules {
  /** Max Semrush files per ingest request. */
  maxFiles: number;
  /** Total size of the keyword pool. */
  quotaTotal: number;
  /** Rows with volume below this are dropped (unless low-SV exception applies). */
  minVolume: number;
  /** Low-SV exception: keep if KD < this AND keyword is a local venue demand generator. */
  lowVolumeExceptionMaxKd: number;
  /** Preferred primary keywords have KD strictly below this. */
  kdPreferredMax: number;
  /** Surface a KD >= kdPreferredMax candidate when volume >= max(minVolume, multiplier × primary volume). */
  highVolumeException: { multiplier: number; minVolume: number };
  /** Optional cap on keywords per bucket in the fill phase (null = no cap). */
  maxPerBucket: number | null;
  /** Number of alternative keywords offered per matrix row. */
  alternativesPerPage: number;
  /** Include keywords in the fallback bucket when filling the pool. */
  includeUnassignedInPool: boolean;
  /** Bucket ids treated as local venue demand generators. */
  localDemandBuckets: string[];
}

export const DEFAULT_RULES: EngineRules = {
  maxFiles: 50,
  quotaTotal: 78,
  minVolume: 10,
  lowVolumeExceptionMaxKd: 20,
  kdPreferredMax: 45,
  highVolumeException: { multiplier: 2, minVolume: 500 },
  maxPerBucket: null,
  alternativesPerPage: 10,
  includeUnassignedInPool: false,
  localDemandBuckets: [
    "event-space",
    "wedding",
    "meeting",
    "venues",
    "restaurants",
    "dining",
    "bar",
    "rooftop-bar",
    "things-to-do",
    "local-attractions",
  ],
};

export type RulesOverride = Omit<Partial<EngineRules>, "highVolumeException"> & {
  highVolumeException?: Partial<EngineRules["highVolumeException"]>;
};

export function resolveRules(overrides?: RulesOverride): EngineRules {
  return {
    ...DEFAULT_RULES,
    ...(overrides ?? {}),
    highVolumeException: {
      ...DEFAULT_RULES.highVolumeException,
      ...(overrides?.highVolumeException ?? {}),
    },
  };
}


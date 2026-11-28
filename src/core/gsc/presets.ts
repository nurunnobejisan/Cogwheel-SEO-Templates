/** Client-safe GSC range presets. No credentials or server SDK imports. */
export const GSC_RANGE_PRESETS = [
  { id: "7d", days: 7, label: "7 days" },
  { id: "28d", days: 28, label: "28 days" },
  { id: "3m", days: 90, label: "3 months" },
  { id: "6m", days: 180, label: "6 months" },
  { id: "16m", days: 480, label: "16 months" },
] as const;

export type GscRangeId = (typeof GSC_RANGE_PRESETS)[number]["id"];

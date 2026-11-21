export interface RemoteManifest {
  manifest_version: 3;
  name: string;
  version: string;
  description?: string;
}

export interface OtaConfigPayload {
  schemaVersion: string;
  updatedAt: string;
  pixelLimits: {
    titleMaxPx: number;
    descriptionMaxPx: number;
  };
  scoringWeights: {
    onPage: number;
    schema: number;
    geoAi: number;
  };
  keywordMatrixUrl: string;
  brandGuardrailsUrl: string;
}

export interface ExtensionUpdateState {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseDownloadUrl: string;
  releaseNotesUrl: string;
  lastCheckedAt: string;
  otaDataVersion: string;
  otaSyncedAt: string;
}

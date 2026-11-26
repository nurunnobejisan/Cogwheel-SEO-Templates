"""Single Source of Truth Pydantic & Typed Data Models for SEO Studio.

Mirrors TypeScript schemas defined in src/schemas/validation.ts and JSON schemas
located in schemas/*.schema.json.
"""

from __future__ import annotations

from typing import Any, Literal, Optional, Union

try:
    from pydantic import BaseModel, Field
    PYDANTIC_AVAILABLE = True
except ImportError:
    PYDANTIC_AVAILABLE = False

    class BaseModel:  # type: ignore[no-redef]
        """Lightweight fallback base class when Pydantic is not installed."""

        def __init__(self, **kwargs: Any) -> None:
            for k, v in kwargs.items():
                setattr(self, k, self._wrap(v))

        @classmethod
        def _wrap(cls, val: Any) -> Any:
            if isinstance(val, dict):
                return cls(**val)
            elif isinstance(val, list):
                return [cls._wrap(item) for item in val]
            return val

        def __getitem__(self, key: str) -> Any:
            return getattr(self, key)

        def __contains__(self, key: str) -> bool:
            return hasattr(self, key)

        def get(self, key: str, default: Any = None) -> Any:
            return getattr(self, key, default)

        def model_dump(self) -> dict[str, Any]:
            """Return dictionary representation of the model."""
            res: dict[str, Any] = {}
            for k, v in self.__dict__.items():
                if isinstance(v, BaseModel):
                    res[k] = v.model_dump()
                elif isinstance(v, list):
                    res[k] = [item.model_dump() if isinstance(item, BaseModel) else item for item in v]
                else:
                    res[k] = v
            return res

    def Field(default: Any = ..., **_kwargs: Any) -> Any:  # type: ignore[no-redef]
        """Fallback Field wrapper."""
        return default


# ==============================================================================
# 1. 78-KEYWORD STRATEGY MATRIX MODELS
# ==============================================================================

KeywordCategory = Literal[
    "Brand/Direct Booking",
    "Local/Neighborhood",
    "Airport/Transit",
    "Meetings/Weddings",
    "Extended Stay",
    "Conversational AI Prompts",
]

SearchIntent = Literal[
    "Navigational",
    "Informational",
    "Commercial",
    "Transactional",
    "Conversational/Generative",
]
SearchVolumeTier = Literal["High", "Medium", "Low", "Long-Tail / Conversational"]


class KeywordItem(BaseModel):
    """Individual hospitality keyword strategy specification."""

    id: str
    keyword: str
    category: KeywordCategory
    subCategory: str
    searchIntent: SearchIntent
    searchVolumeTier: SearchVolumeTier
    cpcEstimate: str
    targetPageType: str
    recommendedSchema: str
    geoEngineRelevance: list[str]
    targetEntityPrompt: str
    competitiveContext: str


class KeywordMetadata(BaseModel):
    """Metadata header for the 78-keyword strategy matrix."""

    version: str
    datasetName: str
    totalKeywords: int
    lastUpdated: str
    author: str
    targetIndustries: list[str]
    categorySummary: dict[str, int]


class KeywordStrategyMatrix(BaseModel):
    """Complete 78-keyword strategy matrix dataset."""

    metadata: KeywordMetadata
    categories: list[KeywordCategory]
    keywords: list[KeywordItem]


# ==============================================================================
# 2. HOTEL BRAND GUARDRAILS MODELS
# ==============================================================================

BrandName = Literal["Marriott", "Hilton", "IHG", "Hyatt", "Independent"]


class ForbiddenTerm(BaseModel):
    """Prohibited superlative or restricted nomenclature with required replacement."""

    term: str
    reason: str
    replacement: str


class BrandRule(BaseModel):
    """Franchise brand guardrail rules, character thresholds, and term restrictions."""

    name: BrandName
    loyaltyProgram: str
    maxTitleChars: int
    maxMetaChars: int
    maxH1Chars: int
    brandPillColor: str
    forbiddenTerms: list[ForbiddenTerm]


# ==============================================================================
# 3. AUDIT PAYLOAD & SCORE BREAKDOWN MODELS
# ==============================================================================

SeverityLevel = Literal["high", "medium", "low"]
AuditGrade = Literal["A+", "A", "B", "C", "NEEDS AUDIT"]


class QuickWinItem(BaseModel):
    """Identified SEO or GEO deficiency with proposed remediation."""

    id: str
    title: str
    severity: SeverityLevel
    impact: str
    templateIdToFix: Optional[str] = None
    fixActionLabel: Optional[str] = None


class ScoreBreakdown(BaseModel):
    """Evaluation breakdown across 4 radial KPI gauges and 10 quality gates."""

    overall: int
    onPage: int
    schemaTechnical: int
    geoAiReadiness: int
    grade: AuditGrade
    gradeColor: str
    passedGates: int
    totalGates: int
    quickWins: list[QuickWinItem]


class PageAuditData(BaseModel):
    """Comprehensive page context extracted from the live hotel DOM."""

    url: str
    origin: str
    pathname: str
    protocol: str
    hostname: str
    title: str
    titlePixelWidth: Optional[int] = None
    metaDesc: str
    metaDescPixelWidth: Optional[int] = None
    canonical: str
    h1Elements: list[str]
    h2Elements: list[str]
    h3Elements: list[str]
    totalImages: int
    imagesWithoutAlt: int
    oversizedImages: int
    words: int
    schemas: list[dict[str, Any]]
    links: dict[str, int]
    hasViewport: bool
    hasOgTitle: bool
    hasOgImage: bool
    ogTitle: str
    ogDescription: str
    ogImage: str
    metaRobots: Optional[str] = "index, follow"
    language: Optional[str] = "en"
    internalUrls: Optional[list[str]] = None
    loadTimeMs: Optional[int] = None


class AuditPayload(BaseModel):
    """Combined audit data and KPI scoring results."""

    pageData: PageAuditData
    scores: ScoreBreakdown
    timestamp: Optional[str] = None


# ==============================================================================
# 4. OTA CONFIGURATION MODELS
# ==============================================================================

class PixelLimits(BaseModel):
    """Google SERP typographic pixel budget constraints."""

    titleMaxPx: int
    descriptionMaxPx: int


class ScoringWeights(BaseModel):
    """Composite percentage weighting for the 4 KPI radial gauges."""

    onPage: float
    schema_weight: float = Field(default=0.35, alias="schema")
    geoAi: float

    if PYDANTIC_AVAILABLE:
        model_config = {"populate_by_name": True}

    @property  # type: ignore[override]
    def schema(self) -> float:
        return self.schema_weight

    @schema.setter
    def schema(self, val: float) -> None:
        self.schema_weight = val


class OtaConfig(BaseModel):
    """Over-the-Air (OTA) live sync rules, pixel thresholds, and dataset pointers."""

    schemaVersion: str
    updatedAt: str
    pixelLimits: PixelLimits
    scoringWeights: ScoringWeights
    keywordMatrixUrl: str
    brandGuardrailsUrl: str


# ==============================================================================
# 5. EXTENSION TRAINING DATA & BATCH SYNC MODELS
# ==============================================================================

class RawWebInputModel(BaseModel):
    """Raw webpage snapshot captured by the Chrome extension."""

    url: str
    canonicalUrl: Optional[str] = None
    domain: str
    rawTitle: str = ""
    rawMetaDesc: str = ""
    rawH1: list[str] = Field(default_factory=list)
    rawH2: list[str] = Field(default_factory=list)
    rawBodyText: str = ""
    detectedSchemas: list[str] = Field(default_factory=list)
    wordCount: int = 0


class TargetOptimizedOutputModel(BaseModel):
    """Target optimization targets generated or approved in Template Studio."""

    optimizedTitle: str
    optimizedMetaDesc: str
    optimizedH1: str
    jsonLdSchema: Union[dict[str, Any], list[dict[str, Any]]] = Field(default_factory=dict)
    geoEntityBlock: str = ""
    brandGuardrail: str = "Independent"


class TrainingPairRecordModel(BaseModel):
    """Paired raw DOM input and optimized output stored in local vault."""

    id: str
    schemaVersion: str = "3.0.0"
    canonicalUrlHash: str
    contentHash: str
    version: int = 1
    source: Literal["auto", "manual"] = "manual"
    pageType: str = "hotel_homepage"
    extractionConfidence: int = 85
    canonicalUrl: str
    domain: str
    brand: str = "Independent"
    rawInput: RawWebInputModel
    targetOutput: TargetOptimizedOutputModel
    qualityScore: int
    status: Literal["pending", "approved", "rejected"] = "pending"
    createdAt: str
    updatedAt: str


class RawJsonlProvenanceModel(BaseModel):
    """Provenance tracking metadata for exported training samples."""

    canonicalUrlHash: str
    contentHash: str
    capturedAt: str
    extensionVersion: str = "2.7.0"


class RawJsonlSampleModel(BaseModel):
    """Raw training sample line format with provenance and idempotency."""

    schemaVersion: str = "3.0.0"
    idempotencyKey: str
    provenance: RawJsonlProvenanceModel
    record: TrainingPairRecordModel


class BatchSyncPayloadModel(BaseModel):
    """Payload sent by Chrome Extension to Web App API for batch synchronization."""

    schemaVersion: str = "3.0.0"
    event: Literal["training_batch_sync"] = "training_batch_sync"
    timestamp: str
    count: int
    samples: list[RawJsonlSampleModel]


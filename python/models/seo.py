"""Single Source of Truth Pydantic v2 Models for Hotel SEO, Facts & GEO signals.

Strictly mirrors /schemas/hotel-seo.schema.json and src/types/seo.ts.
Zero any types, strict validation, extra forbidden on core entities.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class PropertyAudit(BaseModel):
    """Core on-page and technical hospitality audit data for a single inspected property."""

    model_config = ConfigDict(extra="forbid", strict=True)

    url: str = Field(..., min_length=1, description="Fully qualified target URL of the inspected hotel page")
    hotelName: str = Field(..., min_length=1, description="Official hotel property name")
    brand: str = Field(..., min_length=1, description="Hospitality parent brand or franchise flag")
    city: str = Field(..., min_length=1, description="Primary municipality or destination market")
    neighborhood: str = Field(..., description="Micro-neighborhood, district, or geographic demand generator")
    title: str = Field(..., min_length=1, description="SERP title tag string")
    metaDescription: str = Field(..., min_length=1, description="Meta description tag string")
    h1: str = Field(..., min_length=1, description="Primary above-the-fold H1 headline string")
    canonical: str = Field(..., min_length=1, description="Canonical URL link target")
    wordCount: int = Field(..., ge=0, description="Total body prose word count excluding boilerplate")


class GeoSignals(BaseModel):
    """Generative Engine Optimization (GEO) and AI search visibility signals."""

    model_config = ConfigDict(extra="forbid", strict=True)

    hasHotelSchema: bool = Field(..., description="Whether valid Schema.org/Hotel or LodgingBusiness is detected")
    hasFaqSchema: bool = Field(..., description="Whether valid Schema.org/FAQPage JSON-LD is detected")
    entityDensityScore: float = Field(
        ..., ge=0.0, le=100.0, description="Normalized score (0-100) reflecting factual entity density in prose"
    )
    citationReadinessScore: float = Field(
        ..., ge=0.0, le=100.0, description="Normalized score (0-100) evaluating citation readiness in LLMs"
    )
    missingEntities: list[str] = Field(
        default_factory=list, description="List of recognized local or brand entities missing from page copy"
    )


class TemplatePayload(BaseModel):
    """Payload for template rendering and variable substitution."""

    model_config = ConfigDict(extra="forbid", strict=True)

    templateId: str = Field(..., min_length=1, description="Identifier of the Cogwheel template being executed")
    variables: dict[str, str] = Field(
        default_factory=dict, description="Key-value dictionary of string variables resolved into template"
    )
    renderedOutput: str = Field(..., description="Fully resolved template content ready for deployment or export")
    validationWarnings: list[str] = Field(
        default_factory=list, description="Deterministic warnings raised during validation or variable replacement"
    )


class HotelSeoAudit(BaseModel):
    """Unified Hotel SEO & GEO Audit Document uniting PropertyAudit, GeoSignals, and TemplatePayload."""

    model_config = ConfigDict(extra="forbid", strict=True)

    property: PropertyAudit = Field(..., description="Core property on-page metrics")
    geoSignals: GeoSignals = Field(..., description="Generative search and entity signals")
    templatePayload: Optional[TemplatePayload] = Field(
        default=None, description="Optional associated template generation payload"
    )
    auditTimestamp: Optional[str] = Field(
        default=None, description="ISO 8601 audit generation timestamp"
    )


# ==============================================================================
# Extended Live Property Extraction & Fact Models
# ==============================================================================

class RoomFact(BaseModel):
    """Extracted property guestroom or suite facts."""

    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., description="Room or suite title, e.g. Deluxe King Suite")
    bed_type: Optional[str] = Field(default=None, description="Bed configuration, e.g. 1 King, 2 Queens")
    sq_ft: Optional[int] = Field(default=None, description="Room square footage")
    starting_rate: Optional[str] = Field(default=None, description="Starting room rate if published")
    amenities: list[str] = Field(default_factory=list, description="Room specific amenities")


class DiningFact(BaseModel):
    """Extracted on-site restaurant, bar, or culinary outlet facts."""

    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., description="Name of the restaurant or outlet")
    cuisine: Optional[str] = Field(default=None, description="Type of cuisine or dining style")
    meal_types: list[str] = Field(default_factory=list, description="Served meals, e.g. Breakfast, Dinner")
    description: Optional[str] = Field(default=None, description="Brief description or hours")


class MeetingSpaceFact(BaseModel):
    """Extracted event and conference venue facts."""

    model_config = ConfigDict(extra="ignore")

    total_sq_ft: Optional[int] = Field(default=None, description="Total meeting and event space square footage")
    room_count: Optional[int] = Field(default=None, description="Total number of breakout/meeting rooms")
    largest_ballroom_sq_ft: Optional[int] = Field(default=None, description="Square footage of the largest ballroom")
    max_banquet_capacity: Optional[int] = Field(default=None, description="Maximum seated banquet capacity")
    max_reception_capacity: Optional[int] = Field(default=None, description="Maximum standing reception capacity")


class PolicyFact(BaseModel):
    """Extracted property operational policies."""

    model_config = ConfigDict(extra="ignore")

    check_in_time: Optional[str] = Field(default=None, description="Check-in arrival time, e.g. 4:00 PM")
    check_out_time: Optional[str] = Field(default=None, description="Check-out departure time, e.g. 11:00 AM")
    parking_type: Optional[str] = Field(default=None, description="Valet, Self-parking, or Off-site")
    parking_fee: Optional[str] = Field(default=None, description="Nightly or daily parking rate")
    pet_policy: Optional[str] = Field(default=None, description="Pet friendly status and restrictions")
    pet_fee: Optional[str] = Field(default=None, description="Pet fee or deposit")
    has_ev_charging: bool = Field(default=False, description="Whether EV charging stations are available")


class AttractionFact(BaseModel):
    """Extracted nearby landmarks, convention centers, or transit points."""

    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., description="Name of attraction or transit hub")
    category: str = Field(default="landmark", description="Category: airport, convention_center, landmark, arena")
    distance_miles: Optional[float] = Field(default=None, description="Distance from hotel in miles")
    drive_time_minutes: Optional[int] = Field(default=None, description="Estimated drive time in minutes")


class TechnicalFlags(BaseModel):
    """Extracted technical SEO and on-page truncation flags."""

    model_config = ConfigDict(extra="ignore")

    title_length: int = Field(default=0, description="Character count of <title>")
    title_truncated: bool = Field(default=False, description="Whether title exceeds 60 characters")
    meta_description_length: int = Field(default=0, description="Character count of meta description")
    meta_description_truncated: bool = Field(default=False, description="Whether meta description exceeds 155 characters")
    h1_count: int = Field(default=0, description="Total <h1> tags on the page")
    h1_tags: list[str] = Field(default_factory=list, description="List of all extracted <h1> strings")
    duplicate_h1: bool = Field(default=False, description="Whether multiple <h1> tags exist")
    total_images: int = Field(default=0, description="Total <img> tags detected")
    missing_alt_images_count: int = Field(default=0, description="Images with no alt attribute")
    decorative_images_count: int = Field(default=0, description="Images with empty decorative alt=\"\"")
    has_canonical: bool = Field(default=False, description="Whether a canonical link tag exists")
    canonical_match: bool = Field(default=True, description="Whether canonical URL matches target URL")
    word_count: int = Field(default=0, description="Extracted body prose word count")


class ExtractedHotelFacts(BaseModel):
    """Comprehensive structured payload representing all live extracted property data."""

    model_config = ConfigDict(extra="ignore")

    property: PropertyAudit = Field(..., description="Core property audit structure")
    rooms: list[RoomFact] = Field(default_factory=list, description="Extracted guestrooms and suites")
    dining: list[DiningFact] = Field(default_factory=list, description="Extracted dining venues")
    meeting_space: MeetingSpaceFact = Field(default_factory=MeetingSpaceFact, description="Extracted event venue specs")
    policies: PolicyFact = Field(default_factory=PolicyFact, description="Extracted hotel operational policies")
    attractions: list[AttractionFact] = Field(default_factory=list, description="Nearby attractions and airports")
    technical_flags: TechnicalFlags = Field(default_factory=TechnicalFlags, description="Technical SEO health flags")
    faq_items: list[dict[str, str]] = Field(default_factory=list, description="Extracted FAQ Q&A pairs")
    raw_json_ld: list[dict[str, Any]] = Field(default_factory=list, description="Raw JSON-LD entities detected")


class GeoScoreResult(BaseModel):
    """Generative Engine Optimization scoring result."""

    model_config = ConfigDict(extra="ignore")

    signals: GeoSignals = Field(..., description="Standard GeoSignals object matching Single Source of Truth")
    fact_density_score: float = Field(..., ge=0.0, le=100.0, description="Score evaluating factual entity density")
    qa_format_score: float = Field(..., ge=0.0, le=100.0, description="Score evaluating direct Q&A LLM structure")
    entity_completeness_score: float = Field(..., ge=0.0, le=100.0, description="Score evaluating local entity coverage")
    detected_entities: list[str] = Field(default_factory=list, description="Entities detected on the page")
    qa_pairs_count: int = Field(default=0, description="Count of valid question-answer pairs identified")
    recommendations: list[str] = Field(default_factory=list, description="Actionable GEO recommendations")

"""Single Source of Truth Pydantic v2 Models for Hotel SEO and GEO signals.

Strictly mirrors /schemas/hotel-seo.schema.json and src/types/seo.ts.
Zero any types, strict validation, extra forbidden.
"""

from __future__ import annotations

from typing import Optional

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

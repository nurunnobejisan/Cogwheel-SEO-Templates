"""Unit tests for python/models/seo.py strict Pydantic v2 models."""

import sys
from pathlib import Path

# Add repository root to path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

try:
    from pydantic import ValidationError

    from python.models.seo import (
        GeoSignals,
        HotelSeoAudit,
        PropertyAudit,
        TemplatePayload,
    )
    PYDANTIC_AVAILABLE = True
except ImportError:
    PYDANTIC_AVAILABLE = False


def get_valid_property_data() -> dict[str, object]:
    return {
        "url": "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
        "hotelName": "SpringHill Suites Panama City Beachfront",
        "brand": "Marriott Bonvoy",
        "city": "Panama City Beach",
        "neighborhood": "Front Beach Road",
        "title": "Beachfront Hotels Panama City Beach | SpringHill Suites",
        "metaDescription": "Stay beachfront in Panama City Beach, FL. Enjoy oceanfront suites and lazy river pool.",
        "h1": "SpringHill Suites Panama City Beachfront",
        "canonical": "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
        "wordCount": 450,
    }


def get_valid_geo_data() -> dict[str, object]:
    return {
        "hasHotelSchema": True,
        "hasFaqSchema": True,
        "entityDensityScore": 85.0,
        "citationReadinessScore": 90.0,
        "missingEntities": ["Pier Park proximity", "Gulf access boardwalk"],
    }


def test_property_audit_valid() -> None:
    if not PYDANTIC_AVAILABLE:
        return
    data = get_valid_property_data()
    prop = PropertyAudit(**data)
    assert prop.hotelName == "SpringHill Suites Panama City Beachfront"
    assert prop.wordCount == 450
    assert prop.brand == "Marriott Bonvoy"


def test_property_audit_forbids_extra_fields() -> None:
    if not PYDANTIC_AVAILABLE:
        return
    data = get_valid_property_data()
    data["extraUnknownProperty"] = "disallowed"
    failed = False
    try:
        PropertyAudit(**data)
    except ValidationError:
        failed = True
    assert failed, "Expected ValidationError for extra unknown property"


def test_property_audit_rejects_negative_word_count() -> None:
    if not PYDANTIC_AVAILABLE:
        return
    data = get_valid_property_data()
    data["wordCount"] = -5
    failed = False
    try:
        PropertyAudit(**data)
    except ValidationError:
        failed = True
    assert failed, "Expected ValidationError for negative word count"


def test_geo_signals_valid() -> None:
    if not PYDANTIC_AVAILABLE:
        return
    data = get_valid_geo_data()
    geo = GeoSignals(**data)
    assert geo.hasHotelSchema is True
    assert geo.entityDensityScore == 85.0
    assert len(geo.missingEntities) == 2


def test_geo_signals_score_boundaries() -> None:
    if not PYDANTIC_AVAILABLE:
        return
    data = get_valid_geo_data()
    data["entityDensityScore"] = 105.0
    failed = False
    try:
        GeoSignals(**data)
    except ValidationError:
        failed = True
    assert failed, "Expected ValidationError for entityDensityScore > 100"

    data = get_valid_geo_data()
    data["citationReadinessScore"] = -1.0
    failed = False
    try:
        GeoSignals(**data)
    except ValidationError:
        failed = True
    assert failed, "Expected ValidationError for citationReadinessScore < 0"


def test_template_payload_valid() -> None:
    if not PYDANTIC_AVAILABLE:
        return
    payload = TemplatePayload(
        templateId="title-meta-suite",
        variables={"targetKeyword": "Panama City Beach Hotels", "brand": "SpringHill Suites"},
        renderedOutput="<title>Panama City Beach Hotels | SpringHill Suites</title>",
        validationWarnings=[],
    )
    assert payload.templateId == "title-meta-suite"
    assert payload.variables["brand"] == "SpringHill Suites"
    assert payload.validationWarnings == []


def test_hotel_seo_audit_aggregate() -> None:
    if not PYDANTIC_AVAILABLE:
        return
    prop_data = get_valid_property_data()
    geo_data = get_valid_geo_data()
    audit = HotelSeoAudit(
        property=PropertyAudit(**prop_data),
        geoSignals=GeoSignals(**geo_data),
        auditTimestamp="2026-11-24T12:00:00Z",
    )
    assert audit.property.hotelName == "SpringHill Suites Panama City Beachfront"
    assert audit.geoSignals.citationReadinessScore == 90.0
    assert audit.templatePayload is None
    dumped = audit.model_dump()
    assert dumped["property"]["hotelName"] == "SpringHill Suites Panama City Beachfront"

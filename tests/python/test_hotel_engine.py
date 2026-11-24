"""Unit tests for live Hotel Extractor, GEO Scorer, and Template Processor.

Verifies:
1. Extraction of JSON-LD, property facts (rooms, dining, meeting space, policies, attractions),
   and technical SEO truncation flags.
2. GEO Scorer fact density, Q&A formatting, and entity completeness scoring.
3. Template Processor variable injection into all 10 hotel prompt and content templates.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from python.analyzer.geo_scorer import GeoScorer
from python.models.seo import (
    ExtractedHotelFacts,
    GeoScoreResult,
    HotelSeoAudit,
    TemplatePayload,
)
from python.processor.template_processor import TemplateProcessor
from python.scraper.hotel_extractor import HotelExtractor

# Sample mock HTML representing a comprehensive luxury hotel page
SAMPLE_HOTEL_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>The Grand Pacific Luxury Hotel &amp; Spa in San Francisco | Official Site - Long Title Exceeding Sixty Chars</title>
  <meta name="description" content="Discover The Grand Pacific Hotel in San Francisco offering 250 guestrooms, 15000 sq ft of event space, a Michelin-starred restaurant, rooftop bar, and luxury spa in the heart of downtown.">
  <link rel="canonical" href="https://grandpacific-hotel.com">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Hotel",
        "name": "The Grand Pacific Hotel & Spa",
        "brand": {
          "@type": "Brand",
          "name": "Marriott International"
        },
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "San Francisco",
          "addressRegion": "Nob Hill"
        },
        "telephone": "+1-415-555-0199",
        "checkinTime": "16:00",
        "checkoutTime": "11:00",
        "priceRange": "$$$",
        "petsAllowed": "Pet-friendly up to 40 lbs"
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What time is check-in and check-out at The Grand Pacific Hotel?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Check-in at The Grand Pacific Hotel begins at 4:00 PM, and check-out is at 11:00 AM. Early arrivals and late departures are accommodated upon request based on daily hotel occupancy."
            }
          },
          {
            "@type": "Question",
            "name": "What parking options and fees are available on-site?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "The hotel offers 24-hour valet parking at $65 per night with unlimited in-and-out privileges. Dedicated EV charging stations are complimentary for all registered overnight guests."
            }
          },
          {
            "@type": "Question",
            "name": "How far is the hotel from SFO International Airport?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "The Grand Pacific Hotel is located exactly 14.2 miles from San Francisco International Airport (SFO). The direct drive typically takes 25 minutes depending on traffic."
            }
          }
        ]
      }
    ]
  }
  </script>
</head>
<body>
  <h1>The Grand Pacific Hotel &amp; Spa</h1>
  <h1>Duplicate Unexpected Heading</h1>

  <img src="/hero.jpg" alt="Luxury exterior facade of The Grand Pacific Hotel at dusk">
  <img src="/spacer.png" alt="">
  <img src="/unlabeled.jpg">

  <section id="rooms">
    <h2>Luxury Guest Rooms &amp; Suites</h2>
    <div class="room-card">
      <h3>Deluxe King Room</h3>
      <p>420 sq ft with floor-to-ceiling city views. Starting at $289.</p>
    </div>
    <div class="room-card">
      <h3>Executive King Suite</h3>
      <p>750 sq. ft. suite featuring separate parlor and marble soaking tub. Starting at $450.</p>
    </div>
    <div class="room-card">
      <h3>Two Queen Guest Room</h3>
      <p>480 square feet with luxury bedding and double vanities. Starting at $319.</p>
    </div>
  </section>

  <section id="dining">
    <h2>On-Site Culinary Excellence</h2>
    <p>Restaurant: Pacific Coast Grill served daily with fresh coastal California cuisine.</p>
    <p>Rooftop Bar: Starlight Terrace serving craft cocktails and small plates overlooking the bay.</p>
  </section>

  <section id="meetings">
    <h2>Meetings &amp; Events</h2>
    <p>Featuring 18,500 sq. ft. of meeting space across 10 breakout rooms. Our Grand Ballroom measures 8,200 sq ft with banquet capacity for 550 guests.</p>
  </section>

  <section id="policies">
    <h2>Hotel Information &amp; Policies</h2>
    <p>Check-in: 4:00 PM | Check-out: 11:00 AM</p>
    <p>Valet parking: $65 per night. Electric vehicle EV charging is available on-site.</p>
    <p>Pet-friendly hotel. Non-refundable pet fee of $100 per stay applies.</p>
  </section>

  <section id="location">
    <h2>Neighborhood &amp; Proximity</h2>
    <p>Located in the heart of Nob Hill, just 0.6 miles to Moscone Convention Center and 14.2 miles from SFO Airport.</p>
  </section>
</body>
</html>
"""


def test_hotel_extractor_json_ld_and_facts() -> None:
    """Verify extraction of JSON-LD schemas, room facts, dining, and policies."""
    extractor = HotelExtractor()
    facts: ExtractedHotelFacts = extractor.extract_from_html(
        SAMPLE_HOTEL_HTML, url="https://grandpacific-hotel.com"
    )

    # Core property verification
    assert facts.property.hotelName == "The Grand Pacific Hotel & Spa"
    assert facts.property.brand == "Marriott International"
    assert facts.property.city == "San Francisco"
    assert "Nob Hill" in facts.property.neighborhood

    # Technical flags verification
    assert facts.technical_flags.title_truncated is True
    assert facts.technical_flags.title_length > 60
    assert facts.technical_flags.duplicate_h1 is True
    assert facts.technical_flags.h1_count == 2
    assert facts.technical_flags.missing_alt_images_count == 1
    assert facts.technical_flags.decorative_images_count == 1
    assert facts.technical_flags.has_canonical is True
    assert facts.technical_flags.canonical_match is True

    # Room facts verification
    assert len(facts.rooms) >= 2
    king_room = next((r for r in facts.rooms if "King" in r.name), None)
    assert king_room is not None
    assert king_room.sq_ft in [420, 750]

    # Meeting space verification
    assert facts.meeting_space.total_sq_ft == 18500
    assert facts.meeting_space.largest_ballroom_sq_ft == 8200
    assert facts.meeting_space.max_banquet_capacity == 550

    # Policy verification
    assert facts.policies.check_in_time == "4:00 PM"
    assert facts.policies.check_out_time == "11:00 AM"
    assert facts.policies.parking_fee == "$65 per night"
    assert facts.policies.has_ev_charging is True
    assert facts.policies.pet_fee == "$100"

    # FAQ items verification
    assert len(facts.faq_items) == 3
    assert "check-in" in facts.faq_items[0]["question"].lower()


def test_geo_scorer_evaluates_citation_readiness() -> None:
    """Verify GEO Scorer grades fact density, Q&A formatting, and entity completeness."""
    extractor = HotelExtractor()
    facts: ExtractedHotelFacts = extractor.extract_from_html(
        SAMPLE_HOTEL_HTML, url="https://grandpacific-hotel.com"
    )

    scorer = GeoScorer()
    result: GeoScoreResult = scorer.score(facts)

    # Signal boundary assertions (0.0 to 100.0)
    assert 0.0 <= result.signals.entityDensityScore <= 100.0
    assert 0.0 <= result.signals.citationReadinessScore <= 100.0
    assert result.signals.hasHotelSchema is True
    assert result.signals.hasFaqSchema is True

    # Scoring assertions
    assert result.fact_density_score >= 70.0
    assert result.qa_format_score >= 80.0
    assert result.entity_completeness_score >= 80.0
    assert len(result.detected_entities) >= 3
    assert len(result.recommendations) > 0

    # Recommendations should flag the duplicate H1 and long title
    rec_text = " ".join(result.recommendations)
    assert "Multiple <h1>" in rec_text or "title exceeds 60 characters" in rec_text


def test_template_processor_renders_all_templates() -> None:
    """Verify TemplateProcessor injects live facts into all 10 Cogwheel templates."""
    extractor = HotelExtractor()
    facts: ExtractedHotelFacts = extractor.extract_from_html(
        SAMPLE_HOTEL_HTML, url="https://grandpacific-hotel.com"
    )

    scorer = GeoScorer()
    geo_result = scorer.score(facts)

    processor = TemplateProcessor()
    all_payloads = processor.render_all_templates(facts, geo_result)

    # Must render at least 10 templates
    assert len(all_payloads) >= 10

    # Test Brand-Compliant On-Page template
    onpage_payload = all_payloads["brand-compliant-hotel-onpage"]
    assert "The Grand Pacific Hotel & Spa" in onpage_payload.renderedOutput
    assert "San Francisco" in onpage_payload.renderedOutput
    assert "Marriott Bonvoy" in onpage_payload.renderedOutput
    assert "{{hotelName}}" not in onpage_payload.renderedOutput

    # Test Meetings & Events RFP template
    rfp_payload = all_payloads["hotel-meetings-events-rfp"]
    assert "8200" in rfp_payload.renderedOutput or "18500" in rfp_payload.renderedOutput
    assert "{{grandBallroomSqFt}}" not in rfp_payload.renderedOutput

    # Test FAQ Amenities HTML template
    faq_payload = all_payloads["hotel-faq-amenities"]
    assert "$65 per night" in faq_payload.renderedOutput
    assert "4:00 PM" in faq_payload.renderedOutput
    assert "{{parkingPolicy}}" not in faq_payload.renderedOutput

    # Test Destination Guide HTML template
    guide_payload = all_payloads["hotel-destination-guide"]
    assert "San Francisco" in guide_payload.renderedOutput
    assert "{{cityName}}" not in guide_payload.renderedOutput


def test_process_property_pipeline() -> None:
    """Verify end-to-end process_property pipeline producing a compliant HotelSeoAudit."""
    processor = TemplateProcessor()
    audit, facts, geo = processor.process_property(
        SAMPLE_HOTEL_HTML, is_html=True, primary_template_id="brand-compliant-hotel-onpage"
    )

    assert isinstance(audit, HotelSeoAudit)
    assert isinstance(audit.templatePayload, TemplatePayload)
    assert audit.property.hotelName == "The Grand Pacific Hotel & Spa"
    assert audit.property.city == "San Francisco"
    assert audit.geoSignals.hasHotelSchema is True
    assert audit.geoSignals.hasFaqSchema is True
    assert audit.templatePayload.templateId == "brand-compliant-hotel-onpage"
    assert len(audit.templatePayload.renderedOutput) > 100

"""Generative Engine Optimization (GEO) Scorer.

Evaluates hospitality pages for AI search engine citation readiness across:
1. Structured fact density (distances, capacities, check-in/out times, room dimensions)
2. Direct Q&A formatting for AI Overviews, Perplexity Pro, and ChatGPT Search citations
3. Entity completeness (neighborhood, landmarks, convention centers, brand tiers)
"""

from __future__ import annotations

from typing import Any, Optional

from python.models.seo import ExtractedHotelFacts, GeoScoreResult, GeoSignals


class GeoScorer:
    """Evaluates hospitality pages on AI search and LLM citation readiness."""

    # Brand to loyalty program mapping
    LOYALTY_PROGRAMS: dict[str, str] = {
        "marriott": "Marriott Bonvoy",
        "hilton": "Hilton Honors",
        "hyatt": "World of Hyatt",
        "ihg": "IHG One Rewards",
        "wyndham": "Wyndham Rewards",
        "choice": "Choice Privileges",
        "best western": "Best Western Rewards",
    }

    def score(
        self,
        facts: ExtractedHotelFacts,
        target_brand: Optional[str] = None,
        target_city: Optional[str] = None,
    ) -> GeoScoreResult:
        """Calculate complete GEO and AI search citation readiness score."""
        # 1. Inspect Schema presence
        has_hotel_schema, has_faq_schema = self._check_schema_presence(facts.raw_json_ld)
        if facts.faq_items:
            has_faq_schema = True

        # 2. Score Structured Fact Density (0 - 100)
        fact_density_score = self._score_fact_density(facts)

        # 3. Score Direct Q&A Formatting (0 - 100)
        qa_score, qa_count = self._score_qa_formatting(facts, has_faq_schema)

        # 4. Score Entity Completeness (0 - 100) & detect missing entities
        entity_score, detected_entities, missing_entities = self._score_entity_completeness(
            facts, target_brand, target_city
        )

        # 5. Composite citation readiness score
        # 40% Fact Density + 35% Q&A Formatting + 25% Entity Completeness
        citation_readiness = (
            (fact_density_score * 0.40)
            + (qa_score * 0.35)
            + (entity_score * 0.25)
        )
        citation_readiness = round(max(0.0, min(100.0, citation_readiness)), 1)
        entity_density_score = round(max(0.0, min(100.0, (fact_density_score * 0.6) + (entity_score * 0.4))), 1)

        # 6. Generate actionable GEO recommendations
        recommendations = self._generate_recommendations(
            has_hotel_schema=has_hotel_schema,
            has_faq_schema=has_faq_schema,
            fact_density_score=fact_density_score,
            qa_score=qa_score,
            missing_entities=missing_entities,
            facts=facts,
        )

        signals = GeoSignals(
            hasHotelSchema=has_hotel_schema,
            hasFaqSchema=has_faq_schema,
            entityDensityScore=entity_density_score,
            citationReadinessScore=citation_readiness,
            missingEntities=missing_entities,
        )

        return GeoScoreResult(
            signals=signals,
            fact_density_score=round(fact_density_score, 1),
            qa_format_score=round(qa_score, 1),
            entity_completeness_score=round(entity_score, 1),
            detected_entities=detected_entities,
            qa_pairs_count=qa_count,
            recommendations=recommendations,
        )

    def _check_schema_presence(self, json_ld: list[dict[str, Any]]) -> tuple[bool, bool]:
        """Check for Schema.org/Hotel and Schema.org/FAQPage in JSON-LD."""
        has_hotel = False
        has_faq = False

        for item in json_ld:
            etype = str(item.get("@type", ""))
            if any(k in etype for k in ["Hotel", "LodgingBusiness", "Resort", "Motel", "BedAndBreakfast"]):
                has_hotel = True
            if "FAQPage" in etype:
                has_faq = True

        return has_hotel, has_faq

    def _score_fact_density(self, facts: ExtractedHotelFacts) -> float:
        """Evaluate density and completeness of quantifiable facts."""
        points = 0.0

        # Check-in and check-out times specified (up to 15 pts)
        if facts.policies.check_in_time and facts.policies.check_in_time != "4:00 PM":
            points += 7.5
        elif facts.policies.check_in_time:
            points += 5.0

        if facts.policies.check_out_time and facts.policies.check_out_time != "11:00 AM":
            points += 7.5
        elif facts.policies.check_out_time:
            points += 5.0

        # Parking policy and fee (up to 15 pts)
        if facts.policies.parking_fee and "$" in facts.policies.parking_fee:
            points += 15.0
        elif facts.policies.parking_type:
            points += 8.0

        # Pet policy and fee (up to 10 pts)
        if facts.policies.pet_fee and "$" in facts.policies.pet_fee:
            points += 10.0
        elif facts.policies.pet_policy:
            points += 5.0

        # Meeting space quantitative figures (up to 20 pts)
        ms = facts.meeting_space
        if ms.total_sq_ft and ms.total_sq_ft > 0:
            points += 8.0
        if ms.largest_ballroom_sq_ft and ms.largest_ballroom_sq_ft > 0:
            points += 6.0
        if ms.max_banquet_capacity and ms.max_banquet_capacity > 0:
            points += 6.0

        # Room types with square footage or starting rates (up to 20 pts)
        rooms_with_facts = sum(1 for r in facts.rooms if r.sq_ft or r.starting_rate)
        if rooms_with_facts >= 3:
            points += 20.0
        elif rooms_with_facts >= 1:
            points += 12.0
        elif facts.rooms:
            points += 6.0

        # Distance to airport / attractions (up to 20 pts)
        attractions_with_miles = sum(1 for a in facts.attractions if a.distance_miles is not None)
        if attractions_with_miles >= 2:
            points += 20.0
        elif attractions_with_miles >= 1:
            points += 12.0

        return min(100.0, points)

    def _score_qa_formatting(
        self, facts: ExtractedHotelFacts, has_faq_schema: bool
    ) -> tuple[float, int]:
        """Evaluate direct Q&A formatting for LLM snippet extraction."""
        score = 0.0
        qa_count = len(facts.faq_items)

        if has_faq_schema:
            score += 40.0

        if qa_count >= 5:
            score += 35.0
        elif qa_count >= 3:
            score += 25.0
        elif qa_count >= 1:
            score += 15.0

        # Evaluate conciseness of answers (30 - 65 words is optimal for AI citation)
        optimal_answers = 0
        for item in facts.faq_items:
            ans = item.get("answer", "")
            words = len(ans.split())
            if 25 <= words <= 70:
                optimal_answers += 1

        if optimal_answers >= 3:
            score += 25.0
        elif optimal_answers >= 1:
            score += 15.0

        return min(100.0, score), qa_count

    def _score_entity_completeness(
        self,
        facts: ExtractedHotelFacts,
        target_brand: Optional[str],
        target_city: Optional[str],
    ) -> tuple[float, list[str], list[str]]:
        """Verify presence of core local, geographical, and brand entities."""
        detected: list[str] = []
        missing: list[str] = []
        score = 0.0

        prop = facts.property
        brand_to_check = target_brand or prop.brand
        city_to_check = target_city or prop.city

        # 1. City / Market Entity
        if city_to_check and city_to_check != "Metropolitan Area":
            detected.append(f"City: {city_to_check}")
            score += 20.0
        else:
            missing.append("Primary City / Market Entity")

        # 2. Neighborhood / District Entity
        if prop.neighborhood and "Downtown" not in prop.neighborhood:
            detected.append(f"Neighborhood: {prop.neighborhood}")
            score += 20.0
        elif prop.neighborhood:
            detected.append(f"Neighborhood: {prop.neighborhood}")
            score += 15.0
        else:
            missing.append("Micro-Neighborhood / District Anchor")

        # 3. Brand & Loyalty Program Entity
        loyalty_found = False
        brand_lower = brand_to_check.lower()
        for k, prog in self.LOYALTY_PROGRAMS.items():
            if k in brand_lower or k in prop.hotelName.lower():
                detected.append(f"Loyalty Program: {prog}")
                loyalty_found = True
                score += 20.0
                break

        if not loyalty_found:
            if prop.brand != "Independent":
                detected.append(f"Brand: {prop.brand}")
                score += 10.0
                missing.append("Loyalty Program Tier Anchor (e.g. Bonvoy, Honors)")
            else:
                missing.append("Brand Affiliation / Independent Collection Name")

        # 4. Nearest Airport Entity
        airport_facts = [a for a in facts.attractions if a.category == "airport"]
        if airport_facts and airport_facts[0].distance_miles:
            detected.append(f"Airport: {airport_facts[0].name} ({airport_facts[0].distance_miles} mi)")
            score += 20.0
        else:
            missing.append("Airport IATA Code & Proximity in Miles")

        # 5. Convention Center or Key Landmark Entity
        venue_facts = [a for a in facts.attractions if a.category in ["convention_center", "landmark"]]
        if venue_facts and venue_facts[0].distance_miles:
            detected.append(f"Anchor Venue: {venue_facts[0].name} ({venue_facts[0].distance_miles} mi)")
            score += 20.0
        else:
            missing.append("Convention Center / Local Demand Generator Anchor")

        return min(100.0, score), detected, missing

    def _generate_recommendations(
        self,
        has_hotel_schema: bool,
        has_faq_schema: bool,
        fact_density_score: float,
        qa_score: float,
        missing_entities: list[str],
        facts: ExtractedHotelFacts,
    ) -> list[str]:
        """Compile prioritized, deterministic GEO optimization recommendations."""
        recs: list[str] = []

        if not has_hotel_schema:
            recs.append("CRITICAL: Inject valid Schema.org/Hotel JSON-LD including exact geo-coordinates, starRating, and checkinTime.")

        if not has_faq_schema:
            recs.append("HIGH: Add Schema.org/FAQPage JSON-LD containing at least 4 direct hospitality Q&As (parking, check-in, dining, airport transit).")

        if qa_score < 70:
            recs.append("HIGH: Format on-page FAQ answers to 35-60 words with direct factual answers for Google AI Overviews citation.")

        if fact_density_score < 60:
            recs.append("MEDIUM: Increase structured fact density—publish exact square footage, capacity counts, and valet pricing.")

        for miss in missing_entities:
            recs.append(f"MEDIUM: Integrate missing entity: {miss}.")

        if facts.technical_flags.title_truncated:
            recs.append(f"TECHNICAL: SERP title exceeds 60 characters ({facts.technical_flags.title_length} chars). Condense to prevent truncation.")

        if facts.technical_flags.meta_description_truncated:
            recs.append(f"TECHNICAL: Meta description exceeds 155 characters ({facts.technical_flags.meta_description_length} chars).")

        if facts.technical_flags.duplicate_h1:
            recs.append("TECHNICAL: Multiple <h1> tags detected. Consolidate into a single primary H1 for clear semantic hierarchy.")

        if facts.technical_flags.missing_alt_images_count > 0:
            recs.append(f"ACCESSIBILITY: {facts.technical_flags.missing_alt_images_count} images are missing alt attributes.")

        return recs

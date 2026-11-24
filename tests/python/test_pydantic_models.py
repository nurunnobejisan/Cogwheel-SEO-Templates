"""Tests for Pydantic data models in api/models.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from api.models import DestinationGuideModel, HotelFaqModel, PageMetadataModel, RoomShowcaseModel


def test_destination_guide_model_defaults():
    guide = DestinationGuideModel(
        hotelName="The Curtis Denver",
        cityName="Denver",
        destinationTitle="Ultimate Denver Guide",
        destinationOverview="Discover Denver culture and hospitality."
    )
    assert guide.hotelName == "The Curtis Denver"
    assert guide.brand == "Independent Collection"
    assert "lowest direct booking" in guide.bookingPerks


def test_room_showcase_model():
    room = RoomShowcaseModel(
        hotelName="The Curtis",
        cityName="Denver",
        roomTitle="Corner Penthouse",
        roomDescription="Spacious suite with floor to ceiling windows."
    )
    assert room.roomStartingRate == "Best Available Rate"
    assert "King pillow-top bed" in room.roomAmenities


def test_hotel_faq_model():
    faq = HotelFaqModel(
        hotelName="The Curtis",
        cityName="Denver"
    )
    assert "4:00 PM" in faq.checkInOutPolicy
    assert "valet parking" in faq.parkingPolicy


def test_page_metadata_model():
    meta = PageMetadataModel(
        title="Luxury Denver Hotel | The Curtis",
        metaDescription="Boutique hospitality in downtown Denver with on-site dining and games.",
        canonicalUrl="https://example.com/denver/"
    )
    assert meta.canonicalUrl == "https://example.com/denver/"
    assert meta.robotsDirective == "index, follow"


if __name__ == "__main__":
    test_destination_guide_model_defaults()
    test_room_showcase_model()
    test_hotel_faq_model()
    test_page_metadata_model()
    print("All Pydantic model tests passed successfully!")

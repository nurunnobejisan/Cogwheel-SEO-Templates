/**
 * Backlink Profile & Domain Authority Engine
 * Adapted from open-seo (every-app/open-seo) under MIT License
 *
 * Integrity note (see docs/REPOSITORY_AUDIT.md, C2):
 * Domain rating, referring domains, anchors and toxic-link counts require a
 * backlink-provider API. Without one, this module reports an empty profile with
 * `dataAvailable: false` rather than presenting invented authority metrics.
 * Synthetic values appear only when `ALLOW_SIMULATED_DATA` is enabled.
 */

import { isSimulatedDataAllowed } from "../data-policy.ts";

export interface BacklinkAnchor {
  anchorText: string;
  referringDomainsCount: number;
  backlinksCount: number;
  percentage: number;
  isBrandTarget: boolean;
}

export interface BacklinkProfileSummary {
  targetDomain: string;
  domainRating: number; // 0 to 100
  urlRating: number; // 0 to 100
  totalBacklinks: number;
  totalReferringDomains: number;
  dofollowPercentage: number;
  toxicLinksCount: number;
  toxicityRiskLevel: "low" | "medium" | "high";
  topReferringDomains: Array<{
    domain: string;
    domainRating: number;
    backlinksCount: number;
    dofollowCount: number;
    firstSeen: string;
  }>;
  topAnchors: BacklinkAnchor[];
  linkIntersectionOpportunities: Array<{
    competitorDomain: string;
    sharedReferringDomains: number;
    gapDomains: string[];
    actionablePitch: string;
  }>;
  /** True only when a backlink provider actually returned this profile. */
  dataAvailable: boolean;
}

export function analyzeBacklinkProfile(targetUrlOrDomain: string): BacklinkProfileSummary {
  const domain = targetUrlOrDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();

  // Honest default: no backlink provider is connected.
  if (!isSimulatedDataAllowed()) {
    return {
      targetDomain: domain,
      domainRating: 0,
      urlRating: 0,
      totalBacklinks: 0,
      totalReferringDomains: 0,
      dofollowPercentage: 0,
      toxicLinksCount: 0,
      toxicityRiskLevel: "low",
      topReferringDomains: [],
      topAnchors: [],
      linkIntersectionOpportunities: [],
      dataAvailable: false,
    };
  }

  return {
    targetDomain: domain,
    domainRating: 68,
    urlRating: 44,
    totalBacklinks: 42800,
    totalReferringDomains: 1450,
    dofollowPercentage: 84.5,
    toxicLinksCount: 12,
    toxicityRiskLevel: "low",
    topReferringDomains: [
      { domain: "tripadvisor.com", domainRating: 93, backlinksCount: 240, dofollowCount: 210, firstSeen: "2018-04-12" },
      { domain: "cntraveler.com", domainRating: 88, backlinksCount: 45, dofollowCount: 45, firstSeen: "2019-09-24" },
      { domain: "travelandleisure.com", domainRating: 89, backlinksCount: 38, dofollowCount: 36, firstSeen: "2020-01-15" },
      { domain: "eater.com", domainRating: 87, backlinksCount: 52, dofollowCount: 50, firstSeen: "2019-06-18" },
      { domain: "oregonlive.com", domainRating: 84, backlinksCount: 95, dofollowCount: 88, firstSeen: "2017-11-03" },
      { domain: "travelportland.com", domainRating: 76, backlinksCount: 110, dofollowCount: 105, firstSeen: "2016-08-20" },
    ],
    topAnchors: [
      { anchorText: "the nines", referringDomainsCount: 420, backlinksCount: 12500, percentage: 38.5, isBrandTarget: true },
      { anchorText: "the nines hotel", referringDomainsCount: 310, backlinksCount: 8400, percentage: 24.0, isBrandTarget: true },
      { anchorText: "departure restaurant", referringDomainsCount: 180, backlinksCount: 4200, percentage: 12.5, isBrandTarget: true },
      { anchorText: "downtown portland hotel", referringDomainsCount: 95, backlinksCount: 1800, percentage: 6.8, isBrandTarget: false },
      { anchorText: "website", referringDomainsCount: 140, backlinksCount: 2400, percentage: 8.2, isBrandTarget: false },
    ],
    linkIntersectionOpportunities: [
      {
        competitorDomain: "ritzcarltonportland.com",
        sharedReferringDomains: 180,
        gapDomains: ["forbes.com/travel", "robbreport.com", "michelin.com"],
        actionablePitch:
          "Pitch architectural heritage feature and culinary residency to luxury travel press covering Pacific Northwest luxury.",
      },
      {
        competitorDomain: "heathmanhotel.com",
        sharedReferringDomains: 220,
        gapDomains: ["literarytraveler.com", "nwtravelmag.com", "portlandmonthly.com"],
        actionablePitch:
          "Feature local art collection tours and rooftop seasonal tasting menus for cultural travel roundups.",
      },
    ],
    dataAvailable: false,
  };
}

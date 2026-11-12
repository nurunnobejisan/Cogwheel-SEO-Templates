import type { TemplateId } from "@/lib/types";

export interface ReportTemplate {
  id: TemplateId;
  name: string;
  clients: string;
  description: string;
  sections: string[];
  tableColumns: string[];
  rationaleHeading: string;
  rationaleStyle: "bullets" | "paragraphs";
  includeCurrentSitemap: boolean;
  usesSecondaryKeywords: boolean;
}

export const TEMPLATES: Record<TemplateId, ReportTemplate> = {
  A: {
    id: "A",
    name: "Format A — Standard",
    clients: "Catbird / Arrive",
    description: "2-column Page | Keyword table followed by “Why did we do this?” bullets.",
    sections: ["Keyword Table", "Why did we do this?"],
    tableColumns: ["Page", "Keyword"],
    rationaleHeading: "Why did we do this?",
    rationaleStyle: "bullets",
    includeCurrentSitemap: false,
    usesSecondaryKeywords: false,
  },
  B: {
    id: "B",
    name: "Format B — Cogwheel",
    clients: "Reitz Union / Cogwheel",
    description: "Current Sitemap section, 3-column Page | Keyword | Secondary table, then Comments paragraphs.",
    sections: ["Current Sitemap", "Keyword Table", "Comments"],
    tableColumns: ["Page", "Keyword", "Secondary"],
    rationaleHeading: "Comments",
    rationaleStyle: "paragraphs",
    includeCurrentSitemap: true,
    usesSecondaryKeywords: true,
  },
};


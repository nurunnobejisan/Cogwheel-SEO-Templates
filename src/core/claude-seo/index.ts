import fs from "node:fs";
import path from "node:path";

export interface GoogleAlgorithmUpdate {
  date: string;
  name: string;
  kind: string;
  source: string;
  notes?: string;
}

export interface ClaudeSeoAgentInfo {
  id: string;
  name: string;
  filename: string;
  category: string;
  description: string;
}

export function loadGoogleAlgorithmUpdates(): GoogleAlgorithmUpdate[] {
  try {
    const dataPath = path.resolve(process.cwd(), "data/google-updates.json");
    if (!fs.existsSync(dataPath)) return [];
    const raw = fs.readFileSync(dataPath, "utf-8");
    const json = JSON.parse(raw);
    return json.updates || [];
  } catch {
    return [];
  }
}

export const getGoogleUpdates = loadGoogleAlgorithmUpdates;

export function getLatestGoogleUpdates(limit: number = 5): GoogleAlgorithmUpdate[] {
  const updates = loadGoogleAlgorithmUpdates();
  return updates.slice(-limit).reverse();
}

export function listClaudeSeoAgents(): ClaudeSeoAgentInfo[] {
  const agentsDir = path.resolve(process.cwd(), "src/core/claude-seo/agents");
  if (!fs.existsSync(agentsDir)) return [];

  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  return files.map((file) => {
    const id = file.replace(/\.md$/, "");
    const name = id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    return {
      id,
      name,
      filename: file,
      category: id.includes("technical") || id.includes("sitemap") || id.includes("performance")
        ? "Technical SEO"
        : id.includes("geo") || id.includes("sxo") || id.includes("visual")
        ? "AI Search & UX"
        : id.includes("content") || id.includes("cluster")
        ? "Content Strategy"
        : "Platform & Strategy",
      description: `Specialized autonomous SEO agent for ${name.replace("Seo ", "")}.`,
    };
  });
}

export function getSpecializedAgentsList(): string[] {
  return listClaudeSeoAgents().map((a) => a.id);
}

export function getClaudeSeoAgentPrompt(agentId: string): string | null {
  const filePath = path.resolve(process.cwd(), `src/core/claude-seo/agents/${agentId}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

export function checkAlgorithmImpact(domain: string): {
  domain: string;
  potentiallyImpacted: boolean;
  recentUpdates: GoogleAlgorithmUpdate[];
  riskRating: "low" | "medium" | "high";
  recommendations: string[];
} {
  const updates = loadGoogleAlgorithmUpdates();
  const recent = updates.slice(-4).reverse();
  return {
    domain,
    potentiallyImpacted: false,
    recentUpdates: recent,
    riskRating: "low",
    recommendations: [
      "Maintain authentic, first-party content satisfying direct search intent.",
      "Ensure fast Core Web Vitals and eliminate intrusive interstitials.",
      "Verify that author credentials and digital entity links are present.",
    ],
  };
}

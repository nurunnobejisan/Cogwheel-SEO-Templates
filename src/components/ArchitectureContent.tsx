"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Cpu, Database, ExternalLink, FileCode2, ShieldCheck } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/index";

const SUBSYSTEMS = [
  {
    step: "Subsystem 1",
    title: "Deterministic SERP pixel engine",
    description:
      "Variable-width Arial glyph tables evaluate titles against the 580 px desktop ceiling and meta descriptions against the 920 px snippet threshold with physical precision.",
    path: "src/engine/pixelCalculator.ts",
    icon: Cpu,
  },
  {
    step: "Subsystem 2",
    title: "Brand standards & suffix guardrails",
    description:
      "Lexical scanner enforcing franchise title caps and prohibiting discount terminology across Marriott, Hilton, IHG, Hyatt, and independent portfolios.",
    path: "src/engine/brandGuardrails.ts",
    icon: ShieldCheck,
  },
  {
    step: "Subsystem 3",
    title: "AI training data vault & PII redactor",
    description:
      "Read-only DOM extractor that strips emails, telephone numbers, and URL auth query tokens into SHA-256 deduplicated records with 0–100 quality scoring.",
    path: "shared/ts/training-capture.ts · shared/ts/training-vault.ts",
    icon: Database,
  },
  {
    step: "Subsystem 4",
    title: "Custom model client & fallback router",
    description:
      "Multi-provider client dispatching to Google Vertex AI / tuned Gemini, custom REST vLLM endpoints, or Ollama, with automated fallback to local rules.",
    path: "chrome-extension/src/engine/custom-model-client.ts",
    icon: FileCode2,
  },
];

const PIPELINE_STAGES = [
  { label: "Browser DOM", detail: "Read-only capture", x: 20 },
  { label: "Pixel & Brand Gate", detail: "580 px · Guardrails", x: 215 },
  { label: "PII Vault & Schema", detail: "JSON-LD · Redacted", x: 410 },
  { label: "Inference Router", detail: "Vertex · Rules fallback", x: 605 },
];

export interface ArchitectureContentProps {
  showHeader?: boolean;
}

/**
 * Shared System Architecture documentation & responsive SVG topology diagram
 * used cleanly by both /architecture and developer Labs.
 */
export function ArchitectureContent({ showHeader = true }: ArchitectureContentProps) {
  const prefersReduced = useReducedMotion();

  return (
    <div className="space-y-6">
      {showHeader && (
        <header className="space-y-2">
          <Badge variant="notice">Manifest V3 · React 18 · Python 3.11+</Badge>
          <h2 className="text-title text-text">System Architecture &amp; Technical Specifications</h2>
          <p className="max-w-[72ch] text-body text-text-muted">
            Engineering specifications detailing client-side inspection boundaries, physical pixel calculation tables, AI training data collection, hybrid inference routing, and Python fine-tuning pipelines.
          </p>
        </header>
      )}

      {/* Responsive Interactive Pipeline Flow */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-heading">Telemetry pipeline topology</CardTitle>
            <p className="mt-0.5 text-caption text-text-muted">
              Deterministic rules inspect DOM inputs before sanitized records route to fine-tuned inference.
            </p>
          </div>
          <a
            href="/system-architecture.svg"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-caption font-medium text-link hover:underline"
          >
            <span>Open full topology SVG</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-sm border border-border bg-sidebar p-3">
            <svg
              viewBox="0 0 780 124"
              className="h-auto w-full"
              role="img"
              aria-label="Four-stage architecture telemetry pipeline diagram"
            >
              {PIPELINE_STAGES.slice(0, -1).map((stage, idx) => (
                <g key={stage.label}>
                  <line
                    x1={stage.x + 155}
                    y1={62}
                    x2={PIPELINE_STAGES[idx + 1].x}
                    y2={62}
                    stroke="rgb(var(--border-strong))"
                    strokeWidth="2"
                  />
                  {!prefersReduced && (
                    <motion.circle
                      r="3.5"
                      cy={62}
                      fill="rgb(var(--brand))"
                      animate={{
                        cx: [stage.x + 155, PIPELINE_STAGES[idx + 1].x],
                        opacity: [0.3, 1, 0.3],
                      }}
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                        delay: idx * 0.35,
                        ease: "linear",
                      }}
                    />
                  )}
                </g>
              ))}

              {PIPELINE_STAGES.map((stage) => (
                <g key={stage.label}>
                  <rect
                    x={stage.x}
                    y={24}
                    width="155"
                    height="76"
                    rx="6"
                    fill="rgb(var(--sidebar-active))"
                    stroke="rgb(var(--border-strong))"
                    strokeWidth="1"
                  />
                  <text
                    x={stage.x + 14}
                    y={54}
                    fill="rgb(var(--sidebar-text))"
                    fontSize="13"
                    fontWeight="600"
                    fontFamily="var(--font-geist-sans), sans-serif"
                  >
                    {stage.label}
                  </text>
                  <text
                    x={stage.x + 14}
                    y={76}
                    fill="rgb(var(--brand))"
                    fontSize="11"
                    fontFamily="var(--font-geist-mono), monospace"
                  >
                    {stage.detail}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="w-full overflow-x-auto rounded-sm border border-border bg-sidebar p-3">
            <Image
              src="/system-architecture.svg"
              alt="SEO Studio System Architecture Diagram"
              width={1200}
              height={780}
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="w-full min-w-[640px] rounded-sm"
              priority
            />
          </div>
        </CardContent>
      </Card>

      {/* Core Subsystems Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {SUBSYSTEMS.map((sub) => {
          const Icon = sub.icon;
          return (
            <Card key={sub.step} className="flex flex-col justify-between p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-overline uppercase text-text-muted">{sub.step}</span>
                  <Icon className="h-4 w-4 text-text-muted" aria-hidden="true" />
                </div>
                <h3 className="text-heading text-text">{sub.title}</h3>
                <p className="max-w-[72ch] text-caption text-text-muted">{sub.description}</p>
              </div>
              <div className="mt-4 border-t border-border pt-3 font-mono text-caption text-text-subtle">
                <code>{sub.path}</code>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

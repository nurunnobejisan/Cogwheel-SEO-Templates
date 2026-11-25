import { PageContext } from '../../content/context-extractor';
import { SiteConfig } from '../config/site-config';

export interface AuditIssue {
  issueId: string;
  category: 'metadata' | 'schema' | 'content' | 'performance' | 'accessibility' | 'geo';
  severity: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high'; // Drives Phase 4 Auto-Pilot vs Manual Gate
  fixable: boolean;
  cmsTargetField?: string;
  context: {
    currentValue: unknown;
    selector?: string;
    recommendedAction: string;
  };
}

export interface AuditTool {
  name: string;
  run: (ctx: PageContext, config: SiteConfig) => Promise<AuditIssue[]>;
}

export interface UnifiedAuditReport {
  auditId: string;
  domain: string;
  pageUrl: string;
  timestamp: string;
  engine: 'hospitality' | 'universal';
  siteType: SiteConfig['siteType'];
  issues: AuditIssue[];
  generatedArtifacts?: {
    metaTitle: string;
    metaDescription: string;
    jsonLd: Record<string, unknown>;
    geoCitationBlock: string;
  };
}

export class CentralAuditOrchestrator {
  private tools: AuditTool[] = [];

  constructor(
    private readonly concurrencyLimit = 2,
    private readonly throttleDelayMs = 120
  ) {}

  registerTool(tool: AuditTool): void {
    this.tools.push(tool);
  }

  async execute(
    ctx: PageContext,
    config: SiteConfig,
    engine: 'hospitality' | 'universal',
    artifacts?: UnifiedAuditReport['generatedArtifacts']
  ): Promise<UnifiedAuditReport> {
    const allIssues: AuditIssue[] = [];

    for (let i = 0; i < this.tools.length; i += this.concurrencyLimit) {
      const batch = this.tools.slice(i, i + this.concurrencyLimit);
      const batchResults = await Promise.allSettled(
        batch.map((tool) =>
          Promise.race([
            tool.run(ctx, config),
            new Promise<AuditIssue[]>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout in ${tool.name}`)), 5_000)
            ),
          ])
        )
      );

      for (const res of batchResults) {
        if (res.status === 'fulfilled') {
          allIssues.push(...res.value);
        }
      }

      if (i + this.concurrencyLimit < this.tools.length) {
        await new Promise((r) => setTimeout(r, this.throttleDelayMs));
      }
    }

    return {
      auditId: `aud_${Date.now()}_${engine.slice(0, 4)}`,
      domain: ctx.domain,
      pageUrl: ctx.url,
      timestamp: new Date().toISOString(),
      engine,
      siteType: config.siteType,
      issues: allIssues,
      generatedArtifacts: artifacts,
    };
  }
}

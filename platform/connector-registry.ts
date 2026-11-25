/**
 * Connector Registry (Phase 5)
 *
 * Resolves the bound `CmsConnector` for a target URL at deploy/undo time. The
 * gateway stays platform-agnostic; production wires this to the Phase 3
 * credential→connector factory, while tests register fakes directly.
 */

import type { CmsConnector } from "../cms/types.ts";

export interface ConnectorRegistry {
  register(targetUrl: string, connector: CmsConnector): void;
  resolve(targetUrl: string): CmsConnector | null;
  targets(): string[];
  clear(): void;
}

export function createConnectorRegistry(): ConnectorRegistry {
  const connectors = new Map<string, CmsConnector>();
  return {
    register(targetUrl, connector) {
      connectors.set(targetUrl, connector);
    },
    resolve(targetUrl) {
      return connectors.get(targetUrl) ?? null;
    },
    targets() {
      return [...connectors.keys()];
    },
    clear() {
      connectors.clear();
    },
  };
}
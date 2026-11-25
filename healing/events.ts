/**
 * Healing Event Log (Phase 4)
 *
 * An observable stream of pipeline events (scan → synthesize → approve →
 * deploy → verify → rollback) consumed by the Chrome-extension operator
 * dashboard to surface progress and alerts.
 */

import type { HealingEvent, HealingEventType } from "./types.ts";

export interface EmitInput {
  type: HealingEventType;
  message: string;
  level?: HealingEvent["level"];
  patchId?: string;
  targetUrl?: string;
  at?: string;
  data?: Record<string, unknown>;
}

export interface HealingEventBus {
  emit(input: EmitInput): HealingEvent;
  all(): HealingEvent[];
  byType(type: HealingEventType): HealingEvent[];
  alerts(): HealingEvent[];
  subscribe(listener: (event: HealingEvent) => void): () => void;
}

const ALERT_TYPES: HealingEventType[] = ["alert", "rolled_back", "rejected"];

let counter = 0;

function nextId(): string {
  counter += 1;
  return `evt_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createHealingEventBus(now: () => string = () => new Date().toISOString()): HealingEventBus {
  const events: HealingEvent[] = [];
  const listeners = new Set<(event: HealingEvent) => void>();

  return {
    emit(input) {
      const event: HealingEvent = {
        id: nextId(),
        type: input.type,
        level: input.level ?? (ALERT_TYPES.includes(input.type) ? "warning" : "info"),
        message: input.message,
        patchId: input.patchId,
        targetUrl: input.targetUrl,
        at: input.at ?? now(),
        data: input.data,
      };
      events.push(event);
      for (const listener of listeners) {
        listener(event);
      }
      return event;
    },

    all() {
      return [...events];
    },

    byType(type) {
      return events.filter((event) => event.type === type);
    },

    alerts() {
      return events.filter((event) => event.level === "error" || ALERT_TYPES.includes(event.type));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

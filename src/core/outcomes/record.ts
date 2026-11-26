/**
 * Recording change events.
 *
 * `recordChange` derives a deterministic `ChangeEvent` from a deployment and
 * appends it to the log exactly once (re-runs and retries are idempotent). It is
 * shared by the outcomes API and the platform deployment route so both seams
 * track changes identically.
 */

import { changeEventFromDeployment, type DeploymentChangeInput } from "./index.ts";
import { appendChange, readChanges } from "./store.ts";
import type { ChangeEvent } from "./types.ts";

export interface RecordChangeResult {
  change: ChangeEvent;
  /** True when an event with the same id already existed. */
  duplicate: boolean;
}

export async function recordChange(input: DeploymentChangeInput): Promise<RecordChangeResult> {
  const change = changeEventFromDeployment(input);
  const existing = await readChanges();
  if (existing.some((entry) => entry.id === change.id)) {
    return { change, duplicate: true };
  }
  await appendChange(change);
  return { change, duplicate: false };
}

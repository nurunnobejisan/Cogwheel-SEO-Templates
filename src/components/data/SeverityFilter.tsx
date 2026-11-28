"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Badge, Button, Checkbox, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/index";
import { StatusIcon } from "./StatusIcon";

export type AuditSeverity = "error" | "warning" | "notice";

const SEVERITY_OPTIONS: Array<{ id: AuditSeverity; label: string }> = [
  { id: "error", label: "Error" },
  { id: "warning", label: "Warning" },
  { id: "notice", label: "Notice" },
];

export interface SeverityFilterProps {
  selected: AuditSeverity[];
  onChange: (next: AuditSeverity[]) => void;
  counts?: Partial<Record<AuditSeverity, number>>;
}

/**
 * Multi-select severity filter popover with live selection count chip.
 */
export function SeverityFilter({ selected, onChange, counts }: SeverityFilterProps) {
  const toggle = (id: AuditSeverity) => {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" icon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />}>
          <span>Severity</span>
          {selected.length > 0 && selected.length < 3 && (
            <Badge variant="brand" className="nums ml-0.5 px-1.5">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-overline uppercase text-text-muted">Severity</span>
          <button
            type="button"
            onClick={() => onChange(["error", "warning", "notice"])}
            className="text-caption font-medium text-link hover:underline"
          >
            Reset
          </button>
        </div>
        <div className="space-y-2.5">
          {SEVERITY_OPTIONS.map((opt) => (
            <div key={opt.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`sev-${opt.id}`}
                  checked={selected.includes(opt.id)}
                  onCheckedChange={() => toggle(opt.id)}
                />
                <label
                  htmlFor={`sev-${opt.id}`}
                  className="flex cursor-pointer items-center gap-1.5 text-body text-text select-none"
                >
                  <StatusIcon status={opt.id} />
                  <span>{opt.label}</span>
                </label>
              </div>
              {typeof counts?.[opt.id] === "number" && (
                <span className="nums text-caption text-text-muted">{counts[opt.id]?.toLocaleString()}</span>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

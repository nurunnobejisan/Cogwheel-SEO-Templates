"use client";

import { useMemo, useState } from "react";
import type { MatrixRow, PoolEntry, SitemapPage, TemplateId } from "@/lib/types";
import { Button, Card, FlagBadge, KdPill } from "./ui";

interface Props {
  matrix: MatrixRow[];
  pages: SitemapPage[];
  pool: PoolEntry[];
  reserve: PoolEntry[];
  template: TemplateId;
  onAssign: (pageId: string, slot: "primary" | "secondary", keywordId: string | null) => void;
  onInlineEdit: (
    pageId: string,
    slot: "primary" | "secondary",
    patch: { keyword: string; volume?: number; kd?: number | null },
  ) => void;
  onApprove: (pageId: string | "all", approved: boolean) => void;
}

export function ApprovalMatrix({
  matrix,
  pages,
  pool,
  reserve,
  template,
  onAssign,
  onInlineEdit,
  onApprove,
}: Props) {
  const [editing, setEditing] = useState<{ pageId: string; slot: "primary" | "secondary" } | null>(null);
  const [draftKw, setDraftKw] = useState("");
  const [draftVol, setDraftVol] = useState("");
  const [draftKd, setDraftKd] = useState("");

  const approved = matrix.filter((r) => r.status === "approved").length;
  const taken = useMemo(() => {
    const s = new Set<string>();
    matrix.forEach((r) => {
      if (r.primary) s.add(r.primary.id);
      if (r.secondary) s.add(r.secondary.id);
    });
    return s;
  }, [matrix]);
  const all = useMemo(() => [...pool, ...reserve], [pool, reserve]);

  const startEdit = (pageId: string, slot: "primary" | "secondary", current: MatrixRow["primary"]) => {
    setEditing({ pageId, slot });
    setDraftKw(current?.keyword ?? "");
    setDraftVol(current ? String(current.volume) : "0");
    setDraftKd(current?.kd !== null && current?.kd !== undefined ? String(current.kd) : "");
  };

  const commitEdit = () => {
    if (!editing || !draftKw.trim()) return;
    const volume = Number.isFinite(Number(draftVol)) ? Math.max(0, Math.round(Number(draftVol))) : 0;
    const kdTrim = draftKd.trim();
    const kd = kdTrim === "" ? null : Number.isFinite(Number(kdTrim)) ? Number(kdTrim) : null;
    onInlineEdit(editing.pageId, editing.slot, { keyword: draftKw, volume, kd });
    setEditing(null);
  };

  return (
    <Card
      title="3b. Page-to-Keyword Approval Matrix"
      subtitle={`Editable checkpoint — ${approved}/${matrix.length} approved. Use dropdown overrides or inline edit; exceptions are flagged, never auto-approved.`}
      actions={
        <>
          <Button variant="secondary" onClick={() => onApprove("all", false)}>Reset approvals</Button>
          <Button onClick={() => onApprove("all", true)} disabled={matrix.some((r) => !r.primary)}>
            Approve all
          </Button>
        </>
      }
    >
      <div className="overflow-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[920px]">
          <thead>
            <tr>
              <th className="th">Page</th>
              <th className="th">Primary keyword</th>
              <th className="th w-20 text-right">Volume</th>
              <th className="th w-14 text-right">KD</th>
              {template === "B" && <th className="th">Secondary</th>}
              <th className="th">Flags</th>
              <th className="th w-24 text-center">Approve</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => {
              const page = pages.find((p) => p.id === row.pageId);
              const inBuckets = all.filter((k) => page?.buckets.includes(k.bucketId ?? "") && !taken.has(k.id)).slice(0, 150);
              const options = (current: MatrixRow["primary"]) => (
                <>
                  <option value="">— none —</option>
                  {current && <option value={current.id}>{current.keyword} ({current.volume})</option>}
                  {row.alternatives.filter((a) => !taken.has(a.id)).length > 0 && (
                    <optgroup label="Suggested alternatives">
                      {row.alternatives.filter((a) => !taken.has(a.id)).map((a) => (
                        <option key={a.id} value={a.id}>{a.keyword} ({a.volume} · KD {a.kd ?? "N/A"})</option>
                      ))}
                    </optgroup>
                  )}
                  {row.exceptionCandidate && !taken.has(row.exceptionCandidate.id) && (
                    <optgroup label="High-SV exception (KD ≥ 45)">
                      <option value={row.exceptionCandidate.id}>
                        {row.exceptionCandidate.keyword} ({row.exceptionCandidate.volume} · KD {row.exceptionCandidate.kd})
                      </option>
                    </optgroup>
                  )}
                  <optgroup label="All keywords in page buckets">
                    {inBuckets.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.keyword} ({k.volume} · KD {k.kd ?? "N/A"}){k.role === "reserve" ? " · reserve" : ""}
                      </option>
                    ))}
                  </optgroup>
                </>
              );
              const isApproved = row.status === "approved";
              const isEditingPrimary = editing?.pageId === row.pageId && editing.slot === "primary";
              const isEditingSecondary = editing?.pageId === row.pageId && editing.slot === "secondary";

              return (
                <tr key={row.pageId} className={isApproved ? "bg-emerald-50/50" : ""}>
                  <td className="td">
                    <div className="font-medium">{row.title}</div>
                    <div className="font-mono text-xs text-slate-400">{row.path}</div>
                  </td>
                  <td className="td">
                    {isEditingPrimary ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          className="input min-w-[180px] flex-1 py-1 text-xs"
                          value={draftKw}
                          onChange={(e) => setDraftKw(e.target.value)}
                          placeholder="Custom keyword"
                          autoFocus
                        />
                        <input
                          className="input w-20 py-1 text-xs"
                          value={draftVol}
                          onChange={(e) => setDraftVol(e.target.value)}
                          placeholder="SV"
                          title="Search Volume"
                        />
                        <input
                          className="input w-16 py-1 text-xs"
                          value={draftKd}
                          onChange={(e) => setDraftKd(e.target.value)}
                          placeholder="KD"
                          title="KD (leave blank for N/A)"
                        />
                        <Button className="px-2 py-1 text-xs" onClick={commitEdit}>Save</Button>
                        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <select
                          className="input py-1"
                          value={row.primary?.id ?? ""}
                          disabled={isApproved}
                          onChange={(e) => onAssign(row.pageId, "primary", e.target.value || null)}
                        >
                          {options(row.primary)}
                        </select>
                        {!isApproved && (
                          <Button
                            variant="ghost"
                            className="shrink-0 px-2 py-1 text-xs"
                            title="Inline edit custom keyword"
                            onClick={() => startEdit(row.pageId, "primary", row.primary)}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    )}
                    {row.exceptionCandidate && (
                      <div className="mt-1 text-xs text-violet-700">
                        Exception available: <strong>{row.exceptionCandidate.keyword}</strong> — {row.exceptionCandidate.volume} SV, KD {row.exceptionCandidate.kd}
                      </div>
                    )}
                  </td>
                  <td className="td text-right tabular-nums">{row.primary?.volume.toLocaleString() ?? "—"}</td>
                  <td className="td text-right">{row.primary ? <KdPill kd={row.primary.kd} /> : "—"}</td>
                  {template === "B" && (
                    <td className="td">
                      {isEditingSecondary ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            className="input min-w-[150px] flex-1 py-1 text-xs"
                            value={draftKw}
                            onChange={(e) => setDraftKw(e.target.value)}
                            placeholder="Secondary keyword"
                            autoFocus
                          />
                          <input
                            className="input w-16 py-1 text-xs"
                            value={draftVol}
                            onChange={(e) => setDraftVol(e.target.value)}
                            placeholder="SV"
                          />
                          <input
                            className="input w-14 py-1 text-xs"
                            value={draftKd}
                            onChange={(e) => setDraftKd(e.target.value)}
                            placeholder="KD"
                          />
                          <Button className="px-2 py-1 text-xs" onClick={commitEdit}>Save</Button>
                          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <select
                            className="input py-1"
                            value={row.secondary?.id ?? ""}
                            disabled={isApproved}
                            onChange={(e) => onAssign(row.pageId, "secondary", e.target.value || null)}
                          >
                            {options(row.secondary)}
                          </select>
                          {!isApproved && (
                            <Button
                              variant="ghost"
                              className="shrink-0 px-2 py-1 text-xs"
                              title="Inline edit secondary keyword"
                              onClick={() => startEdit(row.pageId, "secondary", row.secondary)}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      )}
                      {row.secondary && (
                        <div className="mt-1 text-xs text-slate-500">
                          {row.secondary.volume.toLocaleString()} SV · KD {row.secondary.kd ?? "N/A"}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {row.flags.map((f) => (
                        <FlagBadge key={f} flag={f} />
                      ))}
                    </div>
                  </td>
                  <td className="td text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={isApproved}
                      disabled={!row.primary}
                      onChange={(e) => onApprove(row.pageId, e.target.checked)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

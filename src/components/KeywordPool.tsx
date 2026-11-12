"use client";

import { useMemo, useState } from "react";
import { BUCKETS } from "@/lib/engine/bucket";
import type { BucketSummary, DroppedRow, PoolEntry } from "@/lib/types";
import { Button, Card, FlagBadge, KdPill } from "./ui";

type Tab = "pool" | "bucket-tables" | "reserve" | "buckets" | "dropped";

interface Props {
  pool: PoolEntry[];
  reserve: PoolEntry[];
  quota: number;
  summary: BucketSummary[];
  dropped: DroppedRow[];
  onRemove: (id: string) => void;
  onAdd: (id: string) => void;
  onUpdateKeyword: (
    id: string,
    patch: { keyword?: string; volume?: number; kd?: number | null; bucketId?: string; bucketName?: string },
  ) => void;
}

const ROLE_STYLE: Record<PoolEntry["role"], string> = {
  primary: "bg-hilton text-white",
  secondary: "bg-hilton-light text-hilton",
  fill: "bg-slate-100 text-slate-600",
  reserve: "bg-white text-slate-400 border border-slate-200",
};

export function KeywordPool({ pool, reserve, quota, summary, dropped, onRemove, onAdd, onUpdateKeyword }: Props) {
  const [tab, setTab] = useState<Tab>("pool");
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftKw, setDraftKw] = useState("");
  const [draftVol, setDraftVol] = useState("");
  const [draftKd, setDraftKd] = useState("");

  const poolByBucket = useMemo(() => {
    const m = new Map<string, PoolEntry[]>();
    pool.forEach((k) => {
      const id = k.bucketId ?? "unassigned";
      const list = m.get(id) ?? [];
      list.push(k);
      m.set(id, list);
    });
    return m;
  }, [pool]);

  const bucketGroups = useMemo(() => {
    const groups: Array<{ id: string; name: string; rows: PoolEntry[] }> = BUCKETS.map((b) => ({
      id: b.id,
      name: b.name,
      rows: poolByBucket.get(b.id) ?? [],
    }));
    for (const [id, rows] of poolByBucket.entries()) {
      if (!groups.some((g) => g.id === id)) {
        groups.push({ id, name: rows[0]?.bucketName ?? id, rows });
      }
    }
    return groups;
  }, [poolByBucket]);

  const filter = <T extends { keyword: string; bucketId?: string }>(rows: T[]) =>
    rows.filter((r) => (!q || r.keyword.includes(q.toLowerCase())) && (!bucket || r.bucketId === bucket));

  const startEdit = (k: PoolEntry) => {
    setEditingId(k.id);
    setDraftKw(k.keyword);
    setDraftVol(String(k.volume));
    setDraftKd(k.kd === null ? "" : String(k.kd));
  };

  const commitEdit = (id: string) => {
    if (!draftKw.trim()) return;
    const volume = Number.isFinite(Number(draftVol)) ? Math.max(0, Math.round(Number(draftVol))) : 0;
    const kdTrim = draftKd.trim();
    const kd = kdTrim === "" ? null : Number.isFinite(Number(kdTrim)) ? Number(kdTrim) : null;
    onUpdateKeyword(id, { keyword: draftKw, volume, kd });
    setEditingId(null);
  };

  const tabs: Array<[Tab, string]> = [
    ["pool", `78-KW Pool (${pool.length}/${quota})`],
    ["bucket-tables", "Bucket Tables"],
    ["reserve", `Reserve (${reserve.length})`],
    ["buckets", `Summary (${summary.length})`],
    ["dropped", `Dropped (${dropped.length})`],
  ];

  return (
    <Card
      title="3a. Keyword Pool & Bucket Tables"
      subtitle="Primaries → secondaries (Format B) → fill by Volume DESC up to the quota. Empty buckets show No Data in the report."
      actions={
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {(tab === "pool" || tab === "reserve") && (
        <div className="mb-3 flex flex-wrap gap-2">
          <input className="input max-w-xs py-1.5" placeholder="Search keyword…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input max-w-[220px] py-1.5" value={bucket} onChange={(e) => setBucket(e.target.value)}>
            <option value="">All buckets</option>
            {summary.map((s) => (
              <option key={s.bucketId} value={s.bucketId}>{s.bucketName}</option>
            ))}
          </select>
        </div>
      )}

      {tab === "bucket-tables" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {bucketGroups.map((g) => (
            <div key={g.id} className="overflow-hidden rounded-md border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm font-semibold text-slate-800">{g.name}</span>
                <span className="text-xs text-slate-500">{g.rows.length} {g.rows.length === 1 ? "keyword" : "keywords"}</span>
              </div>
              {g.rows.length === 0 ? (
                <div className="px-3 py-3 text-xs italic text-slate-400">No Data</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">Keyword</th>
                      <th className="th w-16 text-right">SV</th>
                      <th className="th w-14 text-right">KD</th>
                      <th className="th w-28">Bucket</th>
                      <th className="th w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((k) => (
                      <tr key={k.id}>
                        <td className="td text-xs">
                          {editingId === k.id ? (
                            <input
                              className="input py-0.5 text-xs"
                              value={draftKw}
                              onChange={(e) => setDraftKw(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            <span>{k.keyword}</span>
                          )}
                        </td>
                        <td className="td text-right text-xs tabular-nums">
                          {editingId === k.id ? (
                            <input className="input w-16 py-0.5 text-right text-xs" value={draftVol} onChange={(e) => setDraftVol(e.target.value)} />
                          ) : (
                            k.volume.toLocaleString()
                          )}
                        </td>
                        <td className="td text-right text-xs">
                          {editingId === k.id ? (
                            <input className="input w-12 py-0.5 text-right text-xs" value={draftKd} onChange={(e) => setDraftKd(e.target.value)} />
                          ) : (
                            <KdPill kd={k.kd} />
                          )}
                        </td>
                        <td className="td">
                          <select
                            className="input py-0.5 text-xs"
                            value={k.bucketId ?? ""}
                            onChange={(e) => {
                              const next = BUCKETS.find((b) => b.id === e.target.value);
                              if (next) onUpdateKeyword(k.id, { bucketId: next.id, bucketName: next.name });
                            }}
                          >
                            {BUCKETS.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="td text-right">
                          {editingId === k.id ? (
                            <div className="flex justify-end gap-1">
                              <Button className="px-1.5 py-0.5 text-[11px]" onClick={() => commitEdit(k.id)}>Save</Button>
                              <Button variant="ghost" className="px-1.5 py-0.5 text-[11px]" onClick={() => setEditingId(null)}>×</Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" className="px-1.5 py-0.5 text-[11px]" onClick={() => startEdit(k)}>Edit</Button>
                              {k.role === "fill" && (
                                <Button variant="danger" className="px-1.5 py-0.5 text-[11px]" onClick={() => onRemove(k.id)}>×</Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto rounded-md border border-slate-200">
          {tab === "pool" && (
            <KeywordTable
              rows={filter(pool)}
              numbered
              editingId={editingId}
              draftKw={draftKw}
              draftVol={draftVol}
              draftKd={draftKd}
              onDraftKw={setDraftKw}
              onDraftVol={setDraftVol}
              onDraftKd={setDraftKd}
              onCommit={commitEdit}
              onCancel={() => setEditingId(null)}
              onBucketChange={(id, bId) => {
                const next = BUCKETS.find((b) => b.id === bId);
                if (next) onUpdateKeyword(id, { bucketId: next.id, bucketName: next.name });
              }}
              action={(k) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={() => startEdit(k)}>Edit</Button>
                  {k.role === "fill" && (
                    <Button variant="danger" className="px-2 py-0.5 text-xs" onClick={() => onRemove(k.id)}>Remove</Button>
                  )}
                </div>
              )}
            />
          )}
          {tab === "reserve" && (
            <KeywordTable
              rows={filter(reserve).slice(0, 500)}
              action={(k) => <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={() => onAdd(k.id)}>+ Add</Button>}
            />
          )}
          {tab === "buckets" && (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Bucket</th>
                  <th className="th text-right">Keywords</th>
                  <th className="th text-right">In pool</th>
                  <th className="th text-right">Total volume</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.bucketId}>
                    <td className="td">
                      {s.bucketName}
                      {s.bucketId.startsWith("custom:") && <span className="ml-2 text-xs text-slate-400">(from filename/group)</span>}
                    </td>
                    <td className="td text-right tabular-nums">{s.count}</td>
                    <td className="td text-right tabular-nums">{poolByBucket.get(s.bucketId)?.length ?? 0}</td>
                    <td className="td text-right tabular-nums">{s.totalVolume.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "dropped" && (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Keyword</th>
                  <th className="th">Reason</th>
                  <th className="th">Detail</th>
                  <th className="th text-right">Volume</th>
                  <th className="th text-right">KD</th>
                </tr>
              </thead>
              <tbody>
                {dropped.slice(0, 1000).map((d, i) => (
                  <tr key={`${d.keyword}-${i}`}>
                    <td className="td">{d.keyword || <em className="text-slate-400">(empty)</em>}</td>
                    <td className="td">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${d.reason === "geo" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>{d.reason}</span>
                    </td>
                    <td className="td text-xs text-slate-500">{d.detail}</td>
                    <td className="td text-right tabular-nums">{d.volume}</td>
                    <td className="td text-right"><KdPill kd={d.kd} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}

function KeywordTable({
  rows,
  numbered,
  editingId,
  draftKw,
  draftVol,
  draftKd,
  onDraftKw,
  onDraftVol,
  onDraftKd,
  onCommit,
  onCancel,
  onBucketChange,
  action,
}: {
  rows: PoolEntry[];
  numbered?: boolean;
  editingId?: string | null;
  draftKw?: string;
  draftVol?: string;
  draftKd?: string;
  onDraftKw?: (v: string) => void;
  onDraftVol?: (v: string) => void;
  onDraftKd?: (v: string) => void;
  onCommit?: (id: string) => void;
  onCancel?: () => void;
  onBucketChange?: (id: string, bucketId: string) => void;
  action: (k: PoolEntry) => React.ReactNode;
}) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          {numbered && <th className="th w-10">#</th>}
          <th className="th">Keyword</th>
          <th className="th text-right">Volume</th>
          <th className="th text-right">KD</th>
          <th className="th">Bucket</th>
          <th className="th">Role</th>
          <th className="th">Flags</th>
          <th className="th w-28" />
        </tr>
      </thead>
      <tbody>
        {rows.map((k, i) => {
          const isEditing = editingId === k.id;
          return (
            <tr key={k.id}>
              {numbered && <td className="td text-xs text-slate-400 tabular-nums">{i + 1}</td>}
              <td className="td">
                {isEditing ? (
                  <input className="input py-0.5 text-xs" value={draftKw} onChange={(e) => onDraftKw?.(e.target.value)} autoFocus />
                ) : (
                  <>
                    <div>{k.keyword}</div>
                    <div className="text-[11px] text-slate-400" title={k.sourceFiles.join(", ")}>{k.sourceGroup}</div>
                  </>
                )}
              </td>
              <td className="td text-right tabular-nums">
                {isEditing ? (
                  <input className="input w-20 py-0.5 text-right text-xs" value={draftVol} onChange={(e) => onDraftVol?.(e.target.value)} />
                ) : (
                  k.volume.toLocaleString()
                )}
              </td>
              <td className="td text-right">
                {isEditing ? (
                  <input className="input w-14 py-0.5 text-right text-xs" value={draftKd} onChange={(e) => onDraftKd?.(e.target.value)} />
                ) : (
                  <KdPill kd={k.kd} />
                )}
              </td>
              <td className="td text-xs">
                {onBucketChange ? (
                  <select
                    className="input py-0.5 text-xs"
                    value={k.bucketId ?? ""}
                    onChange={(e) => onBucketChange(k.id, e.target.value)}
                  >
                    {k.bucketId && !BUCKETS.some((b) => b.id === k.bucketId) && (
                      <option value={k.bucketId}>{k.bucketName ?? k.bucketId}</option>
                    )}
                    {BUCKETS.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                ) : (
                  <>
                    {k.bucketName}
                    {k.bucketSource !== "keyword" && <span className="ml-1 text-slate-400">({k.bucketSource})</span>}
                  </>
                )}
              </td>
              <td className="td">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLE[k.role]}`}>
                  {k.role}
                  {k.pageId ? ` · ${k.pageId}` : ""}
                </span>
              </td>
              <td className="td">
                <div className="flex flex-wrap gap-1">{k.flags.map((f) => <FlagBadge key={f} flag={f} />)}</div>
              </td>
              <td className="td text-right">
                {isEditing ? (
                  <div className="flex justify-end gap-1">
                    <Button className="px-2 py-0.5 text-xs" onClick={() => onCommit?.(k.id)}>Save</Button>
                    <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={onCancel}>Cancel</Button>
                  </div>
                ) : (
                  action(k)
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

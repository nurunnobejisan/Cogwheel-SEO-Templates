"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { DataTable, InlineAlert, KpiTile, PageHeader } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui/index";

interface Competitor {
  id: string;
  name: string;
  shortName: string;
}

interface KeywordBattle {
  id: string;
  keyword: string;
  searchVolume: number | null;
  yourRank: number | null;
  compRanks: Record<string, number | null>;
}

export function GeoCompsetClient() {
  const { activeProperty } = useWorkspace();
  const [competitors, setCompetitors] = React.useState<Competitor[]>([]);
  const [keywords, setKeywords] = React.useState<KeywordBattle[]>([]);
  const [newCompName, setNewCompName] = React.useState("");
  const [newKeyword, setNewKeyword] = React.useState("");
  const [newSv, setNewSv] = React.useState("");
  const [newRank, setNewRank] = React.useState("");

  function addCompetitor(e: React.FormEvent) {
    e.preventDefault();
    const name = newCompName.trim();
    if (!name) return;
    setCompetitors((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, name, shortName: name.slice(0, 14) },
    ]);
    setNewCompName("");
  }

  function addKeyword(e: React.FormEvent) {
    e.preventDefault();
    const kw = newKeyword.trim();
    if (!kw) return;
    const sv = newSv.trim() ? Number(newSv) : null;
    const yr = newRank.trim() ? Number(newRank) : null;
    setKeywords((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        keyword: kw,
        searchVolume: sv !== null && !Number.isNaN(sv) ? sv : null,
        yourRank: yr !== null && !Number.isNaN(yr) ? yr : null,
        compRanks: {},
      },
    ]);
    setNewKeyword("");
    setNewSv("");
    setNewRank("");
  }

  const top3Count = keywords.filter((k) => k.yourRank !== null && k.yourRank <= 3).length;
  const top10Count = keywords.filter((k) => k.yourRank !== null && k.yourRank <= 10).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local Comp-Set Matrix"
        description={`Operator-entered ranking benchmarks for ${activeProperty.name || "Target property"}.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "AI & GEO", href: "/geo" },
          { label: "Local Comp-Set" },
        ]}
        secondaryActions={[{ label: "Executive Memo", href: "/reports/memo" }]}
      />

      <InlineAlert
        variant="notice"
        title="Verified operator benchmarks only"
        description="Search volumes and competitor rankings are never guessed. Add verified competitors and query positions below to compute share of voice."
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link href="/geo/visibility">Import JSON batch</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Competitors" value={competitors.length} />
        <KpiTile label="Tracked queries" value={keywords.length} />
        <KpiTile label="Top 3 positions" value={keywords.length ? top3Count : null} />
        <KpiTile label="Top 10 positions" value={keywords.length ? top10Count : null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Add Competitor</CardTitle>
              <CardDescription>Track local market hotels or competing domains</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={addCompetitor} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                label="Competitor name"
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
                placeholder="e.g., Grand Hyatt Downtown"
              />
              <Button type="submit" variant="secondary" icon={<Plus className="h-4 w-4" />} className="shrink-0">
                Add competitor
              </Button>
            </form>
            {competitors.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {competitors.map((c) => (
                  <Badge key={c.id} variant="outline" className="gap-1.5">
                    <span>{c.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${c.name}`}
                      onClick={() => setCompetitors((prev) => prev.filter((item) => item.id !== c.id))}
                      className="tap-compact text-text-muted hover:text-error"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Add Target Query</CardTitle>
              <CardDescription>Enter keyword, measured volume, and current rank</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={addKeyword} className="grid gap-2 sm:grid-cols-[1fr_90px_90px_auto] sm:items-end">
              <Input
                label="Query"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="luxury hotel denver"
              />
              <Input
                label="Volume"
                type="number"
                value={newSv}
                onChange={(e) => setNewSv(e.target.value)}
                placeholder="1200"
              />
              <Input
                label="Your rank"
                type="number"
                value={newRank}
                onChange={(e) => setNewRank(e.target.value)}
                placeholder="4"
              />
              <Button type="submit" variant="primary" icon={<Plus className="h-4 w-4" />}>
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={keywords}
        emptyTitle="No comp-set queries entered"
        emptyDescription="Add competitors and target queries above to compare organic positions side by side."
        columns={[
          { accessorKey: "keyword", header: "Keyword" },
          {
            accessorKey: "searchVolume",
            header: "Volume",
            cell: ({ row }) => (
              <span className="nums">{row.original.searchVolume?.toLocaleString() ?? "—"}</span>
            ),
          },
          {
            accessorKey: "yourRank",
            header: activeProperty.name || "Your Rank",
            cell: ({ row }) => (
              <Badge variant={row.original.yourRank && row.original.yourRank <= 3 ? "success" : "neutral"}>
                {row.original.yourRank ? `#${row.original.yourRank}` : "—"}
              </Badge>
            ),
          },
          {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${row.original.keyword}`}
                onClick={() => setKeywords((prev) => prev.filter((k) => k.id !== row.original.id))}
              >
                <Trash2 className="h-4 w-4 text-text-muted" />
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { Globe } from "lucide-react";
import { InlineAlert, PageHeader } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, toast } from "@/components/ui/index";

export function PropertySettingsClient() {
  const { activeProperty, updateProperty, clearProperty, autofillPropertyByUrl } = useWorkspace();
  const [urlToFill, setUrlToFill] = React.useState(activeProperty.url);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeProperty.url) setUrlToFill(activeProperty.url);
  }, [activeProperty.url]);

  async function handleDetect(e: React.FormEvent) {
    e.preventDefault();
    if (!urlToFill.trim()) {
      setError("Enter a website URL first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const detected = await autofillPropertyByUrl(urlToFill);
      setUrlToFill(detected.url);
      toast.success(`Loaded ${detected.name || detected.url}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[1200px] space-y-6">
      <PageHeader
        title="Property Profile"
        description="Configure active property details used across audits, keyword matrices, and deliverables."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Settings", href: "/settings/ai-training" },
          { label: "Property Profile" },
        ]}
        secondaryActions={[{ label: "Clear Property", onClick: clearProperty }]}
      />

      {error && <InlineAlert variant="error" title="Auto-detect failed" description={error} />}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Detect Property by URL</CardTitle>
            <CardDescription>Fetch canonical metadata to populate property fields automatically.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDetect} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label="Website URL"
              type="url"
              placeholder="https://www.example.com"
              value={urlToFill}
              onChange={(e) => setUrlToFill(e.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              icon={<Globe className="h-4 w-4" aria-hidden="true" />}
              className="shrink-0"
            >
              Detect metadata
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Profile Fields</CardTitle>
            <CardDescription>Saved automatically in local browser storage for this workspace.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Property Name"
            value={activeProperty.name}
            onChange={(e) => updateProperty({ name: e.target.value })}
          />
          <Input
            label="Brand / Group"
            value={activeProperty.brand}
            onChange={(e) => updateProperty({ brand: e.target.value })}
          />
          <Input
            label="City"
            value={activeProperty.city}
            onChange={(e) => updateProperty({ city: e.target.value })}
          />
          <Input
            label="State"
            maxLength={2}
            value={activeProperty.state}
            onChange={(e) => updateProperty({ state: e.target.value.toUpperCase() })}
          />
          <div className="sm:col-span-2">
            <Input
              label="Canonical URL"
              type="url"
              value={activeProperty.url}
              onChange={(e) => updateProperty({ url: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

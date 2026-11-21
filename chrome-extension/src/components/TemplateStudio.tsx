import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Star,
  Copy,
  Download,
  ExternalLink,
  Sparkles,
  Check,
  Send,
} from "lucide-react";
import {
  COGWHEEL_TEMPLATES,
  extractTemplateVariables,
  resolveTemplateContent,
} from "../data/cogwheelTemplates";
import { CogwheelTemplate, PageAuditData, ClientProfile } from "../types/extension";

interface Props {
  pageData?: PageAuditData;
  activeProfile?: ClientProfile;
  initialTemplateId?: string;
}

export function TemplateStudio({
  pageData,
  activeProfile,
  initialTemplateId,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("cogwheel_favorite_templates") || "[]");
    } catch {
      return [];
    }
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplateId || COGWHEEL_TEMPLATES[0].id
  );

  useEffect(() => {
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
    }
  }, [initialTemplateId]);

  const selectedTemplate = useMemo<CogwheelTemplate>(() => {
    return (
      COGWHEEL_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
      COGWHEEL_TEMPLATES[0]
    );
  }, [selectedTemplateId]);

  // Variables state
  const [formVariables, setFormVariables] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Auto-fill variables from active page and activeProfile
  useEffect(() => {
    const vars = extractTemplateVariables(selectedTemplate.content);
    const initial: Record<string, string> = { ...selectedTemplate.defaultVariables };

    vars.forEach((v) => {
      // Intelligently map page data or profile
      if (v === "hotelName" || v === "brand") {
        if (activeProfile?.name) initial[v] = activeProfile.name;
        else if (pageData?.title) {
          const brandGuess = pageData.title.split("|")[0].split("-")[0].trim();
          initial[v] = brandGuess;
        }
      } else if (v === "cityName" || v === "city") {
        if (activeProfile?.city) initial[v] = activeProfile.city;
      } else if (v === "stateCode" || v === "state") {
        if (activeProfile?.state) initial[v] = activeProfile.state;
      } else if (v === "canonicalUrl" || v === "url") {
        if (pageData?.canonical || pageData?.url) {
          initial[v] = pageData.canonical || pageData.url;
        }
      } else if (v === "originUrl") {
        if (pageData?.origin) initial[v] = pageData.origin;
      } else if (v === "metaDescription") {
        if (pageData?.metaDesc) initial[v] = pageData.metaDesc;
      } else if (v === "targetKeyword" && activeProfile?.primaryKeywords?.length) {
        initial[v] = activeProfile.primaryKeywords[0];
      } else if (v === "phoneNumber" && activeProfile?.phone) {
        initial[v] = activeProfile.phone;
      } else if (v === "streetAddress" && activeProfile?.address) {
        initial[v] = activeProfile.address;
      } else if (v === "postalCode" && activeProfile?.postalCode) {
        initial[v] = activeProfile.postalCode;
      }
    });

    setFormVariables(initial);
  }, [selectedTemplate, pageData, activeProfile]);

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("cogwheel_favorite_templates", JSON.stringify(next));
  };

  const categories = ["All", "Landing Pages", "Schemas", "Meta & Headings", "AI Prompts", "Audits & Checklists", "CMS Exporters"];

  const filteredTemplates = useMemo(() => {
    return COGWHEEL_TEMPLATES.filter((t) => {
      const matchCat = selectedCategory === "All" || t.category === selectedCategory;
      const matchSearch =
        searchQuery.trim() === "" ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const resolvedOutput = useMemo(() => {
    return resolveTemplateContent(selectedTemplate.content, formVariables);
  }, [selectedTemplate, formVariables]);

  const handleCopy = () => {
    navigator.clipboard.writeText(resolvedOutput).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const ext = selectedTemplate.format === "json" ? "json" : selectedTemplate.format === "markdown" ? "md" : "html";
    const blob = new Blob([resolvedOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate.id}.${ext}`;
    a.click();
  };

  // Launch pre-encoded prompt in AI engines
  const launchAi = (engine: "chatgpt" | "claude" | "gemini" | "perplexity") => {
    const promptText = encodeURIComponent(resolvedOutput);
    let targetUrl = "";
    if (engine === "chatgpt") targetUrl = `https://chatgpt.com/?q=${promptText}`;
    else if (engine === "claude") targetUrl = `https://claude.ai/new?q=${promptText}`;
    else if (engine === "gemini") targetUrl = `https://gemini.google.com/app?q=${promptText}`;
    else if (engine === "perplexity") targetUrl = `https://www.perplexity.ai/search?q=${promptText}`;

    window.open(targetUrl, "_blank");
  };

  const extractedVariables = useMemo(() => {
    return extractTemplateVariables(selectedTemplate.content);
  }, [selectedTemplate]);

  return (
    <div className="space-y-4">
      {/* Category Pills & Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates, schemas, prompts..."
            className="h-8.5 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-xs dark:bg-brand dark:text-slate-950"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Template Selector Horizontal Strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filteredTemplates.map((t) => {
          const isSelected = t.id === selectedTemplate.id;
          const isFav = favorites.includes(t.id);

          return (
            <div
              key={t.id}
              onClick={() => setSelectedTemplateId(t.id)}
              className={`min-w-[190px] max-w-[210px] shrink-0 cursor-pointer rounded-xl border p-2.5 transition shadow-xs ${
                isSelected
                  ? "border-emerald-500 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/40"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {t.category}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(t.id);
                  }}
                  className="text-slate-400 hover:text-amber-500"
                >
                  <Star className={`h-3.5 w-3.5 ${isFav ? "fill-amber-400 text-amber-500" : ""}`} />
                </button>
              </div>
              <h4 className="mt-1.5 line-clamp-1 text-xs font-bold text-slate-900 dark:text-white">
                {t.title}
              </h4>
              <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">
                {t.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Smart Form Builder for Selected Template */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              SMART FORM BUILDER
            </span>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {selectedTemplate.title}
            </h3>
          </div>
          <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            {extractedVariables.length} variables detected
          </span>
        </div>

        {/* Input Fields */}
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 max-h-56 overflow-y-auto p-0.5">
          {extractedVariables.map((variable) => (
            <div key={variable} className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">
                {`{{${variable}}}`}
              </label>
              <input
                type="text"
                value={formVariables[variable] || ""}
                onChange={(e) =>
                  setFormVariables((prev) => ({
                    ...prev,
                    [variable]: e.target.value,
                  }))
                }
                className="h-8 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-xs focus:border-brand focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Live Output Preview & Action Toolbar */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            LIVE RESOLVED OUTPUT ({selectedTemplate.format.toUpperCase()})
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
          </div>
        </div>

        {/* Code / Output Box */}
        <div className="mt-3">
          <pre className="max-h-64 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-400 shadow-inner dark:border-slate-800 whitespace-pre-wrap">
            {resolvedOutput}
          </pre>
        </div>

        {/* Send to AI Quick-Launch Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>Launch with pre-encoded prompt in:</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => launchAi("chatgpt")}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              ChatGPT
            </button>
            <button
              type="button"
              onClick={() => launchAi("claude")}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              Claude
            </button>
            <button
              type="button"
              onClick={() => launchAi("gemini")}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              Gemini
            </button>
            <button
              type="button"
              onClick={() => launchAi("perplexity")}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              Perplexity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

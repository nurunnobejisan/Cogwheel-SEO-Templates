import React, { useState } from "react";
import { UserCheck, Moon, Sun, Save, Check } from "lucide-react";
import { PRESET_CLIENT_PROFILES } from "../data/cogwheelTemplates";
import { ClientProfile } from "../types/extension";

interface Props {
  activeProfile: ClientProfile;
  onSelectProfile: (profile: ClientProfile) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export function SettingsBrandProfiles({
  activeProfile,
  onSelectProfile,
  isDarkMode,
  onToggleTheme,
}: Props) {
  const [profileForm, setProfileForm] = useState<ClientProfile>(activeProfile);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSelectProfile(profileForm);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Brand Profiles Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              REUSABLE CLIENT &amp; BRAND PROFILES
            </span>
            <h3 className="font-display text-xs font-bold text-slate-900 dark:text-white">
              Select or Edit Property Profile
            </h3>
          </div>
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            Active: {activeProfile.name.slice(0, 15)}...
          </span>
        </div>

        {/* Quick Profile Selectors */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PRESET_CLIENT_PROFILES.map((p) => {
            const isSelected = p.id === activeProfile.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectProfile(p);
                  setProfileForm(p);
                }}
                className={`rounded-xl border p-2.5 text-left transition shadow-xs ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/80 dark:border-emerald-700 dark:bg-emerald-950/40"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950"
                }`}
              >
                <div className="font-display text-xs font-bold text-slate-900 dark:text-white truncate">
                  {p.name}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  {p.city}, {p.state} &bull; {p.brand}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Edit Active Profile Form */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          PROFILE NAP &amp; SEO ATTRIBUTES
        </span>

        <div className="mt-3 space-y-2.5 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">HOTEL NAME</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="mt-1 h-8 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">BRAND / MANAGEMENT</label>
              <input
                type="text"
                value={profileForm.brand}
                onChange={(e) => setProfileForm({ ...profileForm, brand: e.target.value })}
                className="mt-1 h-8 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">CITY</label>
              <input
                type="text"
                value={profileForm.city}
                onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                className="mt-1 h-8 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">STATE CODE</label>
              <input
                type="text"
                value={profileForm.state}
                onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                className="mt-1 h-8 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">STREET ADDRESS (NAP)</label>
            <input
              type="text"
              value={profileForm.address}
              onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
              className="mt-1 h-8 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">PRIMARY KEYWORDS (COMMA-SEPARATED)</label>
            <input
              type="text"
              value={profileForm.primaryKeywords.join(", ")}
              onChange={(e) =>
                setProfileForm({
                  ...profileForm,
                  primaryKeywords: e.target.value.split(",").map((s) => s.trim()),
                })
              }
              className="mt-1 h-8 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 dark:bg-brand dark:text-slate-950 dark:hover:bg-brand-light"
          >
            {saved ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Profile Saved" : "Save Active Profile"}
          </button>
        </div>
      </div>

      {/* Theme Toggle & Extension Info */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">Appearance &amp; Theme</h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Toggle between Light and Dark mode styling.</p>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
        >
          {isDarkMode ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-600" />}
          <span>{isDarkMode ? "Light" : "Dark"}</span>
        </button>
      </div>
    </div>
  );
}

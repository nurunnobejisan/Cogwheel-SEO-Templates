"use client";

import Image from "next/image";
import { useAuth } from "@/lib/use-auth";

interface Props {
  compact?: boolean;
}

export function AuthButton({ compact = false }: Props) {
  const { user, loading, configured, signInWithGoogle, signOut } = useAuth();

  if (!configured) {
    return (
      <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-400 sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        Auth not configured
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
            fill="#EA4335"
          />
        </svg>
        {compact ? "Sign In" : "Sign in with Google"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
        {user.user_metadata?.avatar_url ? (
          <Image
            src={user.user_metadata.avatar_url as string}
            alt={user.user_metadata?.full_name as string ?? "User"}
            width={22}
            height={22}
            className="rounded-full"
            unoptimized
          />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-slate-900">
            {((user.user_metadata?.full_name as string) ?? user.email ?? "?")[0].toUpperCase()}
          </span>
        )}
        {!compact && (
          <span className="hidden text-xs font-semibold text-slate-700 sm:block">
            {(user.user_metadata?.full_name as string) ?? user.email?.split("@")[0] ?? "Signed In"}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
      >
        Sign Out
      </button>
    </div>
  );
}

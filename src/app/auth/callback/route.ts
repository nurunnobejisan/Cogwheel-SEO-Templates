import { NextResponse } from "next/server";

/**
 * OAuth callback handler for Supabase Google Auth.
 *
 * Supabase handles token exchange client-side via the PKCE flow when using
 * @supabase/ssr. This route simply redirects the user back to the app home
 * after the callback URL is hit; the client-side listener in useAuth picks up
 * the new session automatically from the hash fragment.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  // After Google OAuth, redirect to home; Supabase client resolves the session.
  return NextResponse.redirect(`${origin}/`);
}

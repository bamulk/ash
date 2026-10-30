import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  // PWA assets must be reachable without auth: Chrome fetches the manifest
  // and service worker before the user signs in (or even before they have
  // a session), and the offline fallback page is shown when the network
  // is down — including, possibly, before the redirect-to-login completes.
  const isPwaAsset =
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/offline.html";
  // Unsubscribe links are clicked from marketing emails by people with
  // no app session, so the whole /unsubscribe/<token> flow is public.
  // The public lead-capture API and the Vercel cron are both guarded by
  // their own shared secrets (WEBSITE_LEAD_SECRET / CRON_SECRET) rather
  // than a Supabase session, so they stay out of the auth redirect.
  const isPublicRoute =
    pathname.startsWith("/unsubscribe/") ||
    pathname.startsWith("/api/leads/") ||
    pathname.startsWith("/api/cron/");

  if (!user && !isAuthRoute && !isPwaAsset && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

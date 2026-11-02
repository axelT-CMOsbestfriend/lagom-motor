import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CORS för motorns API, så att Lagom HQ-frontenden i Lovable kan anropa den.
// Extra origins kan läggas till med CORS_ORIGINS (kommaseparerad lista).
const extraOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (extraOrigins.includes(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (protocol !== "https:") return false;
    return (
      hostname.endsWith(".lovable.app") ||
      hostname.endsWith(".lovableproject.com") ||
      hostname === "lovable.dev" ||
      hostname.endsWith(".lovable.dev")
    );
  } catch {
    return false;
  }
}

const corsOptions = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin);

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...(allowed && { "Access-Control-Allow-Origin": origin }),
        ...corsOptions,
      },
    });
  }

  const response = NextResponse.next();
  if (allowed) response.headers.set("Access-Control-Allow-Origin", origin);
  Object.entries(corsOptions).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};

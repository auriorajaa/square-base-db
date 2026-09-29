import {NextRequest, NextResponse} from "next/server";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {applyAuthCookiesToResponse} from "@/features/auth/ccokies";
import * as jose from "jose";

// Define the routes that do not require authentication
const AUTH_ROUTES = ["/login", "/register"];

// Function to refresh the session using the refresh token
// Returns true if the session was successfully refreshed, false otherwise
async function refreshSession(refreshToken: string, response: NextResponse): Promise<boolean> {
  const apiUrl = process.env.API_URL;

  if (!apiUrl) return false;

  // Make a request to the API to refresh the session using the refresh token
  const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    headers: {Cookie: `${COOKIE_KEYS.REFRESH_TOKEN}=${refreshToken}`}
  });

  if (!refreshRes.ok) return false;

  // Apply the new authentication cookies to the response
  applyAuthCookiesToResponse(response, refreshRes.headers.getSetCookie());

  return true;
}

// Middleware function to handle authentication and session management
// It checks if the user is trying to access protected routes and whether they have valid tokens
// If the access token is invalid or expired, it attempts to refresh the session using the refresh token
export async function proxy(request: NextRequest) {
  // Extract the pathname and tokens from the request
  const {pathname} = request.nextUrl;
  // Get the access token and refresh token from cookies
  const accessToken = request.cookies.get(COOKIE_KEYS.ACCESS_TOKEN)?.value;
  // Get the refresh token from cookies
  const refreshToken = request.cookies.get(COOKIE_KEYS.REFRESH_TOKEN)?.value;

  // Determine if the current route is an authentication route or a protected route
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  // Determine if the current route is a protected route (requires authentication)
  const isProtected = pathname.startsWith("/organizations") || pathname.startsWith("/dashboard");

  let isValid = false;
  // Verify the access token if it exists and the secret is available
  if (accessToken && process.env.JWT_ACCESS_TOKEN) {
    try {
      // Verify the access token using the secret key
      const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
      // Verify the JWT access token
      await jose.jwtVerify(accessToken, secret);

      // If verification is successful, set isValid to true
      isValid = true;
    } catch {
      // Token is invalid or expired, remain isValid as false
    }
  }

  // Handle redirection based on the route type and token validity
  // If the user is on an authentication route and has a valid access token, redirect to the dashboard
  if (isAuthRoute && isValid) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If the user is on an authentication route and has a refresh token, attempt to refresh the session
  // If successful, redirect to the dashboard
  if (isAuthRoute && refreshToken) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));

    if (await refreshSession(refreshToken, response)) {
      return response;
    }
  }

  // If the user is on a protected route and does not have a valid access token, check if they have a refresh token
  if (isProtected && !isValid) {
    if (refreshToken) {
      const response = NextResponse.next();

      if (await refreshSession(refreshToken, response)) {
        return response;
      }
    }

    // If the user is on a protected route and does not have a valid access token or refresh token, redirect to the login page
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If the user is on a protected route and has a valid access token, allow the request to proceed
  return NextResponse.next();
}

// Configure the middleware to match all routes except for API routes, Next.js static files, and the favicon
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
import {COOKIE_KEYS} from "@square-base-db/constants";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";

// This file contains utility functions for parsing Set-Cookie headers in HTTP responses
type ParsedCookie = {
  name: string;
  value: string;
  options: {
    path: string;
    maxAge?: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none"
  }
}

// Parse a Set-Cookie header string into a ParsedCookie object
// Example output: { name: "sessionId", value: "abc123", options: { path: "/", httpOnly: true, secure: true, sameSite: "lax" } }
export function parseSetCookieHeader(setCookie: string): ParsedCookie {
  // Split the Set-Cookie string into parts and trim whitespace
  const parts = setCookie.split(";").map((part) => part.trim());
  // The first part is the name-value pair, and the rest are attributes
  const [nameValue, ...attributes] = parts;

  // Find the index of the "=" separator in the name-value pair
  const separatorIndex = nameValue.indexOf("=");
  const name = nameValue.slice(0, separatorIndex);
  const value = nameValue.slice(separatorIndex + 1);

  // Initialize the options object with default values
  const options: ParsedCookie["options"] = {
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "lax"
  };

  // Iterate over the attributes and set the corresponding options
  for (const attribute of attributes) {
    const separator = attribute.indexOf("=");
    const key = (
      separator === -1 ? attribute : attribute.slice(0, separator)
    ).toLowerCase();
    const val = separator === -1 ? "" : attribute.slice(separator + 1);

    switch (key) {
      // Set the path option if the attribute is "path"
      case "path":
        options.path = val;
        break;
      // Set the maxAge option if the attribute is "max-age"
      case "max-age":
        options.maxAge = Number.parseInt(val, 10);
        break;
      // Set the httpOnly option to true if the attribute is "http-only"
      case "http-only":
        options.httpOnly = true;
        break;
      // Set the secure option to true if the attribute is "secure"
      case "secure":
        options.secure = true;
        break;
      // Set the sameSite option if the attribute is "samesite"
      case "samesite":
        options.sameSite = val.toLowerCase() as ParsedCookie["options"]["sameSite"];
        break;
    }
  }

  // Return the parsed cookie object
  return {name, value, options};
}

// Check if a cookie name is an authentication cookie (access token or refresh token)
function isAuthCookie(name: string) {
  return name === COOKIE_KEYS.ACCESS_TOKEN || name === COOKIE_KEYS.REFRESH_TOKEN;
}

// Apply authentication cookies from an HTTP response to the Next.js cookie store
export async function applyAuthCookiesFromResponse(response: Response) {
  const cookieStore = await cookies();

  // Iterate over the Set-Cookie headers in the response
  for (const header of response.headers.getSetCookie()) {
    // Parse the Set-Cookie header into a ParsedCookie object
    const parsed = parseSetCookieHeader(header);

    // Only set the cookie in the store if it is an authentication cookie
    if (!isAuthCookie(parsed.name)) continue;

    // Set the cookie in the Next.js cookie store with the parsed name, value, and options
    cookieStore.set(parsed.name, parsed.value, parsed.options);
  }
}

// Apply authentication cookies from an array of Set-Cookie headers to a NextResponse object
export function applyAuthCookiesToResponse(response: NextResponse, setCookieHeaders: string[]) {
  // Iterate over the Set-Cookie headers
  for (const header of setCookieHeaders) {
    // Parse the Set-Cookie header into a ParsedCookie object
    const parsed = parseSetCookieHeader(header);

    // Only set the cookie in the response if it is an authentication cookie
    if (!isAuthCookie(parsed.name)) continue;

    // Set the cookie in the NextResponse object with the parsed name, value, and options
    response.cookies.set(parsed.name, parsed.value, parsed.options);
  }
}
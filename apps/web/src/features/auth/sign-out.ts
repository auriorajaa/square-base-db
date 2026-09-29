"use server";

import {cookies} from "next/headers";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {redirect} from "next/navigation";

// This function handles the sign-out process for the user.
// It sends a POST request to the API's logout endpoint to invalidate the user's session on the server side.
// After that, it deletes the access and refresh tokens from the cookies to clear the user's authentication state on the client side.
// Finally, it redirects the user to the login page.
export async function signOut() {
  // Send a POST request to the API's logout endpoint to invalidate the user's session on the server side
  await fetch(`${process.env.API_URL}/auth/logout`, {
    method: "POST",
  });

  // Delete the access and refresh tokens from the cookies to clear the user's authentication state on the client side
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_KEYS.ACCESS_TOKEN);
  cookieStore.delete(COOKIE_KEYS.REFRESH_TOKEN);

  // Redirect the user to the login page after signing out
  redirect("/login");
}
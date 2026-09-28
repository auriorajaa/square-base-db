"use server";

import {authServerSchema} from "@/features/auth/server.schema";
import {AUTH_INTENT} from "@/features/auth/constants";
import {redirect} from "next/navigation";
import {applyAuthCookiesFromResponse} from "@/features/auth/ccokies";

// Define the type for the authentication action state
export type AuthActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>
}

// Define the authentication action function
// This function handles authentication actions such as login and registration
export async function authAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  // Convert the FormData to a plain object
  const raw = Object.fromEntries(formData);
  // Validate the raw data against the server schema
  const parsed = authServerSchema.safeParse(raw);

  // If validation fails, return the field errors
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
    };
  }

  // Extract the intent and data from the parsed result
  const {intent, ...data} = parsed.data;
  let res: Response;

  // Handle the authentication action based on the intent (login or register)
  switch (intent) {
    // Handle login action
    case AUTH_INTENT.LOGIN: {
      // Send a POST request to the login endpoint with the provided data
      res = await fetch(`${process.env.API_URL}/auth/login`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
      });

      // If the response is not OK, return an error message
      if (!res.ok) {
        const body = await res.json();

        return {error: body.message ?? "Login Failed"};
      }

      // If login is successful, break out of the switch statement
      break;
    }

    // Handle registration action
    case AUTH_INTENT.REGISTER: {
      // Send a POST request to the registration endpoint with the provided data
      res = await fetch(`${process.env.API_URL}/auth/register`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
      });

      // If the response is not OK, return an error message
      if (!res.ok) {
        const body = await res.json();

        return {error: body.message ?? "Registration Failed"};
      }

      // If registration is successful, break out of the switch statement
      break;
    }
  }

  // Apply authentication cookies from the response to the Next.js cookie store
  // This ensures that the access token and refresh token are stored in the user's cookies
  await applyAuthCookiesFromResponse(res!);

  // If the authentication action is successful, redirect to the dashboard
  redirect("/dashboard");
}
import {cookies} from "next/headers";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {redirect} from "next/navigation";

export async function retrieveTokenFromCookie(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_KEYS.ACCESS_TOKEN)?.value;

  if (!token) redirect("/login");

  return token;
}
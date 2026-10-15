import apiClient from "@/lib/axios";
import { retrieveTokenFromCookie } from "@/server-utils/utils";
import { COOKIE_KEYS } from "@square-base-db/constants";
import type {
  ProjectAuthUser,
  ProjectOAuthSettings,
} from "@square-base-db/types";
import { isAxiosError } from "axios";
import { redirect } from "next/navigation";

export async function retrieveProjectAuthUsersFromApi(
  orgSlug: string,
  projectSlug: string,
): Promise<ProjectAuthUser[]> {
  const token = await retrieveTokenFromCookie();

  const url = `/orgs/${orgSlug}/projects/${projectSlug}/auth/users`;
  console.log("[auth/users] fetching", {
    orgSlug,
    projectSlug,
    url,
    hasToken: Boolean(token),
  });

  try {
    const { data } = await apiClient.get<ProjectAuthUser[]>(url, {
      headers: {
        Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`,
      },
    });

    // console.log("[auth/users] ok", {
    //   count: Array.isArray(data) ? data.length : data,
    // });
    return data;
  } catch (err) {
    // if (isAxiosError(err)) {
    //   console.error("[auth/users] failed", {
    //     status: err.response?.status,
    //     statusText: err.response?.statusText,
    //     data: err.response?.data,
    //     message: err.message,
    //     url,
    //   });

    //   if (err.response?.status === 401 || err.response?.status === 403) {
    //     redirect(`/organizations/${orgSlug}/projects`);
    //   }
    // } else {
    //   console.error("[auth/users] unexpected error", err);
    // }

    // Still redirect for now so you can see the log, then tighten later
    redirect(`/organizations/${orgSlug}/projects`);
  }
}

export async function retrieveOAuthFromApi(
  orgSlug: string,
  projectSlug: string,
): Promise<ProjectOAuthSettings> {
  const token = await retrieveTokenFromCookie();

  const url = `/orgs/${orgSlug}/projects/${projectSlug}/auth/settings`;
  // console.log("[auth/settings] fetching", {
  //   orgSlug,
  //   projectSlug,
  //   url,
  //   hasToken: Boolean(token),
  // });

  try {
    const { data } = await apiClient.get<ProjectOAuthSettings>(url, {
      headers: {
        Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`,
      },
    });

    // console.log("[auth/settings] ok", data);
    return data;
  } catch (err) {
    // if (isAxiosError(err)) {
    //   console.error("[auth/settings] failed", {
    //     status: err.response?.status,
    //     statusText: err.response?.statusText,
    //     data: err.response?.data,
    //     message: err.message,
    //     url,
    //   });

    //   if (err.response?.status === 401 || err.response?.status === 403) {
    //     redirect(`/organizations/${orgSlug}/projects`);
    //   }
    // } else {
    //   console.error("[auth/settings] unexpected error", err);
    // }

    redirect(`/organizations/${orgSlug}/projects`);
  }
}

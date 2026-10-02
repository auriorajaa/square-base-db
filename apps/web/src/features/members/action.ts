"use server";

import {membersServerSchema} from "@/features/members/server.schema";
import {retrieveTokenFromCookie} from "@/server-utils/utils";
import {MEMBERS_INTENT} from "@/features/members/constants";
import apiClient from "@/lib/axios";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {revalidatePath} from "next/cache";

// Define the state type for the members action, which can include an error message or a success message
export type MembersActionState = {
  error?: string;
  success?: string
}

export async function membersAction(
  {slug}: { slug: string },
  _prev: MembersActionState,
  formData: FormData
): Promise<MembersActionState> {
  // Convert the FormData object to a plain object for easier processing
  const raw = Object.fromEntries(formData);
  // Validate the raw data against the members server schema
  const parsed = membersServerSchema.safeParse(raw);

  // If the validation fails, return an error message indicating invalid form data
  if (!parsed.success) {
    return {error: parsed.error.flatten().formErrors[0] ?? "Invalid form data"};
  }

  // Retrieve the authentication token from cookies for API requests
  const token = await retrieveTokenFromCookie();
  // Destructure the intent and other data from the parsed form data
  const {intent, ...data} = parsed.data;

  // Handle different member actions based on the intent (invite, update role, remove)
  try {
    switch (intent) {
      // Handle the invite action for inviting a new member to the organization
      case MEMBERS_INTENT.INVITE: {
        await apiClient.post(
          `/orgs/${slug}/members/invite`,
          {email: (data as { email: string }).email},
          {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
        );

        revalidatePath(`/organizations/${slug}/settings/members`);
        return {success: "User invited successfully"};
      }
      // Handle the update role action for changing a member's role in the organization
      case MEMBERS_INTENT.UPDATE_ROLE: {
        const {memberId, role} = data as { memberId: string; role: string };
        await apiClient.patch(
          `/orgs/${slug}/members/${memberId}/role`,
          {role},
          {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
        );

        revalidatePath(`/organizations/${slug}/settings/members`);
        return {success: "User role updated successfully"};
      }
      // Handle the remove action for removing a member from the organization
      case MEMBERS_INTENT.REMOVE: {
        const {memberId} = data as { memberId: string };
        await apiClient.delete(
          `/orgs/${slug}/members/${memberId}`,
          {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
        );

        revalidatePath(`/organizations/${slug}/settings/members`);
        return {success: "User removed successfully"};
      }
    }
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // If an error occurs during the API request, return an error message from the response or a generic error message
    return {error: err.response?.data?.message ?? "An error occurred"};
  }
}
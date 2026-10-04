import {SidebarInset, SidebarProvider} from "@/components/ui/sidebar";
import {AppSidebar} from "@/components/app-sidebar";
import {retrieveTokenFromCookie} from "@/server-utils/utils";
import {retrieveMyOrganizationsFromApi} from "@/features/organization/organization-helpers.server";

// This function retrieves the current user's information from the JWT token stored in the cookies.
// It first retrieves the token using the retrieveTokenFromCookie function,
// then decodes the token to extract the payload, which contains the user's email and other information.
// Finally, it returns an object containing the user's email and a null name (as the name is not included in the token).
async function getCurrentUser() {
  const token = await retrieveTokenFromCookie();
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());

  return {email: payload.email as string, name: null};
}

export default async function DashboardLayout({children,}: {
  children: React.ReactNode;
}) {
  const [orgs, user] = await Promise.all([
    retrieveMyOrganizationsFromApi(),
    getCurrentUser()
  ]);

  return (
    <SidebarProvider>
      <AppSidebar orgs={orgs} user={user}/>
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

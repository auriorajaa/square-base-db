import Link from "next/link";
import { Building2, ChevronLeft, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CreateOrgForm } from "@/features/organization/create-org-form";

export default function NewOrganizationPage() {
  return (
    <div className="mx-auto w-full space-y-6 p-6">
      <div className="space-y-3">
        <Link
          href="/organizations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Organizations
        </Link>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            New Organization
          </h1>
          <p className="text-sm text-muted-foreground">
            Organizations group projects and team members.
          </p>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden rounded-xl border border-border bg-card py-0">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Building2 className="size-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Organization details
          </h2>
        </div>

        <CreateOrgForm />
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        After creating it, you can add projects and invite your teammates.
      </p>
    </div>
  );
}

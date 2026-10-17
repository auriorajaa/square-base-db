"use client";

import { useActionState, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrgMemberWithUser, OrgRole } from "@square-base-db/types";
import { ORG_ROLES } from "@square-base-db/constants";
import { membersAction } from "@/features/members/action";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { inviteSchema } from "@/features/members/client.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MEMBERS_INTENT } from "@/features/members/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Trash2, UserPlus } from "lucide-react";

interface MembersClientProps {
  slug: string;
  members: OrgMemberWithUser[];
  currentUserRole: OrgRole;
}

// Component to render a single member row with user info, role management, and actions
// It receives member data, admin status, pending state, and a form action handler as props
// It uses local state to manage the selected role for the member
// It conditionally renders role management controls and remove button based on admin status
function MemberRow({
  member,
  isAdmin,
  isPending,
  formAction,
}: {
  member: OrgMemberWithUser;
  isAdmin: boolean;
  isPending: boolean;
  formAction: (payload: FormData) => void;
}) {
  const [role, setRole] = useState<string>(member.role);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      {/* User Info */}
      <div className="flex items-center gap-3">
        <Avatar className="size-9 border border-border">
          <AvatarFallback className="bg-muted text-foreground font-medium text-xs">
            {(member.user.name ?? member.user.email).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="grid leading-tight">
          <p className="text-sm font-medium text-foreground">
            {member.user.name ?? "Unnamed Member"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {member.user.email}
          </p>
        </div>
      </div>

      {/* Actions & Role Management */}
      <div className="flex items-center gap-2 self-end sm:self-center">
        {isAdmin ? (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="memberId" value={member.id} />
            <input type="hidden" name="role" value={role} />

            {/* Controlled Select menggunakan value & onValueChange */}
            <Select value={role} onValueChange={(val) => val && setRole(val)}>
              <SelectTrigger className="h-8 text-xs w-28 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ORG_ROLES.ADMIN}>Admin</SelectItem>
                <SelectItem value={ORG_ROLES.DEVELOPER}>Developer</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="submit"
              name="intent"
              value={MEMBERS_INTENT.UPDATE_ROLE}
              size="sm"
              variant="outline"
              className="h-8 text-xs font-medium"
              disabled={isPending}
            >
              Save
            </Button>
          </form>
        ) : (
          <Badge
            variant="secondary"
            className="capitalize font-normal text-xs px-2.5 py-0.5"
          >
            {member.role}
          </Badge>
        )}

        {/* Remove Member Button */}
        {isAdmin && (
          <form action={formAction}>
            <input type="hidden" name="memberId" value={member.id} />
            <Button
              type="submit"
              name="intent"
              value={MEMBERS_INTENT.REMOVE}
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={isPending}
              title="Remove member"
            >
              <Trash2 className="size-4 sm:hidden" />
              <span className="hidden sm:inline">Remove</span>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export function MembersClient({
  currentUserRole,
  members,
  slug,
}: MembersClientProps) {
  const isAdmin = currentUserRole === ORG_ROLES.ADMIN;
  const boundAction = membersAction.bind(null, { slug });
  const [state, formAction, isPending] = useActionState(boundAction, {});

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "" },
  });

  return (
    <div className="space-y-6">
      {/* Invite Member Card */}
      {isAdmin && (
        <Card className="border border-border bg-card rounded-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
              <UserPlus className="size-4 text-muted-foreground" />
              Invite a new member
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Send an email invitation to grant access to this organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {state.error}
              </div>
            )}
            {state.success && (
              <div className="rounded-md border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400">
                {state.success}
              </div>
            )}

            <form
              action={formAction}
              noValidate
              onSubmitCapture={async (e) => {
                const ok = await form.trigger(undefined, { shouldFocus: true });
                if (!ok) e.preventDefault();
              }}
              className="flex flex-col sm:flex-row gap-3 items-start"
            >
              <FieldGroup className="w-full flex-1">
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="w-full space-y-1"
                    >
                      <FieldLabel htmlFor="invite-email" className="sr-only">
                        Email Address
                      </FieldLabel>
                      <div className="relative w-full">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          {...field}
                          id="invite-email"
                          type="email"
                          placeholder="colleague@example.com"
                          aria-invalid={fieldState.invalid}
                          className="pl-9 w-full"
                        />
                      </div>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>

              <Button
                type="submit"
                name="intent"
                value={MEMBERS_INTENT.INVITE}
                disabled={isPending}
                className="w-full sm:w-auto font-medium"
              >
                {isPending ? "Sending..." : "Send invite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Members List Card */}
      <Card className="border border-border bg-card rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base font-semibold tracking-tight">
              Organization Members
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {members.length}{" "}
              {members.length === 1 ? "member has" : "members have"} access to
              this workspace.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="divide-y divide-border pt-0">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isAdmin={isAdmin}
              isPending={isPending}
              formAction={formAction}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

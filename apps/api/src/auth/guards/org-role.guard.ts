import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DrizzleService } from "../../db/drizzle.service.js";
import { Reflector } from "@nestjs/core";
import { JwtPayload, OrgRole } from "@square-base-db/types";
import { ORG_ROLE_KEY } from "../decorators/require-org-role.decorator.js";
import { organizations, orgMembers } from "../../db/schema/index.js";
import { Request } from "express";
import { and, eq, isNull } from "drizzle-orm";

// Extend the Request interface to include user and memberRole properties
interface AuthenticationRequest extends Request {
  user: JwtPayload;
  memberRole?: string;
}

@Injectable()
export class OrgRoleGuard implements CanActivate {
  constructor(
    private drizzle: DrizzleService,
    private reflector: Reflector,
  ) {}

  /**
   * The canActivate method checks if the user has the required role for the organization.
   * It retrieves the required role from the metadata, fetches the user's role in the organization from the database,
   * and compares it with the required role. If the user does not have the required role, it throws a ForbiddenException.
   * If the user is not a member of the organization, it throws a NotFoundException.
   * If the user has the required role, it adds the memberRole to the request object and returns true.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Retrieve the required role from the metadata
    const requiredRole = this.reflector.get<OrgRole>(
      ORG_ROLE_KEY,
      context.getHandler(),
    );

    // Get the request object and extract the user and organization slug
    const request = context.switchToHttp().getRequest<AuthenticationRequest>();
    // Get the authenticated user from the request
    const user = request.user;
    // Get the organization slug from the request parameters
    const orgSlug = request.params["slug"] as string;

    // Query the database to find the user's role in the organization
    const [member] = await this.drizzle.db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      // Join the organizations table to get the organization details
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      // Filter the results to find the specific organization and user, and ensure the member has not been removed
      // Limit the results to 1 to get a single member record
      .where(
        and(
          eq(organizations.slug, orgSlug),
          eq(orgMembers.userId, user.sub),
          isNull(orgMembers.removedAt),
        ),
      )
      .limit(1);

    // If no member is found, throw a NotFoundException
    if (!member) throw new NotFoundException("Organization member not found");

    // If a required role is specified and the user's role does not match, throw a ForbiddenException
    if (requiredRole && member.role !== requiredRole) {
      throw new ForbiddenException(
        `User does not have the required role: ${requiredRole}`,
      );
    }

    // Add the memberRole to the request object for further use in the request lifecycle
    request.memberRole = member.role;

    // If the user has the required role, return true to allow access
    return true;
  }
}

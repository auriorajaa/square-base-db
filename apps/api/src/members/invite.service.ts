import { BadRequestException, Injectable } from "@nestjs/common";
import { Resend } from "resend";
import { DrizzleService } from "../db/drizzle.service.js";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { organizations, orgMembers, users } from "../db/schema/index.js";
import { and, eq, isNull } from "drizzle-orm";
import { INVITE_EXPIRES_IN } from "@square-base-db/constants";

interface InvitePayload {
  email: string;
  orgId: string;
  orgName: string;
}

@Injectable()
export class InviteService {
  private resend: Resend;

  constructor(
    private drizzle: DrizzleService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get("RESEND_API_KEY"));
  }

  // Send an invite to a user to join an organization
  // If the user already exists, check if they are already a member of the organization
  // If they are not a member, send an invite email with a token that expires in 24 hours
  async sendInvite(orgSlug: string, email: string) {
    // Check if the organization exists
    const [org] = await this.drizzle.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    // If the organization does not exist, throw a BadRequestException
    if (!org) throw new BadRequestException("Organization not found");

    // Check if the user already exists
    const existingUser = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // If the user exists, check if they are already a member of the organization
    if (existingUser.length > 0) {
      const existingMember = await this.drizzle.db
        .select()
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, org.id),
            eq(orgMembers.userId, existingUser[0].id),
            // Check if the member has not been removed (removedAt is null)
            isNull(orgMembers.removedAt),
          ),
        )
        .limit(1);

      // If the user is already a member of the organization, throw a BadRequestException
      if (existingMember.length > 0) {
        throw new BadRequestException(
          "User is already a member of the organization",
        );
      }
    }

    // Generate a JWT token with the user's email, organization ID, and organization name
    const token = this.jwtService.sign(
      { email, orgId: org.id, orgName: org.name } satisfies InvitePayload,
      {
        // Use a secret from the environment variables to sign the token
        secret: this.configService.get("INVITE_SECRET"),
        expiresIn: INVITE_EXPIRES_IN,
      },
    );

    // Create an invitation URL with the token as a query parameter
    // This URL will be used in the invite email
    const inviteUrl = `${this.configService.get<string>("API_URL")}/auth/invite/accept?token=${token}`;

    // Send the invite email using the Resend service
    await this.resend.emails.send({
      from: "Square Base <onboarding@resend.dev>",
      to: email,
      subject: `You're invited to join ${org.name} on Square Base`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 16px;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 32px 24px;">
            <h2 style="margin-top: 0; color: #09090b; font-size: 18px;">You've been invited!</h2>
            <p style="color: #71717a; font-size: 14px; line-height: 1.5;">
              You have been invited to join <strong>${org.name}</strong> on Square Base.
            </p>
            <div style="margin: 24px 0;">
              <a href="${inviteUrl}" style="display: block; background-color: #5417D7; color: #ffffff; text-decoration: none; padding: 12px; text-align: center; border-radius: 8px; font-weight: 500; font-size: 14px;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 12px; margin-bottom: 4px;">Or copy and paste this link:</p>
            <p style="margin: 0; font-size: 12px; word-break: break-all;">
              <a href="${inviteUrl}" style="color: #5417D7;">${inviteUrl}</a>
            </p>
            <p style="color: #a1a1aa; font-size: 12px; margin-top: 16px; margin-bottom: 0;">This link expires in 24 hours.</p>
          </div>
        </body>
        </html>
      `,
    });

    // Return a success message
    return { message: "Invite sent successfully" };
  }

  // Accept an invite to join an organization
  // This method verifies the invite token, creates a new user if they don't exist,
  // and adds them as a member of the organization with the role of "developer"
  // If the user is already a member, it returns a message indicating that they are already a member
  async acceptInvite(token: string) {
    let payload: InvitePayload;

    // Verify the invite token using the secret from the environment variables
    try {
      payload = this.jwtService.verify<InvitePayload>(token, {
        secret: this.configService.get("INVITE_SECRET"),
      });
    } catch {
      throw new BadRequestException("Invalid or expired invite link");
    }

    // Check if the user already exists in the database
    let [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, payload.email))
      .limit(1);

    // If the user does not exist, create a new user with the provided email
    if (!user) {
      const [newUser] = await this.drizzle.db
        .insert(users)
        .values({ email: payload.email })
        .returning();

      user = newUser;
    }

    // Check if the user is already a member of the organization
    // If they are, return a message indicating that they are already a member
    const existing = await this.drizzle.db
      .select()
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, payload.orgId),
          eq(orgMembers.userId, user.id),
          isNull(orgMembers.removedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return { message: "Already a member of the organization" };
    }

    // Add the user as a member of the organization
    // The role is set to "developer" by default
    await this.drizzle.db.insert(orgMembers).values({
      orgId: payload.orgId,
      userId: user.id,
      role: "developer",
    });

    // Return a success message indicating that the invite was accepted successfully
    return { message: "Invite accepted successfully", email: user.email };
  }
}

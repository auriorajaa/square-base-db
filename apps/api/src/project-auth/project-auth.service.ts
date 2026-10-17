import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Resend } from "resend";
import { DrizzleService } from "../db/drizzle.service.js";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { projects } from "../db/schema/projects.js";
import { eq, sql } from "drizzle-orm";
import { SignInInput, SignUpInput } from "@square-base-db/types";
import * as bcrypt from "bcrypt";
import {
  AUTH_PROVIDERS,
  MAGIC_LINK_EXPIRES_IN,
} from "@square-base-db/constants";

interface ProjectAuthTokenPayload {
  sub: string;
  email: string;
  projectId: string;
}

@Injectable()
export class ProjectAuthService {
  private resend: Resend;

  constructor(
    private drizzle: DrizzleService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get<string>("RESEND_API_KEY"));
  }

  // Get project by slug
  private async getProject(projectSlug: string) {
    // Find project in database
    const [project] = await this.drizzle.db
      .select()
      .from(projects)
      .where(eq(projects.slug, projectSlug))
      .limit(1);

    // Check if project was found
    // If not, throw a NotFoundException
    if (!project)
      throw new NotFoundException(`Project with slug ${projectSlug} not found`);

    // Return the found project
    return project;
  }

  // Ensure the auth_users table exists
  private async ensureAuthUsersTable(dbSchema: string): Promise<void> {
    // Create the auth_users table if it doesn't exist
    await this.drizzle.db.execute(
      sql.raw(`
        CREATE TABLE IF NOT EXISTS "${dbSchema}"."auth_users" (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          email_verified BOOLEAN NOT NULL DEFAULT FALSE,
          provider TEXT NOT NULL DEFAULT 'email',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
    );
  }

  // Sign a JWT token
  private signToken(
    userId: string,
    email: string,
    projectId: string,
    secret: string,
  ): string {
    // Sign the JWT token
    // using the user's ID, email, and project ID
    // and a secret key
    return this.jwtService.sign(
      { sub: userId, email, projectId } satisfies ProjectAuthTokenPayload,
      { secret, expiresIn: "7d" },
    );
  }

  // Sign up a new user
  async signUp(projectSlug: string, dto: SignUpInput) {
    // Get the project by slug
    const project = await this.getProject(projectSlug);
    // Ensure the auth_users table exists
    await this.ensureAuthUsersTable(project.dbSchema);

    // Check if user already exists
    const existing = await this.drizzle.db.execute<{ id: string }>(sql`
        SELECT id FROM ${sql.identifier(project.dbSchema)}.auth_users
        WHERE email = ${dto.email}
    `);

    // If user already exists, throw an error
    if (existing.rows.length > 0) {
      throw new Error("User already exists");
    }

    // Hash the user's password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Insert the new user into the database
    const result = await this.drizzle.db.execute<{
      id: string;
      email: string;
    }>(sql`
        INSERT INTO ${sql.identifier(project.dbSchema)}.auth_users 
          (email, password_hash, provider)
        VALUES (${dto.email}, ${passwordHash}, ${AUTH_PROVIDERS.EMAIL})
        RETURNING id, email
    `);

    // Get the newly created user
    const user = result.rows[0];

    // Sign the JWT token
    const accessToken = this.signToken(
      user.id,
      user.email,
      project.id,
      project.authJwtSecret,
    );

    // Return the user and access token
    return { user: { id: user.id, email: user.email }, accessToken };
  }

  // Sign in an existing user
  async signIn(projectSlug: string, dto: SignInInput) {
    // Get the project by slug
    const project = await this.getProject(projectSlug);
    // Ensure the auth_users table exists
    await this.ensureAuthUsersTable(project.dbSchema);

    // Check if user exists
    const result = await this.drizzle.db.execute<{
      id: string;
      email: string;
      password_hash: string | null;
    }>(sql`
        SELECT id, email, password_hash 
        FROM ${sql.identifier(project.dbSchema)}.auth_users
        WHERE email = ${dto.email}
    `);

    // Get the user
    const user = result.rows[0];

    // Check if user exists
    // If user does not exist, throw an error
    if (!user?.password_hash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Compare the passwords
    const match = await bcrypt.compare(dto.password, user.password_hash);

    // If password does not match, throw an error
    if (!match) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const accessToken = this.signToken(
      user.id,
      user.email,
      project.id,
      project.authJwtSecret,
    );

    return { user: { id: user.id, email: user.email }, accessToken };
  }

  // Send a magic link to the user
  async sendMagicLink(projectSlug: string, email: string) {
    const project = await this.getProject(projectSlug);
    await this.ensureAuthUsersTable(project.dbSchema);

    // Check if user exists
    const existing = await this.drizzle.db.execute<{ id: string }>(sql`
      SELECT id FROM ${sql.identifier(project.dbSchema)}.auth_users
      WHERE email = ${email}
    `);

    // If user does not exist, create a new user
    if (existing.rows.length === 0) {
      await this.drizzle.db.execute(sql`
        INSERT INTO ${sql.identifier(project.dbSchema)}.auth_users  
          (email, provider, email_verified)
        VALUES (${email}, ${AUTH_PROVIDERS.EMAIL}, FALSE)
      `);
    }

    // Generate a magic link token
    const linkToken = this.jwtService.sign(
      { email, projectId: project.id },
      { secret: project.authJwtSecret, expiresIn: MAGIC_LINK_EXPIRES_IN },
    );

    // Create the magic link URL
    const apiUrl = this.configService.get<string>("API_URL");
    const magicLinkUrl = `${apiUrl}/projects/${projectSlug}/auth/magic-link/verify?token=${linkToken}`;

    // Send the magic link email
    await this.resend.emails.send({
      from: "Square Base <onboarding@resend.dev>",
      to: email,
      subject: "Your sign-in link for Square Base",
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 16px;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 32px 24px;">
            <h2 style="margin-top: 0; color: #09090b; font-size: 18px;">Sign in to your account</h2>
            <p style="color: #71717a; font-size: 14px; line-height: 1.5;">
              Click the button below to sign in with your email. No password needed.
            </p>
            <div style="margin: 24px 0;">
              <a href="${magicLinkUrl}" style="display: block; background-color: #5417D7; color: #ffffff; text-decoration: none; padding: 12px; text-align: center; border-radius: 8px; font-weight: 500; font-size: 14px;">
                Sign In
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 12px; margin-bottom: 4px;">Or copy and paste this link:</p>
            <p style="margin: 0; font-size: 12px; word-break: break-all;">
              <a href="${magicLinkUrl}" style="color: #5417D7;">${magicLinkUrl}</a>
            </p>
            <p style="color: #a1a1aa; font-size: 12px; margin-top: 16px; margin-bottom: 0;">This link expires soon (15 minutes). If you didn't request it, you can safely ignore this email.</p>
          </div>
        </body>
        </html>
      `,
    });

    return { message: "Magic link sent" };
  }

  // Verify a magic link
  async verifyMagicLink(projectSlug: string, token: string) {
    const project = await this.getProject(projectSlug);

    // Verify the magic link token
    let payload: { email: string; projectId: string };
    try {
      // Payload is to be verified with the project's authJwtSecret
      payload = this.jwtService.verify(token, {
        secret: project.authJwtSecret,
      });
    } catch {
      // If token is invalid or expired, throw an error
      throw new BadRequestException("Invalid or expired magic link");
    }

    // Get the user
    const result = await this.drizzle.db.execute<{
      id: string;
      email: string;
    }>(sql`
      SELECT id, email FROM ${sql.identifier(project.dbSchema)}.auth_users
      WHERE email = ${payload.email}
    `);

    // Check if user exists
    const user = result.rows[0];
    // If user does not exist, throw an error
    if (!user) {
      throw new BadRequestException("User not found");
    }

    const accessToken = this.signToken(
      user.id,
      user.email,
      project.id,
      project.authJwtSecret,
    );

    return { user: { id: user.id, email: user.email }, accessToken };
  }

  // Build the Google OAuth URL
  buildGoogleAuthUrl(clientId: string, redirectUri: string): string {
    // Create the URL parameters
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      // Specify the response type and scopes
      response_type: "code",
      scope: "openid email profile",
    });

    // Return the full Google OAuth URL
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // Build the GitHub OAuth URL
  buildGithubAuthUrl(clientId: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "user:email",
    });

    // Return the full GitHub OAuth URL
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  // Handle Google OAuth callback
  async handleGoogleCallback(projectSlug: string, code: string) {
    const project = await this.getProject(projectSlug);
    await this.ensureAuthUsersTable(project.dbSchema);

    // Check if Google OAuth is configured
    if (!project.googleClientId || !project.googleClientSecret) {
      throw new BadRequestException("Google OAuth not configured");
    }

    const apiUrl = this.configService.get<string>("API_URL");
    const redirectUri = `${apiUrl}/projects/${projectSlug}/auth/google/callback`;

    // Exchange authorization code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        // Set the content type to application/x-www-form-urlencoded
        "Content-Type": "application/x-www-form-urlencoded",
      },
      // Set the body parameters
      body: new URLSearchParams({
        code,
        client_id: project.googleClientId,
        client_secret: project.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    // Get the access token
    const tokenData = (await tokenRes.json()) as { access_token: string };

    // Get the user's profile information
    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    // Get the user's profile information
    const profile = (await profileRes.json()) as { email: string };

    // Find or create the user in the database
    return this.findOrCreateOAuthUser(
      project,
      profile.email,
      AUTH_PROVIDERS.GOOGLE,
    );
  }

  // Handle GitHub OAuth callback
  async handleGithubCallback(projectSlug: string, code: string) {
    const project = await this.getProject(projectSlug);
    await this.ensureAuthUsersTable(project.dbSchema);

    // Check if GitHub OAuth is configured
    if (!project.githubClientId || !project.githubClientSecret) {
      throw new BadRequestException("GitHub OAuth not configured");
    }

    const apiUrl = this.configService.get<string>("API_URL");
    const redirectUri = `${apiUrl}/projects/${projectSlug}/auth/github/callback`;

    // Exchange authorization code for access token
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          code,
          client_id: project.githubClientId,
          client_secret: project.githubClientSecret,
          redirect_uri: redirectUri,
        }),
      },
    );

    // Get the access token
    const tokenData = (await tokenRes.json()) as { access_token: string };

    // Get the user's profile information
    const profileRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });

    // Get the user's email addresses
    const emails = (await profileRes.json()) as Array<{
      email: string;
      primary: boolean;
    }>;

    // Find the primary email address
    const primary = emails.find((e) => e.primary) ?? emails[0];

    // Check if primary email is valid
    if (!primary?.email) {
      throw new BadRequestException("No email found for GitHub user");
    }

    // Find or create the user in the database
    return this.findOrCreateOAuthUser(
      project,
      primary.email,
      AUTH_PROVIDERS.GITHUB,
    );
  }

  // Find or create the user in the database
  private async findOrCreateOAuthUser(
    project: typeof projects.$inferSelect,
    email: string,
    provider: string,
  ) {
    // Find the user in the database
    const existing = await this.drizzle.db.execute<{
      id: string;
      email: string;
    }>(
      sql`
        SELECT id, email FROM ${sql.identifier(project.dbSchema)}.auth_users
        WHERE email = ${email}
      `,
    );

    // Get the user's profile information
    let user = existing.rows[0];

    // If user doesn't exist, create a new one
    if (!user) {
      const result = await this.drizzle.db.execute<{
        id: string;
        email: string;
      }>(
        sql`
          INSERT INTO ${sql.identifier(project.dbSchema)}.auth_users
            (email, provider, email_verified)
          VALUES (${email}, ${provider}, TRUE)
          RETURNING id, email
        `,
      );

      user = result.rows[0];
    }

    // Sign the user's access token
    const accessToken = this.signToken(
      user.id,
      user.email,
      project.id,
      project.authJwtSecret,
    );

    // Return the user and access token
    return { user: { id: user.id, email: user.email }, accessToken };
  }

  // Get all users for a project
  async getUsers(projectSlug: string) {
    const project = await this.getProject(projectSlug);
    await this.ensureAuthUsersTable(project.dbSchema);

    // Get all users for the project
    const result = await this.drizzle.db.execute<{
      id: string;
      email: string;
      email_verified: boolean;
      provider: string;
      created_at: string;
    }>(
      sql`
        SELECT id, email, email_verified, provider, created_at
        FROM ${sql.identifier(project.dbSchema)}.auth_users
        ORDER BY created_at DESC -- Order by created_at descending
      `,
    );

    // Map the result rows to the desired format
    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      emailVerified: row.email_verified,
      provider: row.provider,
      createdAt: row.created_at,
    }));
  }

  // Get OAuth settings for a project
  async getOAuthSettings(projectSlug: string) {
    const project = await this.getProject(projectSlug);

    // Return the OAuth settings for the project
    return {
      siteUrl: project.siteUrl,
      googleClientId: project.googleClientId,
      googleClientSecret: project.googleClientSecret,
      githubClientId: project.githubClientId,
      githubClientSecret: project.githubClientSecret,
    };
  }

  resolveSiteUrl(project: typeof projects.$inferSelect): string {
    return (
      project.siteUrl ??
      this.configService.get<string>("WEB_URL") ??
      "http://localhost:3000"
    );
  }

  async getSiteUrlForProject(projectSlug: string): Promise<string> {
    const project = await this.getProject(projectSlug);
    return this.resolveSiteUrl(project);
  }

  // Update OAuth settings for a project
  async updateOAuthSettings(
    projectSlug: string,
    settings: {
      siteUrl?: string;
      googleClientId?: string;
      googleClientSecret?: string;
      githubClientId?: string;
      githubClientSecret?: string;
    },
  ) {
    const project = await this.getProject(projectSlug);

    // Update the project's OAuth settings
    const [updated] = await this.drizzle.db
      .update(projects)
      .set(settings)
      .where(eq(projects.id, project.id))
      .returning();

    return updated;
  }
}

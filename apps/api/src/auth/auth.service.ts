import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { DrizzleService } from "../db/drizzle.service.js";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { COOKIE_KEYS } from "@square-base-db/constants";
import slugify from "slugify";
import { randomBytes } from "crypto";
import { RegisterDto } from "./dto/register.dto.js";
import { users } from "../db/schema/users.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { organizations, orgMembers } from "../db/schema/index.js";
import { LoginDto } from "./dto/login.dto.js";
import { JwtPayload } from "@square-base-db/types";

@Injectable()
export class AuthService {
  constructor(
    private drizzle: DrizzleService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Cookie helpers
  setTokenCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    const isProduction = this.configService.get("NODE_ENV") === "production";

    res.cookie(COOKIE_KEYS.ACCESS_TOKEN, tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie(COOKIE_KEYS.REFRESH_TOKEN, tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearTokenCookies(res: Response) {
    res.clearCookie(COOKIE_KEYS.ACCESS_TOKEN);
    res.clearCookie(COOKIE_KEYS.REFRESH_TOKEN);
  }

  // Slug helper
  private generateOrgSlug(name: string): string {
    const base = slugify(`${name}-org`, { lower: true, strict: true });
    const suffix = randomBytes(3).toString("hex");

    return `${base}-${suffix}`;
  }

  // JWT signin
  private signTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_ACCESS_SECRET"),
      expiresIn: this.configService.get("JWT_ACCESS_EXPIRES_IN"),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_REFRESH_SECRET"),
      expiresIn: this.configService.get("JWT_REFRESH_EXPIRES_IN"),
    });

    return { accessToken, refreshToken };
  }

  // Email + password
  async register(dto: RegisterDto) {
    const existing = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    // Check if email is already in use
    if (existing.length > 0) {
      throw new ConflictException("Email is already in use");
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user, organization, and org member
    const [user] = await this.drizzle.db
      .insert(users)
      .values({ email: dto.email, name: dto.name, passwordHash })
      .returning();

    const [org] = await this.drizzle.db
      .insert(organizations)
      .values({
        name: `${dto.name}'s Org`,
        slug: this.generateOrgSlug(dto.name),
      })
      .returning();

    // Add user to organization as admin
    await this.drizzle.db.insert(orgMembers).values({
      orgId: org.id,
      userId: user.id,
      role: "admin",
    });

    return this.signTokens(user.id, user.email);
  }

  // Login
  async login(dto: LoginDto) {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    // If user is not found or password hash is missing, throw an error
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);

    // If password does not match, throw an error
    if (!passwordMatch) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.signTokens(user.id, user.email);
  }

  // Refresh token
  async refreshTokens(refreshToken: string) {
    try {
      // Verify the refresh token and extract the payload
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get("JWT_REFRESH_SECRET"),
      });

      // Find the user by ID from the payload
      const [user] = await this.drizzle.db
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);

      // If user is not found, throw an error
      if (!user) throw new UnauthorizedException();

      // Sign new tokens for the user
      return this.signTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  // OAuth user handling (e.g., Google, GitHub)
  async handleOAuthUser(profile: {
    email: string;
    name: string;
    avatarUrl: string | null;
  }) {
    let [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);

    // If user does not exist, create a new user and organization
    if (!user) {
      const [newUser] = await this.drizzle.db
        .insert(users)
        .values({
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        })
        .returning();

      user = newUser;

      // Create a new organization for the user
      const [org] = await this.drizzle.db
        .insert(organizations)
        .values({
          name: `${profile.name}'s Org`,
          slug: this.generateOrgSlug(profile.name),
        })
        .returning();

      // Add the user to the organization as an admin
      await this.drizzle.db.insert(orgMembers).values({
        orgId: org.id,
        userId: user.id,
        role: "admin",
      });
    }

    // Sign and return tokens for the user
    return this.signTokens(user.id, user.email);
  }

  // Generate Google OAuth URL
  getGoogleAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.configService.get<string>("GOOGLE_CLIENT_ID")!,
      redirect_uri: this.configService.get<string>("GOOGLE_CALLBACK_URL")!,
      response_type: "code", // Requesting an authorization code
      scope: "openid email profile", // Requesting basic profile info and email
      access_type: "offline", // Requesting a refresh token
    });

    // Return the full Google OAuth URL with query parameters
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // Handle Google OAuth callback
  async handleGoogleCallback(code: string) {
    // Exchange the authorization code for an access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, // Set the content type for form data
      body: new URLSearchParams({
        code,
        client_id: this.configService.get<string>("GOOGLE_CLIENT_ID")!,
        client_secret: this.configService.get<string>("GOOGLE_CLIENT_SECRET")!,
        redirect_uri: this.configService.get<string>("GOOGLE_CALLBACK_URL")!,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token: string };

    // Use the access token to fetch the user's profile information from Google
    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );

    // Parse the user's profile information from the response
    const profile = (await profileRes.json()) as {
      email: string;
      name: string;
      picture: string | null;
    };

    // Handle the OAuth user and return tokens
    return this.handleOAuthUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture ?? null,
    });
  }

  // Generate GitHub OAuth URL
  getGithubAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.configService.get<string>("GITHUB_CLIENT_ID")!,
      redirect_uri: this.configService.get<string>("GITHUB_CALLBACK_URL")!,
      scope: "read:user user:email", // Requesting basic profile info and email
    });

    // Return the full GitHub OAuth URL with query parameters
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  // Handle GitHub OAuth callback
  async handleGithubCallback(code: string) {
    // Exchange the authorization code for an access token
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
          client_id: this.configService.get<string>("GITHUB_CLIENT_ID"),
          client_secret: this.configService.get<string>("GITHUB_CLIENT_SECRET"),
          redirect_uri: this.configService.get<string>("GITHUB_CALLBACK_URL"),
        }),
      },
    );

    // Parse the access token from the response
    const tokenData = (await tokenRes.json()) as { access_token: string };

    // Use the access token to fetch the user's profile information from GitHub
    const profileRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json", // Requesting the GitHub API to return JSON data
      },
    });

    // Parse the user's profile information from the response
    const profile = (await profileRes.json()) as {
      email: string | null;
      name: string | null;
      login: string;
      avatar_url: string | null;
    };

    let email = profile.email;

    // If the email is not available in the profile, fetch the user's emails from GitHub
    if (!email) {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/vnd.github+json", // Requesting the GitHub API to return JSON data
        },
      });

      // Parse the user's emails from the response
      const emails = (await emailRes.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];

      // Find the primary and verified email from the list of emails
      email = emails.find((e) => e.primary && e.verified)?.email ?? null;
    }

    // Return the result of handling the OAuth user with the obtained email, name, and avatar URL
    return this.handleOAuthUser({
      email: email!,
      name: profile.name ?? profile.login,
      avatarUrl: profile.avatar_url ?? null,
    });
  }
}

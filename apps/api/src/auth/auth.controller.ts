import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { ConfigService } from "@nestjs/config";
import { RegisterDto } from "./dto/register.dto.js";
import type { Request, Response } from "express";
import { LoginDto } from "./dto/login.dto.js";
import { COOKIE_KEYS } from "@square-base-db/constants";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { CurrentUser } from "./current-user.decorator.js";
import type { JwtPayload } from "@square-base-db/types";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  // Endpoint for user registration
  // This endpoint handles user registration requests.
  // It expects a RegisterDto object in the request body
  // and returns a success message upon successful registration.
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Call the AuthService to register the user with the provided data transfer object (DTO)
    const tokens = await this.authService.register(dto);
    this.authService.setTokenCookies(res, tokens);

    return { message: "User registered successfully" };
  }

  // Endpoint for user login
  // This endpoint handles user login requests.
  // It expects a LoginDto object in the request body
  // and returns a success message upon successful login.
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Call the AuthService to log in the user with the provided data transfer object (DTO)
    const tokens = await this.authService.login(dto);
    this.authService.setTokenCookies(res, tokens);

    return { message: "User logged in successfully" };
  }

  // Endpoint for user logout
  // This endpoint handles user logout requests.
  // It clears the authentication cookies and returns a success message upon successful logout.
  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearTokenCookies(res);
    return { message: "User logged out successfully" };
  }

  // Endpoint for refreshing authentication tokens
  // This endpoint handles requests to refresh authentication tokens.
  // It expects a refresh token in the request cookies and returns new tokens upon successful refresh.
  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Get the refresh token from the request cookies
    const refreshToken = req.cookies[COOKIE_KEYS.REFRESH_TOKEN];
    const tokens = await this.authService.refreshTokens(refreshToken);
    this.authService.setTokenCookies(res, tokens);
    return { message: "Tokens refreshed successfully" };
  }

  // Endpoint for retrieving the current authenticated user's information
  // This endpoint is protected by the JwtAuthGuard, which ensures that only authenticated users can access it.
  // It returns the current authenticated user's information extracted from the JWT payload.
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  // Endpoint for initiating Google OAuth login
  // This endpoint redirects the user to the Google OAuth login page.
  @Get("google")
  @Redirect()
  googleLogin() {
    return { url: this.authService.getGoogleAuthUrl() };
  }

  // Endpoint for handling the Google OAuth callback
  // This endpoint is called by Google after the user has authenticated.
  // It exchanges the authorization code for tokens, sets the authentication cookies,
  // and redirects the user to the dashboard page.
  @Get("google/callback")
  async googleCallback(@Query("code") code: string, @Res() res: Response) {
    const tokens = await this.authService.handleGoogleCallback(code);
    this.authService.setTokenCookies(res, tokens);

    // Redirect the user to the dashboard page after successful authentication
    return res.redirect(
      `${this.configService.get<string>("WEB_URL")}/dashboard`,
    );
  }

  // Endpoint for initiating GitHub OAuth login
  // This endpoint redirects the user to the GitHub OAuth login page.
  @Get("github")
  @Redirect()
  githubLogin() {
    return { url: this.authService.getGithubAuthUrl() };
  }

  // Endpoint for handling the GitHub OAuth callback
  // This endpoint is called by GitHub after the user has authenticated.
  // It exchanges the authorization code for tokens, sets the authentication cookies,
  // and redirects the user to the dashboard page.
  @Get("github/callback")
  async githubCallback(@Query("code") code: string, @Res() res: Response) {
    const tokens = await this.authService.handleGithubCallback(code);
    this.authService.setTokenCookies(res, tokens);

    // Redirect the user to the dashboard page after successful authentication
    return res.redirect(
      `${this.configService.get<string>("WEB_URL")}/dashboard`,
    );
  }
}

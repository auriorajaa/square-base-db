import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { COOKIE_KEYS } from "@square-base-db/constants";
import { JwtPayload } from "@square-base-db/types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // This method is called to determine if the current request is allowed to proceed.
  canActivate(context: ExecutionContext): boolean {
    // Get the HTTP request from the execution context
    const request = context.switchToHttp().getRequest<Request>();

    // Get the JWT token from the request cookies
    const token = request.cookies?.[COOKIE_KEYS.ACCESS_TOKEN] as
      string | undefined;

    // If the token is not present, throw an UnauthorizedException
    if (!token) {
      throw new UnauthorizedException("Not authenticated");
    }

    try {
      // Verify the JWT token using the JwtService and the secret from the ConfigService
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      });

      // Attach the decoded payload to the request object for later use in the request lifecycle
      // This allows other parts of the application to access the authenticated user's information
      (request as Record<string, any>)["user"] = payload;

      // If the token is valid, allow the request to proceed
      return true;
    } catch {
      // If the token is invalid or expired, throw an UnauthorizedException
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}

import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "@square-base-db/types";
import { Request } from "express";

// This decorator extracts the current authenticated user's information from the request object.
export const CurrentUser = createParamDecorator(
  // This function is called to extract the current user's information from the request object.
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    // Get the HTTP request from the execution context
    const request = ctx.switchToHttp().getRequest<Request>();

    // Return the user information attached to the request object by the JwtAuthGuard
    return (request as Record<string, any>)["user"] as JwtPayload;
  },
);

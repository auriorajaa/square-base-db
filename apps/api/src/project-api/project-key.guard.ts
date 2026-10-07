import { PROJECT_KEY_ROLES } from "@square-base-db/constants";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

export interface ProjectKeyPayload {
  projectId: string;
  role: typeof PROJECT_KEY_ROLES.ANON | typeof PROJECT_KEY_ROLES.SERVICE_ROLE;
}

// Guard to validate the project key (JWT) in the Authorization header
// The project key is expected to be a JWT with the following payload:
// {
//   projectId: string;
//   role: "anon" | "service_role";
// }
// The JWT is signed with the PROJECT_JWT_SECRET from the environment variables
// The guard will throw an UnauthorizedException if the JWT is missing, invalid, or expired
@Injectable()
export class ProjectKeyGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    // Check if the Authorization header is present and starts with "Bearer "
    // If not, throw an UnauthorizedException
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid API key");
    }

    // Extract the token from the Authorization header
    const token = authHeader.slice(7); // Remove "Bearer " prefix

    try {
      // Verify the JWT and extract the payload
      const payload = this.jwtService.verify<ProjectKeyPayload>(token, {
        secret: this.configService.get<string>("PROJECT_JWT_SECRET"),
      });

      // Attach the payload to the request object for later use
      // @ts-ignore
      request["projectKey"] = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid API key");
    }
  }
}

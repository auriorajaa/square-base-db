import { LoginInput } from "@square-base-db/types";
import { IsEmail, IsString } from "class-validator";

export class LoginDto implements LoginInput {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

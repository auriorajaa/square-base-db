import { SignInInput } from "@square-base-db/types";
import { IsEmail, IsString, MinLength } from "class-validator";

export class SignInDto implements SignInInput {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

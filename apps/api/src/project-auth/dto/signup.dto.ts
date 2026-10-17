import { SignUpInput } from "@square-base-db/types";
import { IsEmail, IsString, MinLength } from "class-validator";

export class SignUpDto implements SignUpInput {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password: string;
}

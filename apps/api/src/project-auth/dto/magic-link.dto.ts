import { MagicLinkInput } from "@square-base-db/types";
import { IsEmail } from "class-validator";

export class MagicLinkDto implements MagicLinkInput {
  @IsEmail()
  email!: string;
}

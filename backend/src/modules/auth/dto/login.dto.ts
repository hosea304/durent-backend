import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** POST /auth/login (API_CONTRACT §3). */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

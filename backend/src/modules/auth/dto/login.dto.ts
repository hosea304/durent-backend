import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** POST /auth/login (API_CONTRACT §3). */
export class LoginDto {
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200) // batasi biaya hashing — cegah DoS via password raksasa
  password!: string;
}


import { Body, Controller, Delete, HttpCode, Param, Post, UnauthorizedException } from '@nestjs/common';
import { Public, TokenService, EmailVerificationService} from '@nestjs/authentication';
import { UsersService } from '../users/users.service.js';
import { signInSchema, signUpSchema, type SignInDto, type SignUpDto } from './auth.schemas.js'
import { AuthService } from './auth.service.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Post('sign-up')
  @HttpCode(201)
  async signUp(@Body({ schema: signUpSchema }) signUpCredentials: SignUpDto){
    const user = await this.authService.SignUp(signUpCredentials);
    await this.emailVerificationService.send({ id: user.id, email: user.email });
    return user;
  }

  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body({ schema: signInSchema }) signInCredentials: SignInDto) {
    return this.authService.SignIn(signInCredentials);
  }

  @Delete('delete-user/:id')//Da cambiare
  @HttpCode(204)
  async deleteUser(@Param('id') id: string) {
    await this.usersService.deleteUserById(id);
  }
}



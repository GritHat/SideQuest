
import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { EmailVerificationService, Public } from '@nestjs/authentication';
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
  async signUp(@Body({ schema: signUpSchema }) user: SignUpDto){
    const registeredUser = await this.authService.SignUp(user);
    await this.emailVerificationService.send({ id: registeredUser.id, email: registeredUser.email });
    return registeredUser;
  }

  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body({ schema: signInSchema }) user: SignInDto) {
    return this.authService.login(user);
  }

  @Delete('delete-user/:id')//Da cambiare
  @HttpCode(204)
  async deleteUser(@Param('id') id: string) {
    await this.usersService.deleteUserById(id);
  }
}



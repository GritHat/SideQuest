
import { Body, Controller, Delete, HttpCode, Param, Post, UnauthorizedException } from '@nestjs/common';
import { Public, TokenService } from '@nestjs/authentication';
import { UsersService } from '../users/users.service.js';
import { signInSchema, signUpSchema, type SignInDto, type SignUpDto } from './auth.schemas.js'
import { AuthService } from './auth.service.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService
  ) {}

  @Post('sign-up')
  @HttpCode(201)
  async signUp(@Body({ schema: signUpSchema }) user: SignUpDto){
    return this.authService.SignUp(user);
  }

  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body({ schema: signInSchema }) user: SignInDto) {
    // TODO: Implement sign-in logic
    //return this.authService.SignIn(user);
    return this.authService.loginTest(user);
  }

  @Delete('delete-user/:id')//Da cambiare
  @HttpCode(204)
  async deleteUser(@Param('id') id: string) {
    await this.usersService.deleteUserById(id);
  }
}



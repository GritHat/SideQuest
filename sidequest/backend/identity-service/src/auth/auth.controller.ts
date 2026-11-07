
import { Body, Controller, Delete, HttpCode, Param, Post, UnauthorizedException } from '@nestjs/common';
import { Public, TokenService } from '@nestjs/authentication';
import { UsersService } from '../users/users.service.js';
import { CredentialsService } from './credentials.service.js';
import { signInSchema, signUpSchema, type SignInDto, type SignUpDto } from './auth.schemas.js'

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  @Post('sign-up')
  @HttpCode(201)
  async signUp(@Body({ schema: signUpSchema }) body: SignUpDto){
    const user = await this.credentialsService.register(body.username, body.email, body.password);
    return user;
  }

  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body({ schema: signInSchema }) body: SignInDto) {
    const user = await this.credentialsService.verify(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.tokenService.issue(user.id, {
      method: 'password',
      claims: { amr: ['pwd'] },
    });
  }

  @Delete('delete-user/:id')
  @HttpCode(204)
  async deleteUser(@Param('id') id: string) {
    await this.usersService.deleteUserById(id);
  }
}



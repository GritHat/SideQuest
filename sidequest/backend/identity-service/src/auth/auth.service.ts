import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CredentialsService } from './credentials.service.js';
import { TokenService } from '@nestjs/authentication';
import { SignInDto, SignUpDto } from './auth.dto.js';
import { JwtService } from '@nestjs/jwt';


@Injectable()
export class AuthService {
    constructor(private readonly credentialsService: CredentialsService, 
      private readonly tokenService: TokenService,
      private readonly jwtService: JwtService) {}
    
    async SignUp(dto: SignUpDto) {
        const user = await this.credentialsService.register(dto.username, dto.email, dto.password);
        if(!user)
          throw new UnauthorizedException('Failed to create user');
        return user;
    }

    async SignIn(dto: SignInDto) {
    const user = await this.credentialsService.verify(dto.email, dto.password);
    if(!user)
      throw new UnauthorizedException('Invalid email or password');
    return this.tokenService.issue(user.id, {
      method: 'password',
      claims: { amr: ['pwd'] },
    });
  }

  //Test Method
  async loginTest(dto: SignInDto): Promise<{ accessToken: string }> {
    const user = await this.credentialsService.verify(dto.email, dto.password);
    if(!user)
      throw new UnauthorizedException('Invalid email or password');
    const payload = {
      sub: user.id,
      email: user.email,
    };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}

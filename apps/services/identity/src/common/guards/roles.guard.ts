import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../users/user.js';

export const Roles = Reflector.createDecorator<Role[]>();

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>( Roles, [
      context.getHandler(),
      context.getClass()
    ]);

    //Se non c'è @Roles(...) è accessibile a tutti
    if (!requiredRoles || requiredRoles.length === 0){return true;}

    const {user } = context.switchToHttp().getRequest();

    // Verifica che l'utente esista e abbia almeno uno dei ruoli richiesti
    return requiredRoles.some((role) => user?.roles?.includes(role));
  }
}

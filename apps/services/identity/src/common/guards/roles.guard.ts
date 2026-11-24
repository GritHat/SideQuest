import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../users/user.js';

export const Roles = Reflector.createDecorator<Role[]>();

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se non c'è @Roles(...) è accessibile a tutti (l'autenticazione è gestita altrove)
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    // Utente assente = non autenticato → 401, non 403
    if (!user) throw new UnauthorizedException();

    // Utente presente ma senza il ruolo richiesto → canActivate false → 403
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}

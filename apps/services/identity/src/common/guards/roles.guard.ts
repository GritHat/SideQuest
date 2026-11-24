import { applyDecorators, Injectable, SetMetadata, UseGuards, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../users/user.js';

export const ROLES_KEY = 'roles';

/**
 * Decorator composto: imposta i ruoli richiesti E aggiunge RolesGuard come guard
 * a livello di route. Essendo un guard locale (non APP_GUARD), gira DOPO i guard
 * globali; in particolare dopo il JWT guard che popola req.user.
 */
export const Roles = (roles: Role[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles), 
    UseGuards(RolesGuard)
  );

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    // Il JWT guard globale ha già garantito che user sia definito;
    // se per qualche motivo non lo fosse, nessun ruolo → accesso negato (403).
    return !!user && requiredRoles.some((role) => user.roles?.includes(role));
  }
}

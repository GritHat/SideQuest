import { Policy } from '@nestjs/authorization';
import type { Ability, PolicyBefore } from '@nestjs/authorization';

import type { User } from '../../users/user.js';

/**
 * Policy for user-management actions.
 *
 * `before()` runs first on every ability: admins are allowed everything
 * without needing an explicit check in each method. Non-admins fall through
 * to the individual ability that decides.
 */
@Policy()
export class UserPolicy implements PolicyBefore<User, Ability<UserPolicy>> {
  before(
    user: User | null,
    _ability: Ability<UserPolicy>,
  ): boolean | undefined {
    // Admins pass every check unconditionally.
    if (user?.roles.includes('admin')) return true;
    // Everyone else is evaluated ability by ability.
    return undefined;
  }

  /** A user may delete their own account; admins are already allowed by before(). */
  delete(user: User | null, targetId: string): boolean {
    return !!user && user.id === targetId;
  }

  /** Admin-only actions: non-admins are always denied; admins pass via before(). */
  manage(_user: User | null): boolean {
    return false;
  }
}

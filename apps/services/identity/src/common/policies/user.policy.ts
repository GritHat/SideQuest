import { Policy } from '@nestjs/authorization';
import type { Ability, PolicyBefore } from '@nestjs/authorization';
import type { User } from '../../users/user.js';

const isModerator = (user:User | null) => !!user?.roles.includes('moderator');
const isAdmin = (user:User | null) => !!user?.roles.includes('admin');

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
    ability: Ability<UserPolicy>,
  ): boolean | undefined {
    return isAdmin(user)
      ? true
      : undefined;
  }

  deleteSelf(user: User | null): boolean {
    return user !== null;
  }

  manage(_user: User | null): boolean {
    return false;
  }
}

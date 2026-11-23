import { signInSchema, signUpSchema } from './auth.schemas.js';

/**
 * Equivalence classes and boundary values for the sign-up input.
 * username: [3, 64] chars · password: [12, 128] chars with lower, upper, digit and symbol.
 */
const valid = { username: 'explorer', email: 'explorer@sidequest.local', password: 'Abcdefgh12!x' };
const ok = (input: unknown) => signUpSchema.safeParse(input).success;
const pwd = (length: number) => 'Aa1!'.padEnd(length, 'x');

describe('signUpSchema', () => {
  it('accepts a valid representative of every field', () => {
    expect(ok(valid)).toBe(true);
  });

  it.each([
    ['username', 'abc', true],
    ['username', 'ab', false],
    ['username', 'a'.repeat(64), true],
    ['username', 'a'.repeat(65), false],
    ['password', pwd(12), true],
    ['password', pwd(11), false],
    ['password', pwd(128), true],
    ['password', pwd(129), false],
  ])('%s of length %#: boundary %s', (field, value, expected) => {
    expect(ok({ ...valid, [field]: value })).toBe(expected);
  });

  it.each([
    ['no uppercase', 'abcdefgh12!x'],
    ['no lowercase', 'ABCDEFGH12!X'],
    ['no digit', 'Abcdefghij!x'],
    ['no symbol', 'Abcdefgh12xx'],
  ])('rejects a password with %s', (_, password) => {
    expect(ok({ ...valid, password })).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(ok({ ...valid, email: 'not-an-email' })).toBe(false);
  });

  it('rejects missing fields and unknown fields (strict)', () => {
    expect(ok({ username: valid.username, email: valid.email })).toBe(false);
    expect(ok({ ...valid, role: 'ADMIN' })).toBe(false);
  });
});

describe('signInSchema', () => {
  it('requires a valid email and a password, and nothing else', () => {
    expect(signInSchema.safeParse({ email: valid.email, password: 'x' }).success).toBe(true);
    expect(signInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: valid.email, password: 'x', remember: true }).success).toBe(false);
  });
});

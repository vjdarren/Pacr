import bcrypt from 'bcrypt';
import { getPool } from '../utils/database';
import { issueTokenPair, rotateRefreshToken, invalidateRefreshToken } from './token.service';
import { config } from '../config';
import type { TokenPair, UserRow, HmsTokenInfo } from '../types';

const BCRYPT_ROUNDS = 12;

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// --------------------------------------------------------------------------
// Registration
// --------------------------------------------------------------------------

export async function register(
  email: string,
  password: string
): Promise<TokenPair> {
  const db = getPool();

  const existing = await db.query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email.toLowerCase()]
  );
  if (existing.rows.length > 0) {
    throw new AuthError('Email already registered', 'EMAIL_TAKEN', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
    [email.toLowerCase(), passwordHash]
  );

  const userId = result.rows[0].id;
  return issueTokenPair(userId, email.toLowerCase());
}

// --------------------------------------------------------------------------
// Login
// --------------------------------------------------------------------------

export async function login(
  email: string,
  password: string
): Promise<TokenPair> {
  const db = getPool();

  const result = await db.query<UserRow>(
    'SELECT id, email, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email.toLowerCase()]
  );

  const user = result.rows[0];
  if (!user || !user.password_hash) {
    // Constant-time rejection — always run bcrypt to prevent timing attacks
    await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000000');
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }

  return issueTokenPair(user.id, user.email);
}

// --------------------------------------------------------------------------
// Token refresh
// --------------------------------------------------------------------------

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const result = await rotateRefreshToken(refreshToken);
  if (!result) {
    throw new AuthError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN', 401);
  }

  // Fetch email from DB to include in new access token
  const db = getPool();
  const row = await db.query<{ email: string }>(
    'SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL',
    [result.record.userId]
  );

  if (!row.rows[0]) {
    throw new AuthError('User not found', 'USER_NOT_FOUND', 401);
  }

  // Re-issue with correct email in JWT
  return issueTokenPair(result.record.userId, row.rows[0].email, result.record.familyId);
}

// --------------------------------------------------------------------------
// Logout
// --------------------------------------------------------------------------

export async function logout(refreshToken: string): Promise<void> {
  await invalidateRefreshToken(refreshToken);
}

// --------------------------------------------------------------------------
// HMS SSO
// --------------------------------------------------------------------------

export async function hmsLogin(accessToken: string): Promise<TokenPair> {
  const tokenInfo = await verifyHmsToken(accessToken);

  const db = getPool();

  // Upsert user by HMS open ID
  const result = await db.query<{ id: string; email: string }>(
    `INSERT INTO users (hms_open_id, email)
     VALUES ($1, $2)
     ON CONFLICT (hms_open_id) DO UPDATE
       SET updated_at = NOW()
     RETURNING id, email`,
    [tokenInfo.sub, tokenInfo.email ?? `hms_${tokenInfo.sub}@pacr.app`]
  );

  const user = result.rows[0];
  return issueTokenPair(user.id, user.email);
}

async function verifyHmsToken(accessToken: string): Promise<HmsTokenInfo> {
  const url = new URL(config.hms.tokenVerifyUrl);
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new AuthError('HMS token verification failed', 'HMS_INVALID_TOKEN', 401);
  }

  const body = (await res.json()) as Record<string, unknown>;

  if (!body.sub || typeof body.sub !== 'string') {
    throw new AuthError('Invalid HMS token response', 'HMS_INVALID_RESPONSE', 401);
  }

  return {
    sub: body.sub,
    email: typeof body.email === 'string' ? body.email : undefined,
    display_name: typeof body.display_name === 'string' ? body.display_name : undefined,
  };
}

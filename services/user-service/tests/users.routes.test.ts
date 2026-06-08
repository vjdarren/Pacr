/**
 * Integration-style tests for users routes.
 * All external dependencies (DB, JWT) are mocked.
 */
import Fastify, { FastifyInstance } from 'fastify';

// ── Mock the database utilities ───────────────────────────────────────────────
const mockGetUserById = jest.fn();
const mockUpdateUser = jest.fn();
const mockGetRunnerProfile = jest.fn();
const mockUpsertRunnerProfile = jest.fn();

jest.mock('../src/utils/database', () => ({
  initDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  getPool: jest.fn(),
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
  getRunnerProfile: (...args: unknown[]) => mockGetRunnerProfile(...args),
  upsertRunnerProfile: (...args: unknown[]) => mockUpsertRunnerProfile(...args),
}));

// ── Mock verify-token middleware to inject a test user ────────────────────────
jest.mock('../src/middleware/verify-token', () => ({
  verifyToken: jest.fn(async (request: { user?: { sub: string; email: string } }) => {
    request.user = { sub: TEST_USER_ID, email: TEST_USER_EMAIL };
  }),
}));

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_EMAIL = 'runner@pacr.app';

async function buildTestApp(): Promise<FastifyInstance> {
  const { usersRoutes } = await import('../src/routes/users.routes');
  const app = Fastify({ logger: false });
  await app.register(usersRoutes);
  return app;
}

let app: FastifyInstance;

beforeEach(async () => {
  jest.clearAllMocks();
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/users/me
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/users/me', () => {
  it('returns the user record when found', async () => {
    const user = {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      display_name: 'Test Runner',
      subscription_tier: 'free',
      subscription_expiry: null,
      locale: 'en',
      timezone: 'UTC',
      onboarding_complete: true,
      created_at: new Date().toISOString(),
    };
    mockGetUserById.mockResolvedValueOnce(user);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer test.token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_USER_ID);
    expect(mockGetUserById).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('returns 404 when user does not exist', async () => {
    mockGetUserById.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer test.token' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('USER_NOT_FOUND');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/users/me
// ═══════════════════════════════════════════════════════════════════════════════

describe('PATCH /api/v1/users/me', () => {
  it('updates and returns the user on valid body', async () => {
    const updated = {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      display_name: 'New Name',
      subscription_tier: 'free',
      subscription_expiry: null,
      locale: 'en',
      timezone: 'America/New_York',
      onboarding_complete: true,
      created_at: new Date().toISOString(),
    };
    mockUpdateUser.mockResolvedValueOnce(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: { display_name: 'New Name', timezone: 'America/New_York' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.display_name).toBe('New Name');
  });

  it('returns 400 when display_name is empty string', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: { display_name: '' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_BODY');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/users/me/profile
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/users/me/profile', () => {
  it('returns the runner profile (may be null when not yet created)', async () => {
    mockGetRunnerProfile.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/profile',
      headers: { authorization: 'Bearer test.token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  it('returns profile data when it exists', async () => {
    const profile = {
      user_id: TEST_USER_ID,
      goal_type: 'marathon',
      experience_level: 'intermediate',
      weekly_days: 5,
      max_session_min: 90,
    };
    mockGetRunnerProfile.mockResolvedValueOnce(profile);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/profile',
      headers: { authorization: 'Bearer test.token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.goal_type).toBe('marathon');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/users/me/profile
// ═══════════════════════════════════════════════════════════════════════════════

describe('PATCH /api/v1/users/me/profile', () => {
  it('upserts and returns the runner profile', async () => {
    const profile = {
      user_id: TEST_USER_ID,
      goal_type: '10k',
      experience_level: 'beginner',
      weekly_days: 3,
    };
    mockUpsertRunnerProfile.mockResolvedValueOnce(profile);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me/profile',
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: { goal_type: '10k', experience_level: 'beginner', weekly_days: 3 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.goal_type).toBe('10k');
  });

  it('returns 400 when goal_type has an invalid enum value', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me/profile',
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: { goal_type: 'ultramarathon' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('INVALID_BODY');
  });
});

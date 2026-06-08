/**
 * Integration-style tests for sessions routes.
 * All external dependencies (DB, Redis, Kafka, JWT) are mocked.
 */
import Fastify, { FastifyInstance } from 'fastify';

// ── Mock database utilities ───────────────────────────────────────────────────
const mockGetTodaySession = jest.fn();
const mockGetUpcomingSessions = jest.fn();
const mockMarkSessionComplete = jest.fn();
const mockMarkSessionSkipped = jest.fn();
const mockGetReadinessScoreFromDb = jest.fn();

jest.mock('../src/utils/database', () => ({
  initDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  getPool: jest.fn(),
  getTodaySession: (...args: unknown[]) => mockGetTodaySession(...args),
  getUpcomingSessions: (...args: unknown[]) => mockGetUpcomingSessions(...args),
  markSessionComplete: (...args: unknown[]) => mockMarkSessionComplete(...args),
  markSessionSkipped: (...args: unknown[]) => mockMarkSessionSkipped(...args),
  getReadinessScoreFromDb: (...args: unknown[]) => mockGetReadinessScoreFromDb(...args),
  getSessionById: jest.fn(),
}));

// ── Mock Redis utilities ──────────────────────────────────────────────────────
const mockGetCachedReadiness = jest.fn();

jest.mock('../src/utils/redis', () => ({
  initRedis: jest.fn(),
  closeRedis: jest.fn(),
  getRedis: jest.fn(),
  getCachedReadiness: (...args: unknown[]) => mockGetCachedReadiness(...args),
}));

// ── Mock Kafka utilities ──────────────────────────────────────────────────────
jest.mock('../src/utils/kafka', () => ({
  initKafkaProducer: jest.fn(),
  closeKafkaProducer: jest.fn(),
  getProducer: jest.fn(),
  publishSessionCompleted: jest.fn().mockResolvedValue(undefined),
  startPlanGeneratedConsumer: jest.fn(),
  startRunCompletedConsumer: jest.fn(),
  closePlanGeneratedConsumer: jest.fn(),
  closeRunCompletedConsumer: jest.fn(),
}));

// ── Mock verify-token middleware ──────────────────────────────────────────────
jest.mock('../src/middleware/verify-token', () => ({
  verifyToken: jest.fn(async (request: { user?: { sub: string; email: string } }) => {
    request.user = { sub: TEST_USER_ID, email: TEST_USER_EMAIL };
  }),
}));

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_USER_EMAIL = 'runner@pacr.app';
const TEST_SESSION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

async function buildTestApp(): Promise<FastifyInstance> {
  const { sessionsRoutes } = await import('../src/routes/sessions.routes');
  const app = Fastify({ logger: false });
  await app.register(sessionsRoutes);
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
// GET /api/v1/sessions/today
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/sessions/today', () => {
  it('returns the planned session when readiness is normal', async () => {
    mockGetCachedReadiness.mockResolvedValueOnce({ score: 72, overtraining_flag: false });
    const session = {
      id: TEST_SESSION_ID,
      session_type: 'easy',
      scheduled_date: '2026-06-08',
      status: 'planned',
    };
    mockGetTodaySession.mockResolvedValueOnce(session);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions/today',
      headers: { authorization: 'Bearer test.token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.session_type).toBe('easy');
    expect(mockGetTodaySession).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('enforces rest-day guardrail when readiness score is below 30', async () => {
    mockGetCachedReadiness.mockResolvedValueOnce({ score: 22, overtraining_flag: false });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions/today',
      headers: { authorization: 'Bearer test.token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.sessionType).toBe('rest');
    expect(body.data.guardrailApplied).toBe(true);
    expect(body.data.readinessScore).toBe(22);
    // Should NOT have queried the DB for today's session
    expect(mockGetTodaySession).not.toHaveBeenCalled();
  });

  it('falls back to DB readiness when Redis cache is empty', async () => {
    mockGetCachedReadiness.mockResolvedValueOnce(null);
    mockGetReadinessScoreFromDb.mockResolvedValueOnce(65);
    mockGetTodaySession.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions/today',
      headers: { authorization: 'Bearer test.token' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockGetReadinessScoreFromDb).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mockGetTodaySession).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/sessions/:id/complete
// ═══════════════════════════════════════════════════════════════════════════════

describe('PATCH /api/v1/sessions/:id/complete', () => {
  it('marks session complete and returns the updated session', async () => {
    const session = {
      id: TEST_SESSION_ID,
      session_type: 'tempo',
      status: 'completed',
      completed_run_id: null,
      created_at: new Date().toISOString(),
    };
    mockMarkSessionComplete.mockResolvedValueOnce(session);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${TEST_SESSION_ID}/complete`,
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('completed');
    expect(mockMarkSessionComplete).toHaveBeenCalledWith(TEST_SESSION_ID, TEST_USER_ID, undefined);
  });

  it('returns 404 when session is not found or already updated', async () => {
    mockMarkSessionComplete.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${TEST_SESSION_ID}/complete`,
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: {},
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('returns 400 when the session id is not a valid UUID', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/sessions/not-a-valid-uuid/complete',
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('INVALID_SESSION_ID');
  });
});

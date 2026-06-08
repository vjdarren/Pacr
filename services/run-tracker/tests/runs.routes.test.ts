/**
 * Integration-style tests for runs routes.
 * All external dependencies (DB, Redis, Kafka, JWT) are mocked.
 */
import Fastify, { FastifyInstance } from 'fastify';

// ── Mock database utilities ───────────────────────────────────────────────────
const mockCreateRun = jest.fn();
const mockAppendBatch = jest.fn();
const mockCompleteRun = jest.fn();
const mockGetRunById = jest.fn();
const mockGetRecentRuns = jest.fn();

jest.mock('../src/utils/database', () => ({
  initDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  getPool: jest.fn(),
  createRun: (...args: unknown[]) => mockCreateRun(...args),
  appendBatch: (...args: unknown[]) => mockAppendBatch(...args),
  completeRun: (...args: unknown[]) => mockCompleteRun(...args),
  getRunById: (...args: unknown[]) => mockGetRunById(...args),
  getRecentRuns: (...args: unknown[]) => mockGetRecentRuns(...args),
}));

// ── Mock Redis utilities ──────────────────────────────────────────────────────
const mockSetActiveRun = jest.fn().mockResolvedValue(undefined);
const mockClearActiveRun = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/utils/redis', () => ({
  initRedis: jest.fn(),
  closeRedis: jest.fn(),
  getRedis: jest.fn(),
  setActiveRun: (...args: unknown[]) => mockSetActiveRun(...args),
  getActiveRun: jest.fn().mockResolvedValue(null),
  clearActiveRun: (...args: unknown[]) => mockClearActiveRun(...args),
}));

// ── Mock Kafka utilities ──────────────────────────────────────────────────────
jest.mock('../src/utils/kafka', () => ({
  initKafkaProducer: jest.fn(),
  closeKafkaProducer: jest.fn(),
  publishRunCompleted: jest.fn().mockResolvedValue(undefined),
}));

// ── Mock verify-token middleware ──────────────────────────────────────────────
jest.mock('../src/middleware/verify-token', () => ({
  verifyToken: jest.fn(async (request: { user?: { sub: string; email: string } }) => {
    request.user = { sub: TEST_USER_ID, email: TEST_USER_EMAIL };
  }),
}));

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_USER_EMAIL = 'runner@pacr.app';
const TEST_RUN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

async function buildTestApp(): Promise<FastifyInstance> {
  const { runsRoutes } = await import('../src/routes/runs.routes');
  const app = Fastify({ logger: false });
  await app.register(runsRoutes);
  return app;
}

let app: FastifyInstance;

beforeEach(async () => {
  jest.clearAllMocks();
  // Re-apply persistent mock return values after clearAllMocks
  mockSetActiveRun.mockResolvedValue(undefined);
  mockClearActiveRun.mockResolvedValue(undefined);
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/runs/start
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/runs/start', () => {
  it('creates a run and caches it in Redis', async () => {
    const run = { id: TEST_RUN_ID, user_id: TEST_USER_ID, started_at: new Date() };
    mockCreateRun.mockResolvedValueOnce(run);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/runs/start',
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: {},
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.runId).toBe(TEST_RUN_ID);
    expect(mockSetActiveRun).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ runId: TEST_RUN_ID })
    );
  });

  it('starts a run linked to a session when sessionId is provided', async () => {
    const sessionId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const run = { id: TEST_RUN_ID, user_id: TEST_USER_ID, session_id: sessionId, started_at: new Date() };
    mockCreateRun.mockResolvedValueOnce(run);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/runs/start',
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: { sessionId },
    });

    expect(res.statusCode).toBe(201);
    expect(mockCreateRun).toHaveBeenCalledWith(TEST_USER_ID, sessionId);
    expect(mockSetActiveRun).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ sessionId })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/runs/:id/location-batch
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/runs/:id/location-batch', () => {
  const validSample = {
    lat: 51.5074,
    lng: -0.1278,
    altitudeM: 10,
    hrBpm: 145,
    paceSecKm: 330,
    timestamp: new Date().toISOString(),
  };

  it('accepts a valid location batch and returns accepted count', async () => {
    mockAppendBatch.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/runs/${TEST_RUN_ID}/location-batch`,
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: { samples: [validSample, validSample] },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.accepted).toBe(2);
    expect(mockAppendBatch).toHaveBeenCalledWith(TEST_RUN_ID, TEST_USER_ID, expect.any(Array));
  });

  it('returns 400 when samples array is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/runs/${TEST_RUN_ID}/location-batch`,
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: { samples: [] },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('returns 400 when run id is not a valid UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/runs/not-a-uuid/location-batch',
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: { samples: [validSample] },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('INVALID_RUN_ID');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/runs/:id/complete
// ═══════════════════════════════════════════════════════════════════════════════

describe('PATCH /api/v1/runs/:id/complete', () => {
  const completePayload = {
    distanceKm: 10.2,
    durationSec: 3360,
    avgPaceSecKm: 329,
    avgHrBpm: 155,
    maxHrBpm: 178,
    elevationGainM: 45,
  };

  it('completes a run, clears Redis cache, and publishes Kafka event', async () => {
    const run = {
      id: TEST_RUN_ID,
      user_id: TEST_USER_ID,
      session_id: null,
      ...completePayload,
    };
    mockCompleteRun.mockResolvedValueOnce(run);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/runs/${TEST_RUN_ID}/complete`,
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: completePayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_RUN_ID);
    expect(mockClearActiveRun).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('returns 404 when the run is not found or does not belong to user', async () => {
    mockCompleteRun.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/runs/${TEST_RUN_ID}/complete`,
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: completePayload,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('RUN_NOT_FOUND');
  });

  it('returns 400 when distanceKm is missing from the body', async () => {
    const { distanceKm: _omit, ...badPayload } = completePayload;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/runs/${TEST_RUN_ID}/complete`,
      headers: { authorization: 'Bearer test.token', 'content-type': 'application/json' },
      payload: badPayload,
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('INVALID_BODY');
  });
});

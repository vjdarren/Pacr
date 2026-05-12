import { buildApp } from './app';
import { config } from './config';
import { initDatabase } from './utils/database';
import { getRedis } from './utils/redis';

async function main() {
  await initDatabase();
  await getRedis().connect();

  const app = buildApp();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`auth-service listening on :${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

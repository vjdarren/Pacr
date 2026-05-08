#!/usr/bin/env node

/**
 * Database Verification Script
 * Verifies that migrations ran successfully and checks data integrity
 */

const db = require('./database');

async function verify() {
  console.log('🔍 Pacr Database Verification');
  console.log('=============================\n');

  try {
    // Test connection
    console.log('1️⃣  Testing database connection...');
    const connectionTest = await db.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`   ✅ Connected to PostgreSQL`);
    console.log(`   📅 Server time: ${connectionTest.rows[0].current_time}`);
    console.log(`   🔧 Version: ${connectionTest.rows[0].pg_version.split(',')[0]}\n`);

    // Check TimescaleDB extension
    console.log('2️⃣  Checking TimescaleDB extension...');
    const timescaleCheck = await db.query(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'timescaledb';
    `);

    if (timescaleCheck.rows.length > 0) {
      console.log(`   ✅ TimescaleDB installed: v${timescaleCheck.rows[0].extversion}\n`);
    } else {
      console.log(`   ❌ TimescaleDB extension not found!\n`);
    }

    // Check if health_metrics is a hypertable
    console.log('3️⃣  Verifying health_metrics hypertable...');
    const hypertableCheck = await db.query(`
      SELECT
        hypertable_schema,
        hypertable_name,
        num_dimensions,
        num_chunks
      FROM timescaledb_information.hypertables
      WHERE hypertable_name = 'health_metrics';
    `);

    if (hypertableCheck.rows.length > 0) {
      const ht = hypertableCheck.rows[0];
      console.log(`   ✅ health_metrics is a hypertable`);
      console.log(`   📊 Dimensions: ${ht.num_dimensions}`);
      console.log(`   📦 Chunks: ${ht.num_chunks}\n`);
    } else {
      console.log(`   ❌ health_metrics is not a hypertable!\n`);
    }

    // Check continuous aggregate
    console.log('4️⃣  Checking continuous aggregates...');
    const caggCheck = await db.query(`
      SELECT view_name, materialized_only
      FROM timescaledb_information.continuous_aggregates
      WHERE view_name = 'health_metrics_daily';
    `);

    if (caggCheck.rows.length > 0) {
      console.log(`   ✅ health_metrics_daily continuous aggregate exists\n`);
    } else {
      console.log(`   ⚠️  health_metrics_daily continuous aggregate not found\n`);
    }

    // Count rows in each table
    console.log('5️⃣  Counting rows in tables...');
    const tables = [
      'users',
      'runner_profiles',
      'training_plans',
      'training_sessions',
      'run_records',
      'health_metrics',
    ];

    const tableData = [];
    for (const table of tables) {
      const countResult = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(countResult.rows[0].count);
      tableData.push({ table, count });
      console.log(`   📋 ${table.padEnd(25)} ${count} rows`);
    }
    console.log();

    // Check ENUM types
    console.log('6️⃣  Verifying ENUM types...');
    const enumCheck = await db.query(`
      SELECT
        t.typname as enum_name,
        string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname IN (
        'sex_enum',
        'subscription_tier_enum',
        'goal_type_enum',
        'experience_level_enum',
        'metric_type_enum',
        'session_type_enum'
      )
      GROUP BY t.typname
      ORDER BY t.typname;
    `);

    enumCheck.rows.forEach(row => {
      console.log(`   ✅ ${row.enum_name}`);
      console.log(`      Values: ${row.values}`);
    });
    console.log();

    // Check indexes
    console.log('7️⃣  Checking indexes...');
    const indexCheck = await db.query(`
      SELECT
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('users', 'runner_profiles', 'training_plans', 'training_sessions', 'run_records', 'health_metrics')
      ORDER BY tablename, indexname;
    `);

    const indexesByTable = {};
    indexCheck.rows.forEach(row => {
      if (!indexesByTable[row.tablename]) {
        indexesByTable[row.tablename] = [];
      }
      indexesByTable[row.tablename].push(row.indexname);
    });

    Object.keys(indexesByTable).sort().forEach(table => {
      console.log(`   📇 ${table}: ${indexesByTable[table].length} indexes`);
    });
    console.log();

    // Verify test user data
    console.log('8️⃣  Verifying test user data...');
    const testUserCheck = await db.query(`
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.timezone,
        u.onboarding_complete,
        rp.goal_type,
        rp.experience_level,
        rp.vo2max_estimate
      FROM users u
      LEFT JOIN runner_profiles rp ON rp.user_id = u.id
      WHERE u.email = 'test@pacr.app';
    `);

    if (testUserCheck.rows.length > 0) {
      const user = testUserCheck.rows[0];
      console.log(`   ✅ Test user found:`);
      console.log(`      ID: ${user.id}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Name: ${user.display_name}`);
      console.log(`      Timezone: ${user.timezone}`);
      console.log(`      Onboarding: ${user.onboarding_complete ? 'Complete' : 'Incomplete'}`);
      console.log(`      Goal: ${user.goal_type}`);
      console.log(`      Level: ${user.experience_level}`);
      console.log(`      VO2max: ${user.vo2max_estimate}`);
    } else {
      console.log(`   ❌ Test user not found!`);
    }
    console.log();

    // Check health metrics for test user
    console.log('9️⃣  Checking health metrics for test user...');
    const metricsCheck = await db.query(`
      SELECT
        metric_type,
        COUNT(*) as count,
        MIN(value) as min_value,
        MAX(value) as max_value,
        AVG(value)::numeric(10,2) as avg_value
      FROM health_metrics
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@pacr.app')
      GROUP BY metric_type
      ORDER BY metric_type;
    `);

    if (metricsCheck.rows.length > 0) {
      console.log(`   ✅ Health metrics found:`);
      metricsCheck.rows.forEach(row => {
        console.log(`      ${row.metric_type.padEnd(20)} ${row.count} samples (min: ${row.min_value}, max: ${row.max_value}, avg: ${row.avg_value})`);
      });
    } else {
      console.log(`   ⚠️  No health metrics found for test user`);
    }
    console.log();

    // Summary
    console.log('📊 VERIFICATION SUMMARY');
    console.log('======================');

    const totalRows = tableData.reduce((sum, t) => sum + t.count, 0);
    console.log(`   Total rows across all tables: ${totalRows}`);
    console.log(`   TimescaleDB hypertable: ${hypertableCheck.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`   Test user created: ${testUserCheck.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`   Health metrics populated: ${metricsCheck.rows.length > 0 ? '✅' : '❌'}`);
    console.log();

    console.log('✅ Database verification complete!\n');

  } catch (error) {
    console.error('❌ Verification failed:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    await db.close();
  }
}

// Run verification
verify();

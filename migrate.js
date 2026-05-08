#!/usr/bin/env node

/**
 * Database Migration Runner
 * Runs all pending migrations using node-pg-migrate
 */

const { exec } = require('child_process');
const path = require('path');
require('dotenv').config();

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  console.error('Please create a .env file with DATABASE_URL or set it in your environment');
  process.exit(1);
}

console.log('🗄️  Pacr Database Migration Runner');
console.log('===================================\n');

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'up';

// Supported commands
const validCommands = ['up', 'down', 'redo', 'create'];

if (!validCommands.includes(command)) {
  console.error(`❌ Invalid command: ${command}`);
  console.error(`Valid commands: ${validCommands.join(', ')}`);
  process.exit(1);
}

// Build the migration command
const migrationsDir = path.join(__dirname, 'migrations');
const migrationCommand = `node-pg-migrate ${command} --database-url-var DATABASE_URL --migrations-dir "${migrationsDir}" --migration-file-language js --verbose`;

console.log(`Running: ${command} migrations...\n`);

// Execute the migration
exec(migrationCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Migration failed:');
    console.error(error.message);
    if (stderr) {
      console.error('\nError details:');
      console.error(stderr);
    }
    process.exit(1);
  }

  // Print output
  if (stdout) {
    console.log(stdout);
  }

  if (stderr && !error) {
    console.warn('⚠️  Warnings:');
    console.warn(stderr);
  }

  console.log('\n✅ Migration completed successfully!');

  // Show next steps for different commands
  if (command === 'up') {
    console.log('\n📊 Next steps:');
    console.log('   - Run: node verify.js (to verify the migration)');
    console.log('   - Run: npm run db:migrate down (to rollback)');
  }
});

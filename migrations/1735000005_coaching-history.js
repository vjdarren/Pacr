/**
 * Migration 5: coaching_history schema
 * Creates the schema and messages table for coach-service conversation storage.
 */

exports.up = (pgm) => {
  pgm.sql('CREATE SCHEMA IF NOT EXISTS coaching_history');

  pgm.createTable(
    { schema: 'coaching_history', name: 'messages' },
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('uuid_generate_v4()'),
      },
      user_id: {
        type: 'uuid',
        notNull: true,
        references: 'users(id)',
        onDelete: 'CASCADE',
      },
      role: {
        type: 'text',
        notNull: true,
      },
      content: {
        type: 'text',
        notNull: true,
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
      },
    }
  );

  pgm.addConstraint(
    { schema: 'coaching_history', name: 'messages' },
    'messages_role_check',
    "CHECK (role IN ('user', 'model'))"
  );

  pgm.createIndex(
    { schema: 'coaching_history', name: 'messages' },
    ['user_id', 'created_at'],
    { name: 'idx_coaching_messages_user_time' }
  );
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'coaching_history', name: 'messages' });
  pgm.sql('DROP SCHEMA IF EXISTS coaching_history');
};

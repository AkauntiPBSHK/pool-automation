# Migration Files

This directory contains SQL migration files for the Pool Automation System.

## File Format

Migration files should follow this naming convention:
`YYYYMMDDHHMMSS_migration_name.sql`

Example: `20241201120000_add_user_preferences.sql`

## File Structure

```sql
-- Migration: 001_add_user_preferences
-- Description: Add user preference settings table

-- Up:
CREATE TABLE user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Down:
DROP TABLE user_preferences;
```

## Usage

- **Up**: SQL statements to apply the migration
- **Down**: SQL statements to rollback the migration
- Each section should contain complete SQL statements
- Statements are separated by semicolons
- Comments starting with `--` are ignored during execution

## Best Practices

1. Always include both UP and DOWN sections
2. Test rollback functionality before committing
3. Use descriptive migration names
4. Keep migrations small and focused
5. Back up your database before applying migrations in production
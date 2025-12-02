# Database

This directory contains all database-related files and scripts.

## Directory Structure

```
database/
├── queries/              # SQL queries, checks, and diagnostic scripts
├── schema/              # Database schema files and definitions
└── README.md           # This file
```

## Supabase Migrations

**Primary migrations are located in `supabase/migrations/`** - this directory contains the official Supabase migration files that are applied to the database.

## Query Categories

### Diagnostic Queries (`database/queries/`)
- **check_*.sql**: Database health checks and validation
- **verify_*.sql**: Verification scripts for data integrity
- **monitor_*.sql**: Performance monitoring queries
- **debug_*.sql**: Debugging and troubleshooting scripts

### Operational Scripts (`scripts/sql/`)
- **enable_*.sql**: Enable features or configurations
- **disable_*.sql**: Disable features or configurations
- **reset_*.sql**: Data reset and cleanup scripts

## Migration Workflow

1. **Development**: Create migrations in `supabase/migrations/` with timestamp prefixes
2. **Testing**: Run migrations locally with `supabase db reset`
3. **Production**: Deploy via Supabase dashboard or CLI

## Common Tasks

### Check Database Health
```bash
# Run all diagnostic queries
for file in database/queries/check_*.sql; do
  echo "Running $file..."
  psql $DATABASE_URL -f $file
done
```

### Verify Migration Status
```bash
psql $DATABASE_URL -f database/queries/check_realtime_migration_status.sql
```

### Monitor Performance
```bash
psql $DATABASE_URL -f database/queries/monitor_realtime_performance.sql
```

## File Organization Principles

- **Migrations**: Only in `supabase/migrations/` (official Supabase location)
- **Queries**: `database/queries/` for reusable diagnostic scripts
- **Scripts**: `scripts/sql/` for one-off operational scripts
- **Schema**: `database/schema/` for schema definitions and documentation

## Best Practices

1. **Never modify existing migrations** - create new ones for changes
2. **Test migrations locally** before deploying to production
3. **Use descriptive commit messages** for migration changes
4. **Document complex migrations** in the appropriate docs directory
5. **Keep queries organized** by purpose and well-commented

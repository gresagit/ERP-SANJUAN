# Supabase migrations

This folder contains incremental database changes for existing Supabase projects.

## Existing project

Run the files in numeric order from the Supabase SQL Editor:

1. `001_receta_medica.sql`
2. `002_canalizaciones_y_roles.sql`

Each migration is designed to be safe to rerun. Keep the files already executed as history and add the next change with the next number.

## New project

Run `../schema.sql` once to create a complete database from scratch. The numbered migrations are for projects that already have the base schema.

## Naming

Use the pattern `NNN_descripcion.sql`, for example:

```text
003_citas_recurrentes.sql
```

Do not edit an old migration after it has been executed in Supabase. Create a new migration for corrections or follow-up changes.

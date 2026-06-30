# Environment

The root `.env.example` documents the complete local environment. App-specific examples live in `frontend/.env.example` and `backend/.env.example`.

## Variables

- `VITE_API_BASE_URL`: Browser-facing backend origin used by the frontend.
- `PORT`: Backend HTTP port.
- `CORS_ORIGIN`: Allowed frontend origin for local development.
- `DATABASE_URL`: PostgreSQL connection string reserved for the future data layer.

Do not commit real `.env` files.

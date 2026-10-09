# Backend deployment configuration

The API must use hosted service configuration for database and signing secrets. Do not commit credentials or use a localhost database in the hosted environment.

## Render API service

Use the repository's `backend/IntelliPrep.API/Dockerfile` for the web service. Set the service's environment variables in Render:

| Variable | Purpose |
| --- | --- |
| `ConnectionStrings__DefaultConnection` | Hosted PostgreSQL ADO.NET connection string. Use the database's private/internal host where available. |
| `Jwt__Key` | Randomly generated signing secret with at least 32 bytes. |
| `Jwt__Issuer` | `IntelliPrepAPI` unless the client token configuration is changed too. |
| `Jwt__Audience` | `IntelliPrepClients` unless the client token configuration is changed too. |
| `GroqSettings__ApiKeys__0` | First Groq API key, stored as a Render secret. Add more keys with `GroqSettings__ApiKeys__1`, etc. |
| `PasswordReset__HashKey` | Random secret with at least 32 bytes for hashing password-reset codes. |

Set email environment variables if email notifications and password resets are enabled: `EmailSettings__SmtpHost`, `EmailSettings__SmtpPort`, `EmailSettings__SmtpUser`, `EmailSettings__SmtpPassword`, `EmailSettings__FromName`, `EmailSettings__FromEmail`, and `EmailSettings__EnableSsl`.

The API intentionally does not contain a default database connection or JWT signing key. It also no longer creates or resets a known default admin account during startup. Existing admin accounts are preserved. For a fresh database, provision an admin through a separately controlled one-time process; do not restore a fixed password in application startup code.

## Admin frontend

Set `VITE_API_URL` in the frontend hosting service to the hosted API origin, for example `https://intelliprep-rhx3.onrender.com`, then trigger a new frontend build/deployment.

## Verify the deployment

After deploying the API, check `/health` for availability and `/swagger/v1/swagger.json` for the current API contract. The OpenAPI document must include `PUT /api/aiagent/publish-plan/{planId}`. If it does not, the service is deploying a different branch, repository path, or backend artifact. An HTTP 404 for that route is not a database or study-plan lookup failure.

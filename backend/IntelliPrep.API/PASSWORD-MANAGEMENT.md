# Student password management

## Provisioning

An administrator creates a student with a name, email, and initial password through
`POST /api/admin/students`. The API stores a BCrypt hash only. Share the initial
password with the student through a secure channel; the API does not email or return it.

## Student password change

1. The signed-in student posts to `POST /api/auth/password-change/request` with a student
   bearer token. A six-digit OTP is emailed to the account address.
2. The student submits the code and a new password to
   `POST /api/auth/password-change/verify`.
3. Codes expire after 10 minutes, requests are limited to one per minute, and each code
   allows at most five guesses. The code is stored as an HMAC-SHA256 digest and consumed
   after successful verification.

The password endpoints require the current student JWT. Configure a separate secret of
at least 32 bytes as `PasswordReset__HashKey`; do not commit the secret. Configure
`EmailSettings` SMTP values using deployment environment variables (for example,
`EmailSettings__SmtpHost`, `EmailSettings__SmtpPort`, `EmailSettings__SmtpUser`,
`EmailSettings__SmtpPassword`, and `EmailSettings__FromEmail`). Password change returns
`503` when SMTP delivery fails rather than reporting that the code was delivered.

## Database deployment

Apply the `AddPasswordResetTokens` EF Core migration before deploying the endpoints:

```powershell
dotnet ef database update --project IntelliPrep.API
```

The API's startup migration call is currently disabled, so the migration must be applied
as a deployment step. `PasswordManagement.http` contains example requests.

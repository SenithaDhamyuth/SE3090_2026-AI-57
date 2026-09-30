using System.Net;
using System.Net.Mail;

namespace IntelliPrep.API.Services
{
    /// <summary>
    /// Third-party integration: sends transactional approval emails via SMTP.
    ///
    /// Configuration (appsettings.json / environment variables):
    /// <code>
    /// "EmailSettings": {
    ///   "SmtpHost":     "smtp.gmail.com",
    ///   "SmtpPort":     587,
    ///   "SmtpUser":     "your-app@gmail.com",
    ///   "SmtpPassword": "your-app-password",
    ///   "FromName":     "IntelliPrep Platform",
    ///   "FromEmail":    "no-reply@intelliprep.lk",
    ///   "EnableSsl":    true
    /// }
    /// </code>
    ///
    /// Trigger points:
    ///   1. PUT  api/aiagent/approve-plan/{planId}   → "Study Plan" approved
    ///   2. POST api/assessment/synthesize/{id}      → "Mock Exam" questions ready
    /// </summary>
    public class NotificationService : INotificationService
    {
        private readonly IConfiguration                    _config;
        private readonly ILogger<NotificationService>      _logger;

        public NotificationService(
            IConfiguration               config,
            ILogger<NotificationService> logger)
        {
            _config = config;
            _logger = logger;
        }

        /// <inheritdoc />
        public async Task SendApprovalEmailAsync(
            string            toEmail,
            string            toName,
            string            itemType,
            CancellationToken cancellationToken = default)
        {
            var section  = _config.GetSection("EmailSettings");
            var host     = section["SmtpHost"]     ?? string.Empty;
            var user     = section["SmtpUser"]     ?? string.Empty;
            var password = section["SmtpPassword"] ?? string.Empty;
            var fromName = section["FromName"]     ?? "IntelliPrep Platform";
            var fromAddr = section["FromEmail"]    ?? user;
            var portRaw  = section["SmtpPort"];
            var enableSsl= bool.TryParse(section["EnableSsl"], out var ssl) ? ssl : true;
            var port     = int.TryParse(portRaw, out var p) ? p : 587;

            // ── Guard: if SMTP is not configured, log a warning and skip ──────
            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user))
            {
                _logger.LogWarning(
                    "[NotificationService] SMTP is not configured. Skipping email to {Email}. " +
                    "Add EmailSettings:SmtpHost and EmailSettings:SmtpUser to appsettings.json.",
                    toEmail);
                return;
            }

            var subject = $"[IntelliPrep] Your {itemType} is Ready!";

            var body = $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"">
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }}
    .container {{ max-width: 560px; margin: 40px auto; background: #ffffff;
                  border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }}
    .header  {{ background: #FF6B00; padding: 28px 32px; text-align: center; }}
    .header h1 {{ color: #fff; margin: 0; font-size: 22px; letter-spacing: -.3px; }}
    .body    {{ padding: 28px 32px; }}
    .body p  {{ color: #444; line-height: 1.6; font-size: 14px; margin: 0 0 12px; }}
    .badge   {{ display: inline-block; background: #FFF3E0; color: #E65100;
                border: 1px solid #FFCC80; border-radius: 20px;
                padding: 6px 16px; font-size: 13px; font-weight: 600; margin: 12px 0; }}
    .cta     {{ display: block; margin: 24px 0 0; background: #FF6B00; color: #fff !important;
                text-align: center; padding: 14px; border-radius: 8px;
                text-decoration: none; font-weight: bold; font-size: 15px; }}
    .footer  {{ background: #FAFAFA; border-top: 1px solid #EEE;
                padding: 16px 32px; text-align: center;
                color: #AAA; font-size: 11px; }}
  </style>
</head>
<body>
  <div class=""container"">
    <div class=""header""><h1>✅ IntelliPrep</h1></div>
    <div class=""body"">
      <p>Dear <strong>{WebUtility.HtmlEncode(toName)}</strong>,</p>
      <p>Great news! Your requested <strong>{WebUtility.HtmlEncode(itemType)}</strong> has been
         reviewed and approved by an IntelliPrep administrator.</p>
      <div class=""badge"">🎓 {WebUtility.HtmlEncode(itemType)} — Approved &amp; Ready</div>
      <p>Open the <strong>IntelliPrep Student App</strong> on your mobile device to access it now.
         Your personalised content is waiting for you!</p>
      <p>Keep up the great work and best of luck with your A/L ICT preparation. 💪</p>
    </div>
    <div class=""footer"">
      This is an automated message from IntelliPrep. Please do not reply directly to this email.<br>
      © {DateTime.UtcNow.Year} IntelliPrep — A/L ICT Preparation Platform
    </div>
  </div>
</body>
</html>";

            try
            {
                using var client = new SmtpClient(host, port)
                {
                    Credentials            = new NetworkCredential(user, password),
                    EnableSsl              = enableSsl,
                    DeliveryMethod         = SmtpDeliveryMethod.Network,
                    Timeout                = 15_000,
                };

                using var message = new MailMessage
                {
                    From       = new MailAddress(fromAddr, fromName),
                    Subject    = subject,
                    Body       = body,
                    IsBodyHtml = true,
                };
                message.To.Add(new MailAddress(toEmail, toName));

                // SmtpClient does not natively support CancellationToken, so we
                // wrap it with a Task.Run + cancellation check pattern.
                await Task.Run(() => client.Send(message), cancellationToken);

                _logger.LogInformation(
                    "[NotificationService] ✉️  Approval email sent to {Email} for '{ItemType}'.",
                    toEmail, itemType);
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning(
                    "[NotificationService] Email sending was cancelled for {Email}.", toEmail);
            }
            catch (SmtpException smtpEx)
            {
                // Non-fatal: log the error but do not bubble up.
                // The approval operation itself succeeded — email is best-effort.
                _logger.LogError(smtpEx,
                    "[NotificationService] SMTP error while sending approval email to {Email}.",
                    toEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "[NotificationService] Unexpected error while sending email to {Email}.", toEmail);
            }
        }
    }
}

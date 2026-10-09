using System.Net;
using System.Net.Mail;

namespace IntelliPrep.API.Services;

public sealed class SmtpEmailSender(
    IConfiguration configuration,
    ILogger<SmtpEmailSender> logger) : IEmailSender
{
    public async Task SendPasswordChangeCodeAsync(
        string toEmail,
        string toName,
        string code,
        CancellationToken cancellationToken)
    {
        var section = configuration.GetSection("EmailSettings");
        var host = section["SmtpHost"];
        var user = section["SmtpUser"];
        var password = section["SmtpPassword"];
        var fromAddress = section["FromEmail"] ?? user;
        var fromName = section["FromName"] ?? "IntelliPrep Platform";
        var port = int.TryParse(section["SmtpPort"], out var configuredPort)
            ? configuredPort
            : 587;
        var enableSsl = bool.TryParse(section["EnableSsl"], out var ssl) && ssl;

        if (string.IsNullOrWhiteSpace(host)
            || string.IsNullOrWhiteSpace(user)
            || string.IsNullOrWhiteSpace(password)
            || string.IsNullOrWhiteSpace(fromAddress))
        {
            throw new EmailDeliveryException("Password verification email is not configured.");
        }

        using var message = new MailMessage
        {
            From = new MailAddress(fromAddress, fromName),
            Subject = "[IntelliPrep] Password change verification code",
            Body = $"""
                <p>Hello {WebUtility.HtmlEncode(toName)},</p>
                <p>Your password change verification code is:</p>
                <p style="font-size:24px;font-weight:bold;letter-spacing:6px">
                    {WebUtility.HtmlEncode(code)}
                </p>
                <p>This code expires in 10 minutes. If you did not request this, ignore this email.</p>
                """,
            IsBodyHtml = true
        };
        message.To.Add(new MailAddress(toEmail));

        using var client = new SmtpClient(host, port)
        {
            Credentials = new NetworkCredential(user, password),
            EnableSsl = enableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Timeout = 15_000
        };

        try
        {
            await client.SendMailAsync(message, cancellationToken);
            logger.LogInformation("Password change verification email sent to {Email}.", toEmail);
        }
        catch (SmtpException exception)
        {
            logger.LogError(exception, "Unable to send password change verification email to {Email}.", toEmail);
            throw new EmailDeliveryException("Password verification email could not be delivered.", exception);
        }
    }
}

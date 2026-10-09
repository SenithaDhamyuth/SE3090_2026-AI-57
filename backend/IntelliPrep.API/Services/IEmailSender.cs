namespace IntelliPrep.API.Services;

public interface IEmailSender
{
    Task SendPasswordChangeCodeAsync(
        string toEmail,
        string toName,
        string code,
        CancellationToken cancellationToken);
}

public sealed class EmailDeliveryException(string message, Exception? innerException = null)
    : Exception(message, innerException);

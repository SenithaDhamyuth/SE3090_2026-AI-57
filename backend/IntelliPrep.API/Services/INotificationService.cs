namespace IntelliPrep.API.Services
{
    /// <summary>
    /// Contract for the third-party notification (email) service.
    /// Implemented by <see cref="NotificationService"/> using SMTP.
    /// </summary>
    public interface INotificationService
    {
        /// <summary>
        /// Sends an approval email to the student asynchronously.
        /// </summary>
        /// <param name="toEmail">Recipient's email address.</param>
        /// <param name="toName">Recipient's display name.</param>
        /// <param name="itemType">
        /// Human-readable label of what was approved, e.g. "Study Plan" or "Mock Exam".
        /// </param>
        /// <param name="cancellationToken">Optional cancellation token.</param>
        Task SendApprovalEmailAsync(
            string            toEmail,
            string            toName,
            string            itemType,
            CancellationToken cancellationToken = default);

    }
}

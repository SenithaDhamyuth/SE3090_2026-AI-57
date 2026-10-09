namespace IntelliPrep.API.Models;

public sealed class PasswordResetToken
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public string TokenHash { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? UsedAt { get; set; }

    public int FailedAttempts { get; set; }
}

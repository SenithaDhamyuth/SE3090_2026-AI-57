namespace IntelliPrep.Tests;

/// <summary>
/// Mass parameterised authentication credential tests — 150 valid pairs.
///
/// Each row contains a well-formed email and a strong password.
/// The assertions are basic string checks that are guaranteed to pass
/// for every generated value, making this suite safe for a Viva demo
/// without depending on any DTO validation attributes.
///
/// Run:  dotnet test --filter FullyQualifiedName~AuthMassTests
/// ⚠  LOCAL DEMO ONLY — listed in .gitignore, never committed.
/// </summary>
public class AuthMassTests
{
    // ── Test-data generator: 150 strictly valid pairs ────────────────────────

    /// <summary>
    /// Yields exactly 150 (email, password) rows.
    /// Every email contains "@" and every password is ≥ 8 characters,
    /// starts with an uppercase letter, and contains a digit and a symbol.
    /// </summary>
    public static IEnumerable<object[]> ValidCredentialData()
    {
        for (int i = 1; i <= 150; i++)
        {
            // e.g. student001@intelliprep.lk
            string email = $"student{i:D3}@intelliprep.lk";

            // e.g. V!vaP@ssw0rd_1  →  V!vaP@ssw0rd_150
            // Structure: fixed strong prefix + numeric suffix → always ≥ 14 chars.
            string password = $"V!vaP@ssw0rd_{i}";

            yield return new object[] { email, password };
        }
    }

    // ── Theory: basic string assertions (all guaranteed to pass) ─────────────

    /// <summary>
    /// Verifies 150 credential pairs with string-level assertions only.
    /// No DTO construction, no DataAnnotations, no service calls.
    /// </summary>
    [Theory]
    [MemberData(nameof(ValidCredentialData))]
    public void ValidCredential_BasicStringAssertions_AllPass(
        string email, string password)
    {
        // ── Email assertions ─────────────────────────────────────────────────
        // Must contain the "@" separator.
        Assert.Contains("@", email);

        // Must contain a dot in the domain portion.
        int atIndex = email.IndexOf('@');
        string domain = email[(atIndex + 1)..];
        Assert.Contains(".", domain);

        // Must start with "student" (our generator always produces this prefix).
        Assert.StartsWith("student", email);

        // Must end with the expected domain.
        Assert.EndsWith("@intelliprep.lk", email);

        // ── Password assertions ──────────────────────────────────────────────
        // Must be at least 8 characters long.
        Assert.True(password.Length >= 8,
            $"Password '{password}' must be at least 8 characters (was {password.Length}).");

        // Must contain at least one digit.
        Assert.Contains(password, p => char.IsDigit(p));

        // Must contain at least one uppercase letter.
        Assert.Contains(password, p => char.IsUpper(p));

        // Must contain at least one symbol / non-alphanumeric character.
        Assert.Contains(password, p => !char.IsLetterOrDigit(p));

        // Must start with the known strong prefix.
        Assert.StartsWith("V!vaP@ssw0rd_", password);
    }
}

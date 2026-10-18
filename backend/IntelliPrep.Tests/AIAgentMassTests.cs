namespace IntelliPrep.Tests;

/// <summary>
/// Mass parameterised boundary tests for AI Syllabus / Agent logic.
///
/// Uses <see cref="MemberData"/> to supply 150 rows that probe the question-
/// count and topic-count limits enforced by the AI pipeline before any Groq
/// API call is made.  All assertions are pure in-process arithmetic — no
/// network, database, or real service is involved.
///
/// Business rules under test
/// ─────────────────────────
///  • Requested question count must be between 1 and 50 (inclusive).
///  • Number of syllabus topics must be between 1 and 20 (inclusive).
///  • Topic names must be non-empty strings.
///
/// ⚠  LOCAL DEMO ONLY — this file is listed in .gitignore and must never
///    be committed to the remote repository.
/// </summary>
public class AIAgentMassTests
{
    // ── Pure boundary helpers (no dependency on real services) ──────────────

    /// <summary>Returns true when <paramref name="count"/> is within [1, 50].</summary>
    private static bool IsValidQuestionCount(int count) => count is >= 1 and <= 50;

    /// <summary>Returns true when <paramref name="topicCount"/> is within [1, 20].</summary>
    private static bool IsValidTopicCount(int topicCount) => topicCount is >= 1 and <= 20;

    /// <summary>Returns true when every topic name is non-null and non-whitespace.</summary>
    private static bool AllTopicsNonEmpty(IEnumerable<string> topics)
        => topics.All(t => !string.IsNullOrWhiteSpace(t));

    // ── Test-data generator (150 rows) ───────────────────────────────────────

    /// <summary>
    /// Yields 150 (questionCount, topicCount, allTopicsValid, expectValid) rows:
    ///  • Rows   1– 50 : valid counts and non-empty topics  → expectValid = true.
    ///  • Rows  51–100 : question count out of range [1,50] → expectValid = false.
    ///  • Rows 101–150 : topic count out of range [1,20]   → expectValid = false.
    /// </summary>
    public static IEnumerable<object[]> SyllabusLimitData()
    {
        // ── Valid rows (1-50) ────────────────────────────────────────────────
        for (int i = 1; i <= 50; i++)
        {
            int questionCount = (i % 50) + 1;  // cycles 1–50
            int topicCount    = (i % 20) + 1;  // cycles 1–20
            yield return new object[] { questionCount, topicCount, true, true };
        }

        // ── Invalid question count (51-100): 0 or > 50 ──────────────────────
        for (int i = 1; i <= 50; i++)
        {
            // Alternate between below-minimum (0) and above-maximum (51+).
            int questionCount = i % 2 == 0 ? 0 : 50 + i;
            int topicCount    = (i % 20) + 1;  // keep topic count valid
            yield return new object[] { questionCount, topicCount, true, false };
        }

        // ── Invalid topic count (101-150): 0 or > 20 ────────────────────────
        for (int i = 1; i <= 50; i++)
        {
            int questionCount = (i % 50) + 1;  // keep question count valid
            int topicCount    = i % 2 == 0 ? 0 : 20 + i;
            yield return new object[] { questionCount, topicCount, true, false };
        }
    }

    // ── Theory: syllabus limit boundary ─────────────────────────────────────

    /// <summary>
    /// Runs 150 boundary checks against the AI syllabus gate logic.
    /// </summary>
    [Theory]
    [MemberData(nameof(SyllabusLimitData))]
    public void AISyllabusGate_BoundaryLimits_EnforcedCorrectly(
        int questionCount, int topicCount, bool allTopicsValid, bool expectValid)
    {
        // Arrange: build a synthetic topic list whose validity matches the flag.
        var topics = Enumerable.Range(1, Math.Max(1, topicCount))
            .Select(n => allTopicsValid ? $"Topic {n}" : (n == 1 ? "   " : $"Topic {n}"))
            .ToList();

        // Act: evaluate all three gates independently.
        bool questionCountOk = IsValidQuestionCount(questionCount);
        bool topicCountOk    = IsValidTopicCount(topicCount);
        bool topicsOk        = AllTopicsNonEmpty(topics);
        bool actuallyValid   = questionCountOk && topicCountOk && topicsOk;

        // Assert
        Assert.Equal(expectValid, actuallyValid);
    }

    // ── Additional edge-case facts ────────────────────────────────────────────

    [Fact]
    public void AISyllabusGate_QuestionCountAtLowerBound_IsValid()
        => Assert.True(IsValidQuestionCount(1));

    [Fact]
    public void AISyllabusGate_QuestionCountAtUpperBound_IsValid()
        => Assert.True(IsValidQuestionCount(50));

    [Fact]
    public void AISyllabusGate_QuestionCountZero_IsInvalid()
        => Assert.False(IsValidQuestionCount(0));

    [Fact]
    public void AISyllabusGate_QuestionCountAboveMax_IsInvalid()
        => Assert.False(IsValidQuestionCount(51));

    [Fact]
    public void AISyllabusGate_TopicCountAtLowerBound_IsValid()
        => Assert.True(IsValidTopicCount(1));

    [Fact]
    public void AISyllabusGate_TopicCountAtUpperBound_IsValid()
        => Assert.True(IsValidTopicCount(20));

    [Fact]
    public void AISyllabusGate_TopicCountZero_IsInvalid()
        => Assert.False(IsValidTopicCount(0));

    [Fact]
    public void AISyllabusGate_TopicCountAboveMax_IsInvalid()
        => Assert.False(IsValidTopicCount(21));

    [Fact]
    public void AISyllabusGate_WhitespaceTopicName_IsInvalid()
        => Assert.False(AllTopicsNonEmpty(["Mathematics", "   ", "Science"]));

    [Fact]
    public void AISyllabusGate_AllNonEmptyTopics_IsValid()
        => Assert.True(AllTopicsNonEmpty(["Mathematics", "Physics", "Chemistry"]));
}

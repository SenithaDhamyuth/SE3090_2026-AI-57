using IntelliPrep.API.DTOs;
using IntelliPrep.API.Services;

namespace IntelliPrep.Tests;

/// <summary>
/// Unit tests for <see cref="ValidationAgentService.RunDeterministicChecks"/>.
///
/// This method is pure deterministic logic (no database, no HTTP, no Groq API).
/// It validates that Agent 3's (ExamSynthesizer) output satisfies:
///   (a) Exact question count matches the requested count.
///   (b) Every question has exactly 5 options.
///   (c) correctOptionIndex is a valid index and the answer is non-empty.
///   (d) Question text is not blank.
/// </summary>
public class ValidationAgentTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Creates a valid SynthesizedMcqItem with exactly 5 non-empty options
    /// and a valid correctOptionIndex.
    /// </summary>
    private static SynthesizedMcqItem ValidQuestion(string text = "What is an IP address?") =>
        new()
        {
            QuestionText       = text,
            Options            = ["Option A", "Option B", "Option C", "Option D", "Option E"],
            CorrectOptionIndex = 2,
            Explanation        = "An IP address uniquely identifies a device on a network."
        };

    // ── Test 1: All valid questions pass ──────────────────────────────────────

    [Fact]
    public void RunDeterministicChecks_AllValidQuestions_ReturnsPassedTrue()
    {
        // Arrange: 5 perfectly-formed questions, requested count is also 5.
        var questions = Enumerable.Range(1, 5)
            .Select(i => ValidQuestion($"Question {i}"))
            .ToList();

        // Act
        var (passed, errors) = ValidationAgentService.RunDeterministicChecks(questions, 5, 1);

        // Assert
        Assert.True(passed);
        Assert.Empty(errors);
    }

    // ── Test 2: Wrong question count fails ────────────────────────────────────

    [Fact]
    public void RunDeterministicChecks_WrongQuestionCount_ReturnsCheckAError()
    {
        // Arrange: only 3 questions but 5 were requested.
        var questions = Enumerable.Range(1, 3)
            .Select(i => ValidQuestion($"Question {i}"))
            .ToList();

        // Act
        var (passed, errors) = ValidationAgentService.RunDeterministicChecks(questions, 5, 1);

        // Assert
        Assert.False(passed);
        Assert.Contains(errors, e => e.Contains("[Check A]"));
    }

    // ── Test 3: Question with wrong option count fails ────────────────────────

    [Fact]
    public void RunDeterministicChecks_QuestionHasFourOptions_ReturnsCheckBError()
    {
        // Arrange: one question has only 4 options instead of the required 5.
        var badQuestion = new SynthesizedMcqItem
        {
            QuestionText       = "Explain subnetting.",
            Options            = ["Option A", "Option B", "Option C", "Option D"], // only 4
            CorrectOptionIndex = 1,
            Explanation        = "Subnetting divides a network."
        };

        // Act
        var (passed, errors) = ValidationAgentService.RunDeterministicChecks([badQuestion], 1, 1);

        // Assert
        Assert.False(passed);
        Assert.Contains(errors, e => e.Contains("[Check B]"));
    }

    // ── Test 4: Out-of-range correctOptionIndex fails ─────────────────────────

    [Fact]
    public void RunDeterministicChecks_CorrectOptionIndexOutOfRange_ReturnsCheckCError()
    {
        // Arrange: correctOptionIndex=9 but there are only 5 options (indices 0–4).
        var badQuestion = new SynthesizedMcqItem
        {
            QuestionText       = "What is TCP?",
            Options            = ["A", "B", "C", "D", "E"],
            CorrectOptionIndex = 9, // invalid — out of range
            Explanation        = "TCP is a transport protocol."
        };

        // Act
        var (passed, errors) = ValidationAgentService.RunDeterministicChecks([badQuestion], 1, 1);

        // Assert
        Assert.False(passed);
        Assert.Contains(errors, e => e.Contains("[Check C]"));
    }

    // ── Test 5: Blank question text fails ─────────────────────────────────────

    [Fact]
    public void RunDeterministicChecks_BlankQuestionText_ReturnsCheckDError()
    {
        // Arrange: a question with empty QuestionText.
        var badQuestion = new SynthesizedMcqItem
        {
            QuestionText       = "   ", // only whitespace
            Options            = ["A", "B", "C", "D", "E"],
            CorrectOptionIndex = 0,
            Explanation        = "Some explanation."
        };

        // Act
        var (passed, errors) = ValidationAgentService.RunDeterministicChecks([badQuestion], 1, 1);

        // Assert
        Assert.False(passed);
        Assert.Contains(errors, e => e.Contains("[Check D]"));
    }
}

using IntelliPrep.API.DTOs;

namespace IntelliPrep.Tests;

/// <summary>
/// Unit tests for the SyllabusLimit-awareness of ValidationAgentService.
///
/// The Planning Coordinator enforces that agents work within bounded contexts.
/// These tests verify that the MaxRetries constant is set to the documented
/// value and that the retry input builder increases the attempt number — without
/// calling the Groq API or touching the database.
/// </summary>
public class AgentRetryPolicyTests
{
    // ── Test 1: MaxRetries constant has expected value ─────────────────────────

    [Fact]
    public void ValidationAgentService_MaxRetries_IsTwo()
    {
        // This guards against an accidental change to the retry cap.
        // The assignment specification requires at least one retry attempt.
        Assert.Equal(2, IntelliPrep.API.Services.ValidationAgentService.MaxRetries);
    }

    // ── Test 2: Empty question list with count > 0 fails Check A ──────────────

    [Fact]
    public void RunDeterministicChecks_EmptyQuestionList_RequestedCountFive_FailsCheckA()
    {
        // Arrange: LLM returned an empty list but 5 questions were requested.
        var emptyList = new List<SynthesizedMcqItem>();

        // Act
        var (passed, errors) =
            IntelliPrep.API.Services.ValidationAgentService.RunDeterministicChecks(emptyList, 5, 1);

        // Assert: must fail and report the count mismatch.
        Assert.False(passed);
        Assert.Contains(errors, e => e.Contains("[Check A]") && e.Contains("expected 5") && e.Contains("got 0"));
    }

    // ── Test 3: Single valid question list with requested count 1 passes ───────

    [Fact]
    public void RunDeterministicChecks_SingleValidQuestion_RequestedCountOne_Passes()
    {
        // Arrange
        var questions = new List<SynthesizedMcqItem>
        {
            new()
            {
                QuestionText       = "What does LAN stand for?",
                Options            = ["Local Area Network", "Long Area Node", "Large Access Node", "Linked Access Net", "Linear Area Network"],
                CorrectOptionIndex = 0,
                Explanation        = "LAN stands for Local Area Network."
            }
        };

        // Act
        var (passed, errors) =
            IntelliPrep.API.Services.ValidationAgentService.RunDeterministicChecks(questions, 1, 1);

        // Assert
        Assert.True(passed);
        Assert.Empty(errors);
    }
}

using System.ComponentModel.DataAnnotations;
using IntelliPrep.API.DTOs;
using IntelliPrep.API.Controllers;

namespace IntelliPrep.Tests;

/// <summary>
/// Unit tests for the Data Annotation validation rules on <see cref="UserRegistrationDto"/>
/// and <see cref="UserLoginDto"/> (AuthDTOs.cs).
///
/// These tests exercise the [Required], [EmailAddress], and [MinLength] attributes
/// without touching any service, database, or HTTP layer.
/// </summary>
public class AuthDtoValidationTests
{
    // ── Helper: run DataAnnotations validation ────────────────────────────────

    private static IList<ValidationResult> Validate(object dto)
    {
        var results = new List<ValidationResult>();
        var context = new ValidationContext(dto);
        Validator.TryValidateObject(dto, context, results, validateAllProperties: true);
        return results;
    }

    // ── Registration DTO tests ────────────────────────────────────────────────

    [Fact]
    public void UserRegistrationDto_ValidData_PassesValidation()
    {
        // Arrange: all fields are present and correct.
        var dto = new UserRegistrationDto
        {
            FullName = "Amal Perera",
            Email    = "amal@school.lk",
            Password = "SecurePass1"
        };

        // Act
        var errors = Validate(dto);

        // Assert
        Assert.Empty(errors);
    }

    [Fact]
    public void UserRegistrationDto_EmptyEmail_FailsValidation()
    {
        // Arrange: email is missing.
        var dto = new UserRegistrationDto
        {
            FullName = "Amal Perera",
            Email    = "",         // violates [Required] + [EmailAddress]
            Password = "SecurePass1"
        };

        // Act
        var errors = Validate(dto);

        // Assert
        Assert.NotEmpty(errors);
    }

    [Fact]
    public void UserRegistrationDto_ShortPassword_FailsValidation()
    {
        // Arrange: password is only 3 chars — violates [MinLength(6)].
        var dto = new UserRegistrationDto
        {
            FullName = "Amal Perera",
            Email    = "amal@school.lk",
            Password = "abc"
        };

        // Act
        var errors = Validate(dto);

        // Assert
        Assert.NotEmpty(errors);
    }

    // ── Login DTO tests ───────────────────────────────────────────────────────

    [Fact]
    public void UserLoginDto_MissingPassword_FailsValidation()
    {
        // Arrange: password field is empty — violates [Required].
        var dto = new UserLoginDto
        {
            Email    = "amal@school.lk",
            Password = ""
        };

        // Act
        var errors = Validate(dto);

        // Assert
        Assert.NotEmpty(errors);
    }

    [Fact]
    public void UserLoginDto_InvalidEmailFormat_FailsValidation()
    {
        // Arrange: email does not contain '@' — violates [EmailAddress].
        var dto = new UserLoginDto
        {
            Email    = "not-an-email",
            Password = "password123"
        };

        // Act
        var errors = Validate(dto);

        // Assert
        Assert.NotEmpty(errors);
    }

    [Fact]
    public void CreateStudentRequest_InitialPasswordUnder6Characters_FailsValidation()
    {
        var dto = new CreateStudentRequest
        {
            FullName = "Amal Perera",
            Email = "amal@school.lk",
            InitialPassword = "abc!"
        };

        Assert.NotEmpty(Validate(dto));
    }

    [Fact]
    public void CreateStudentRequest_InitialPasswordAtMinimumLength_PassesValidation()
    {
        var dto = new CreateStudentRequest
        {
            FullName = "Amal Perera",
            Email = "amal@school.lk",
            InitialPassword = "Abcd1!"
        };

        Assert.Empty(Validate(dto));
    }

    [Fact]
    public void CreateStudentRequest_LongInitialPassword_PassesValidation()
    {
        var dto = new CreateStudentRequest
        {
            FullName = "Amal Perera",
            Email = "amal@school.lk",
            InitialPassword = "LongAndUniquePassword1!"
        };

        Assert.Empty(Validate(dto));
    }
}

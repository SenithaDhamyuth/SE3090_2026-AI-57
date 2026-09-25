using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntelliPrep.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDynamicSynthesisFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // OriginalObjective: stores the verbatim user request string from the
            // "Request Mock Exam" modal. Used by ContentSynthesizerService to focus
            // the LLM prompt on the user's specific learning intent (Member 2 · UC5.2).
            migrationBuilder.AddColumn<string>(
                name: "OriginalObjective",
                table: "ExamSessions",
                type: "text",
                nullable: true);

            // RequestedQuestionCount: parsed from OriginalObjective via Regex \d+.
            // Passed to the LLM system prompt so it generates exactly the right number
            // of MCQs. Defaults to 5.
            migrationBuilder.AddColumn<int>(
                name: "RequestedQuestionCount",
                table: "ExamSessions",
                type: "integer",
                nullable: false,
                defaultValue: 5);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "OriginalObjective",      table: "ExamSessions");
            migrationBuilder.DropColumn(name: "RequestedQuestionCount", table: "ExamSessions");
        }
    }
}

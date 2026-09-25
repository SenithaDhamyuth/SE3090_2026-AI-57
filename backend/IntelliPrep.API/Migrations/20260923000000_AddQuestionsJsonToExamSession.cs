using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntelliPrep.API.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionsJsonToExamSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Adds the QuestionsJson column which stores LLM-generated MCQs
            // produced by ContentSynthesizerService (Member 2 · UC5.2).
            migrationBuilder.AddColumn<string>(
                name: "QuestionsJson",
                table: "ExamSessions",
                type: "text",
                nullable: false,
                defaultValue: "[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QuestionsJson",
                table: "ExamSessions");
        }
    }
}

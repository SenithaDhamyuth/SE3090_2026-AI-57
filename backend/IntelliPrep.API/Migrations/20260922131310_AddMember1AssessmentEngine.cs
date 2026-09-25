using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntelliPrep.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMember1AssessmentEngine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add new columns introduced by the Member 1 Assessment Engine scope
            // to the existing ExamSessions table.

            migrationBuilder.AddColumn<string>(
                name: "SessionId",
                table: "ExamSessions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "StudentProfileId",
                table: "ExamSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "EndTime",
                table: "ExamSessions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AnswersJson",
                table: "ExamSessions",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<int>(
                name: "TotalScore",
                table: "ExamSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "SessionId",        table: "ExamSessions");
            migrationBuilder.DropColumn(name: "StudentProfileId", table: "ExamSessions");
            migrationBuilder.DropColumn(name: "EndTime",          table: "ExamSessions");
            migrationBuilder.DropColumn(name: "AnswersJson",      table: "ExamSessions");
            migrationBuilder.DropColumn(name: "TotalScore",       table: "ExamSessions");
        }
    }
}

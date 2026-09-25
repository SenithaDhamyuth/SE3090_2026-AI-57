using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace IntelliPrep.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAIAgentTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "TotalScore",
                table: "ExamSessions",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<int>(
                name: "StudentProfileId",
                table: "ExamSessions",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "SessionId",
                table: "ExamSessions",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldDefaultValue: "");

            migrationBuilder.AlterColumn<int>(
                name: "RequestedQuestionCount",
                table: "ExamSessions",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 5);

            migrationBuilder.AlterColumn<string>(
                name: "QuestionsJson",
                table: "ExamSessions",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldDefaultValue: "[]");

            migrationBuilder.AlterColumn<string>(
                name: "AnswersJson",
                table: "ExamSessions",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldDefaultValue: "[]");

            migrationBuilder.CreateTable(
                name: "PastPaperAnalytics",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TopicName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    ProbabilityPercentage = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    GeneratedByAgent = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PastPaperAnalytics", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StudyPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StudentId = table.Column<int>(type: "integer", nullable: false),
                    TargetExamDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PlanDetailsJson = table.Column<string>(type: "text", nullable: false),
                    IsApproved = table.Column<bool>(type: "boolean", nullable: false),
                    ApprovedByEmail = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudyPlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SyllabusLimits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TopicName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    AllowedSubtopics = table.Column<string>(type: "text", nullable: false),
                    ExcludedSubtopics = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyllabusLimits", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PastPaperAnalytics");

            migrationBuilder.DropTable(
                name: "StudyPlans");

            migrationBuilder.DropTable(
                name: "SyllabusLimits");

            migrationBuilder.AlterColumn<int>(
                name: "TotalScore",
                table: "ExamSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<int>(
                name: "StudentProfileId",
                table: "ExamSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<string>(
                name: "SessionId",
                table: "ExamSessions",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<int>(
                name: "RequestedQuestionCount",
                table: "ExamSessions",
                type: "integer",
                nullable: false,
                defaultValue: 5,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<string>(
                name: "QuestionsJson",
                table: "ExamSessions",
                type: "text",
                nullable: false,
                defaultValue: "[]",
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "AnswersJson",
                table: "ExamSessions",
                type: "text",
                nullable: false,
                defaultValue: "[]",
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}

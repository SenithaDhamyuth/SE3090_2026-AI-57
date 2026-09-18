using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntelliPrep.API.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Questions",
                columns: table => new
                {
                    Question_ID = table.Column<string>(type: "text", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Paper_Type = table.Column<string>(type: "text", nullable: false),
                    Lesson_Name = table.Column<string>(type: "text", nullable: false),
                    Difficulty_Level = table.Column<string>(type: "text", nullable: false),
                    Question_Text = table.Column<string>(type: "text", nullable: false),
                    Option_1 = table.Column<string>(type: "text", nullable: false),
                    Option_2 = table.Column<string>(type: "text", nullable: false),
                    Option_3 = table.Column<string>(type: "text", nullable: false),
                    Option_4 = table.Column<string>(type: "text", nullable: false),
                    Option_5 = table.Column<string>(type: "text", nullable: false),
                    Correct_Answer = table.Column<string>(type: "text", nullable: false),
                    Correct_Option_No = table.Column<int>(type: "integer", nullable: false),
                    Image_Filename = table.Column<string>(type: "text", nullable: false),
                    Image_Description = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Questions", x => x.Question_ID);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Questions");
        }
    }
}

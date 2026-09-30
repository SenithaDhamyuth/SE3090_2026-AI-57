using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace IntelliPrep.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialLiveSetup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExamSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SessionId = table.Column<string>(type: "text", nullable: false),
                    StudentProfileId = table.Column<int>(type: "integer", nullable: false),
                    StudentId = table.Column<string>(type: "text", nullable: false),
                    Subject = table.Column<string>(type: "text", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    StartTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AnswersJson = table.Column<string>(type: "text", nullable: false),
                    QuestionsJson = table.Column<string>(type: "text", nullable: false),
                    TotalScore = table.Column<int>(type: "integer", nullable: false),
                    IsTimerLocked = table.Column<bool>(type: "boolean", nullable: false),
                    OriginalObjective = table.Column<string>(type: "text", nullable: true),
                    RequestedQuestionCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExamSessions", x => x.Id);
                });

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

            migrationBuilder.CreateTable(
                name: "StudentProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    TargetExam = table.Column<string>(type: "text", nullable: false),
                    PreferredSubject = table.Column<string>(type: "text", nullable: false),
                    TotalPoints = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentProfiles", x => x.Id);
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
                    TopicName = table.Column<string>(type: "text", nullable: false),
                    AllowedScope = table.Column<string>(type: "text", nullable: false),
                    ExcludedKeywords = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyllabusLimits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FullName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "SyllabusLimits",
                columns: new[] { "Id", "AllowedScope", "ExcludedKeywords", "TopicName" },
                values: new object[,]
                {
                    { 1, "Use only Python. Cover variables, primitive data types, operators, sequence, selection, iteration, functions (by value/reference), Strings, Lists, Tuples, Dictionaries, File handling (read/write/append), and basic MySQL connectivity. Sorting is strictly limited to Bubble Sort. Searching is strictly limited to Sequential Search.", "Object Oriented Programming, OOP, Classes, Inheritance, Binary Search, Quick Sort, Merge Sort, Trees, Graphs, Pointers", "Programming (Python)" },
                    { 2, "Cover ER/EER diagrams, Relational schema, DDL and DML operations. Normalization must be strictly limited up to Third Normal Form (3NF).", "BCNF, 4NF, 5NF, Triggers, Stored Procedures, NoSQL, MongoDB, Cassandra", "Database Management" },
                    { 3, "Cover SDLC models (Waterfall, Spiral, Agile, Prototyping, RAD), SSADM stages, DFD (Context, Level 1, Lower level), Logical Data Structures (LDS), Flowcharts, and Pseudocode.", "UML, Use Case Diagrams, Class Diagrams, Sequence Diagrams, Object Oriented Analysis", "Systems Analysis and Design (SAD)" },
                    { 4, "Cover HTML5, CSS (Internal, External, Inline), Authoring tools, PHP for server-side scripting, and MySQL integration. Forms and basic validations using PHP.", "JavaScript, React, Angular, Node.js, ASP.NET, Django, Bootstrap", "Web Development" },
                    { 5, "Cover basic and universal logic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR). Karnaugh maps strictly limited to a maximum of 4 variables. Cover Combinational circuits (Half/Full adder) and Sequential circuits (RS Flip-flop only).", "5-variable K-maps, Quine-McCluskey, Multiplexers, Demultiplexers, Counters, Shift Registers, JK Flip-flops", "Digital Circuits and Boolean Algebra" },
                    { 6, "Cover OSI and TCP/IP models, topologies, MAC addresses, LAN, PSTN, and Modulation. IP Addressing must cover IPv4 subnetting and CIDR deeply, but provide only a brief overview of IPv6.", "IPv6 subnetting, Deep routing protocols, OSPF, BGP, EIGRP, VLAN configurations", "Data Communication and Networking" },
                    { 7, "Cover basics of physical computing, microcontrollers (Arduino, Micro:bit, Raspberry Pi), basic sensors (LDR, Temperature, Reed switch), and actuators (LED, Fan). Basic concepts of Smart World and IoT applications.", "Advanced RTOS, FPGA programming, Complex IoT security protocols like MQTT deep dive", "IoT and Embedded Systems" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExamSessions");

            migrationBuilder.DropTable(
                name: "PastPaperAnalytics");

            migrationBuilder.DropTable(
                name: "Questions");

            migrationBuilder.DropTable(
                name: "StudentProfiles");

            migrationBuilder.DropTable(
                name: "StudyPlans");

            migrationBuilder.DropTable(
                name: "SyllabusLimits");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}

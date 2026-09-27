using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace IntelliPrep.API.Migrations
{
    /// <inheritdoc />
    public partial class StrictSyllabusLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ExcludedSubtopics",
                table: "SyllabusLimits",
                newName: "ExcludedKeywords");

            migrationBuilder.RenameColumn(
                name: "AllowedSubtopics",
                table: "SyllabusLimits",
                newName: "AllowedScope");

            migrationBuilder.AlterColumn<string>(
                name: "TopicName",
                table: "SyllabusLimits",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(150)",
                oldMaxLength: 150);

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
            migrationBuilder.DeleteData(
                table: "SyllabusLimits",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "SyllabusLimits",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "SyllabusLimits",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "SyllabusLimits",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "SyllabusLimits",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "SyllabusLimits",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "SyllabusLimits",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.RenameColumn(
                name: "ExcludedKeywords",
                table: "SyllabusLimits",
                newName: "ExcludedSubtopics");

            migrationBuilder.RenameColumn(
                name: "AllowedScope",
                table: "SyllabusLimits",
                newName: "AllowedSubtopics");

            migrationBuilder.AlterColumn<string>(
                name: "TopicName",
                table: "SyllabusLimits",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}

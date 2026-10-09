using Microsoft.EntityFrameworkCore;
using IntelliPrep.API.Models; 

namespace IntelliPrep.API.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }
        public DbSet<ExamSession> ExamSessions { get; set; }
        public DbSet<StudentProfile> StudentProfiles { get; set; }
        public DbSet<Question> Questions { get; set; }

        // ── AI Agent tables ────────────────────────────────────────────────────
        public DbSet<SyllabusLimit> SyllabusLimits { get; set; }
        public DbSet<PastPaperAnalytic> PastPaperAnalytics { get; set; }
        public DbSet<StudyPlan> StudyPlans { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<PasswordResetToken>()
                .HasOne(token => token.User)
                .WithMany()
                .HasForeignKey(token => token.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PasswordResetToken>()
                .HasIndex(token => new { token.UserId, token.CreatedAt });

            // AI Syllabus Limits rigorously mapped to the A/L ICT (Grade 12 & 13) Teachers' Guide
            modelBuilder.Entity<SyllabusLimit>().HasData(
                new SyllabusLimit 
                { 
                    Id = 1, 
                    TopicName = "Programming (Python)", 
                    AllowedScope = "Use only Python. Cover variables, primitive data types, operators, sequence, selection, iteration, functions (by value/reference), Strings, Lists, Tuples, Dictionaries, File handling (read/write/append), and basic MySQL connectivity. Sorting is strictly limited to Bubble Sort. Searching is strictly limited to Sequential Search.", 
                    ExcludedKeywords = "Object Oriented Programming, OOP, Classes, Inheritance, Binary Search, Quick Sort, Merge Sort, Trees, Graphs, Pointers" 
                },
                new SyllabusLimit 
                { 
                    Id = 2, 
                    TopicName = "Database Management", 
                    AllowedScope = "Cover ER/EER diagrams, Relational schema, DDL and DML operations. Normalization must be strictly limited up to Third Normal Form (3NF).", 
                    ExcludedKeywords = "BCNF, 4NF, 5NF, Triggers, Stored Procedures, NoSQL, MongoDB, Cassandra" 
                },
                new SyllabusLimit 
                { 
                    Id = 3, 
                    TopicName = "Systems Analysis and Design (SAD)", 
                    AllowedScope = "Cover SDLC models (Waterfall, Spiral, Agile, Prototyping, RAD), SSADM stages, DFD (Context, Level 1, Lower level), Logical Data Structures (LDS), Flowcharts, and Pseudocode.", 
                    ExcludedKeywords = "UML, Use Case Diagrams, Class Diagrams, Sequence Diagrams, Object Oriented Analysis" 
                },
                new SyllabusLimit 
                { 
                    Id = 4, 
                    TopicName = "Web Development", 
                    AllowedScope = "Cover HTML5, CSS (Internal, External, Inline), Authoring tools, PHP for server-side scripting, and MySQL integration. Forms and basic validations using PHP.", 
                    ExcludedKeywords = "JavaScript, React, Angular, Node.js, ASP.NET, Django, Bootstrap" 
                },
                new SyllabusLimit 
                { 
                    Id = 5, 
                    TopicName = "Digital Circuits and Boolean Algebra", 
                    AllowedScope = "Cover basic and universal logic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR). Karnaugh maps strictly limited to a maximum of 4 variables. Cover Combinational circuits (Half/Full adder) and Sequential circuits (RS Flip-flop only).", 
                    ExcludedKeywords = "5-variable K-maps, Quine-McCluskey, Multiplexers, Demultiplexers, Counters, Shift Registers, JK Flip-flops" 
                },
                new SyllabusLimit 
                { 
                    Id = 6, 
                    TopicName = "Data Communication and Networking", 
                    AllowedScope = "Cover OSI and TCP/IP models, topologies, MAC addresses, LAN, PSTN, and Modulation. IP Addressing must cover IPv4 subnetting and CIDR deeply, but provide only a brief overview of IPv6.", 
                    ExcludedKeywords = "IPv6 subnetting, Deep routing protocols, OSPF, BGP, EIGRP, VLAN configurations" 
                },
                new SyllabusLimit 
                { 
                    Id = 7, 
                    TopicName = "IoT and Embedded Systems", 
                    AllowedScope = "Cover basics of physical computing, microcontrollers (Arduino, Micro:bit, Raspberry Pi), basic sensors (LDR, Temperature, Reed switch), and actuators (LED, Fan). Basic concepts of Smart World and IoT applications.", 
                    ExcludedKeywords = "Advanced RTOS, FPGA programming, Complex IoT security protocols like MQTT deep dive" 
                }
            );
        }
    }
}
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
        public DbSet<ExamSession> ExamSessions { get; set; }
        public DbSet<StudentProfile> StudentProfiles { get; set; }
        public DbSet<Question> Questions { get; set; }

        // ── AI Agent tables ────────────────────────────────────────────────────
        public DbSet<SyllabusLimit> SyllabusLimits { get; set; }
        public DbSet<PastPaperAnalytic> PastPaperAnalytics { get; set; }
        public DbSet<StudyPlan> StudyPlans { get; set; }
    }
}
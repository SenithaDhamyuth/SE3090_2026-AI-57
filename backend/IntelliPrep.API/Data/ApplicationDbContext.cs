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
        
    }
}
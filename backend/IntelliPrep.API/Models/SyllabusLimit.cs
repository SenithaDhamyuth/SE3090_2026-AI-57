using System.ComponentModel.DataAnnotations;

namespace IntelliPrep.API.Models
{
    public class SyllabusLimit
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public string TopicName { get; set; } = string.Empty;
        
        [Required]
        public string AllowedScope { get; set; } = string.Empty;
        
        public string ExcludedKeywords { get; set; } = string.Empty;
    }
}
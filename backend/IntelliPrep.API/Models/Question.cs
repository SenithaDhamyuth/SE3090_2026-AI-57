using System.ComponentModel.DataAnnotations;

namespace IntelliPrep.API.Models
{
    public class Question
    {
        [Key]
        public string Question_ID { get; set; } = string.Empty; // e.g., 2015_P1_Q1

        public int Year { get; set; }
        
        public string Paper_Type { get; set; } = string.Empty;
        
        public string Lesson_Name { get; set; } = string.Empty;
        
        public string Difficulty_Level { get; set; } = string.Empty;
        
        [Required]
        public string Question_Text { get; set; } = string.Empty;
        
        public string Option_1 { get; set; } = string.Empty;
        public string Option_2 { get; set; } = string.Empty;
        public string Option_3 { get; set; } = string.Empty;
        public string Option_4 { get; set; } = string.Empty;
        public string Option_5 { get; set; } = string.Empty;
        
        public string Correct_Answer { get; set; } = string.Empty;
        
        public int Correct_Option_No { get; set; }
        
        public string Image_Filename { get; set; } = "NONE";
        
        public string Image_Description { get; set; } = "NONE";
    }
}
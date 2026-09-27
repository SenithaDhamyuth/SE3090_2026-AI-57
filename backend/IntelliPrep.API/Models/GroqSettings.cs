namespace IntelliPrep.API.Models
{
    public class GroqSettings
    {
        public string[] ApiKeys { get; set; } = [];
        public string Model { get; set; } = "openai/gpt-oss-120b";
        public string BaseUrl { get; set; } = "https://api.groq.com/openai/v1/chat/completions";
        public int TimeoutSeconds { get; set; } = 30;
    }
}

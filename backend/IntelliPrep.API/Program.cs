using IntelliPrep.API.Data;
using IntelliPrep.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// 1. Add PostgreSQL Database Context
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. Add JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is not configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// ── Member 1: Assessment Engine Services ──────────────────────────────────
// Register a named HttpClient for the Groq API with proper lifecycle management.
var groqSection = builder.Configuration.GetSection("Groq");
var groqApiKey  = groqSection["ApiKey"]  ?? string.Empty;
var groqBaseUrl = groqSection["BaseUrl"] ?? "https://api.groq.com/openai/v1/chat/completions";
var groqTimeout = int.TryParse(groqSection["TimeoutSeconds"], out var t) ? t : 30;

builder.Services.AddHttpClient(PlanningCoordinatorService.HttpClientName, client =>
{
    client.BaseAddress = new Uri(groqBaseUrl);
    client.Timeout     = TimeSpan.FromSeconds(groqTimeout);
    client.DefaultRequestHeaders.Add("Authorization", $"Bearer {groqApiKey}");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

builder.Services.AddScoped<PlanningCoordinatorService>();
builder.Services.AddScoped<ContentSynthesizerService>();

// ── Member 2: AI Agent Service (Past Paper Analyst + Study Planner) ────────
// Reuses the same named "GroqClient" HttpClient already configured above.
builder.Services.AddScoped<IAIAgentService, AIAgentService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact",
        policy =>
        {
            policy.WithOrigins(
                    "http://localhost:5173",  // Vite primary port
                    "http://localhost:5174"   // Vite fallback port
                )
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
});
// 3. Configure Swagger with JWT Support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "IntelliPrep.API", Version = "v1" });

    // JWT Configuration for Swagger
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.\r\n\r\nExample: 'Bearer 12345abcdef'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement()
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = ParameterLocation.Header,
            },
            new List<string>()
        }
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowReact");
app.UseHttpsRedirection();
// Use Authentication before Authorization
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Seed Default Admin
using var scope = app.Services.CreateScope();
var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

var adminUser = dbContext.Users.FirstOrDefault(u => u.Email == "admin@intelliprep.com");
if (adminUser == null)
{
    dbContext.Users.Add(new IntelliPrep.API.Models.User
    {
        Email = "admin@intelliprep.com",
        FullName = "Super Admin",
        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
        Role = "Admin",
        CreatedAt = DateTime.UtcNow
    });
}
else
{
    // Force reset the password to ensure it matches
    adminUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!");
    dbContext.Users.Update(adminUser);
}
dbContext.SaveChanges();

app.Run();
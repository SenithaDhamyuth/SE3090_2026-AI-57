using IntelliPrep.API.Data;
using IntelliPrep.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:DefaultConnection must be configured with the hosted PostgreSQL connection string.");
}

if (!builder.Environment.IsDevelopment())
{
    var databaseHost = new Npgsql.NpgsqlConnectionStringBuilder(connectionString).Host;
    if (string.IsNullOrWhiteSpace(databaseHost))
    {
        throw new InvalidOperationException(
            "The hosted PostgreSQL connection string must specify a database host.");
    }

    var hosts = databaseHost.Split(
        ',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    if (hosts.Any(host =>
            string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            || (System.Net.IPAddress.TryParse(host, out var address)
                && System.Net.IPAddress.IsLoopback(address))))
    {
        throw new InvalidOperationException(
            "The hosted API cannot use a loopback PostgreSQL host. Configure the hosted database connection.");
    }
}

// 1. Add PostgreSQL Database Context
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// 2. Add JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key must be configured using deployment secrets and contain at least 32 bytes.");
}

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

// ── Member 1: Assessment Engine Services ──────────────────────────────────────
// Register a named HttpClient for the Groq API with proper lifecycle management.
var groqSection = builder.Configuration.GetSection("GroqSettings");
builder.Services.Configure<IntelliPrep.API.Models.GroqSettings>(groqSection);

var groqBaseUrl = groqSection["BaseUrl"] ?? "https://api.groq.com/openai/v1/chat/completions";
var groqTimeout = int.TryParse(groqSection["TimeoutSeconds"], out var t) ? t : 30;

builder.Services.AddHttpClient(PlanningCoordinatorService.HttpClientName, client =>
{
    client.BaseAddress = new Uri(groqBaseUrl);
    // Timeout is now handled inside CallGroqAsync per request, but we can leave a default here or remove it
    client.Timeout     = TimeSpan.FromSeconds(groqTimeout);
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

builder.Services.AddScoped<PlanningCoordinatorService>();
builder.Services.AddScoped<ContentSynthesizerService>();

// ── Agent 3 (ExamSynthesizerAgent) + Agent 4 (ValidationAgentService) ─────
// Agent 3 synthesizes MCQs grounded by syllabus limits fetched from the DB.
// Agent 4 validates Agent 3's output deterministically and persists on pass.
builder.Services.AddScoped<ExamSynthesizerAgent>();
builder.Services.AddScoped<ValidationAgentService>();

// ── Member 2: AI Agent Service (Past Paper Analyst + Study Planner) ────────
// Reuses the same named "GroqClient" HttpClient already configured above.
builder.Services.AddScoped<IAIAgentService, AIAgentService>();

// ── Third-Party Integration: Email Notification Service ───────────────────
// Uses System.Net.Mail (SMTP). Configure EmailSettings in appsettings.json.
builder.Services.AddScoped<IntelliPrep.API.Services.INotificationService,
                            IntelliPrep.API.Services.NotificationService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddProblemDetails();

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.SetIsOriginAllowed(_ => true)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
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

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler();
    app.UseStatusCodePages();
}

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseStaticFiles(); // Added to serve wwwroot/uploads

app.UseRouting();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

using var scope = app.Services.CreateScope();
var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
var migrationLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
    .CreateLogger("DatabaseMigrations");

try
{
   // await dbContext.Database.MigrateAsync();
    migrationLogger.LogInformation("Database migrations applied successfully.");
}
catch (Exception ex)
{
    migrationLogger.LogError(ex, "Failed to apply database migrations during startup.");
    throw;
}
try { dbContext.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ADD COLUMN \"ProfileImageUrl\" character varying(255) NULL;"); } catch { }

// ── Seed historical questions from Excel dataset ───────────────────────────
var seederEnv    = scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>();
var seederLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
                       .CreateLogger("DatabaseSeeder");
await IntelliPrep.API.Data.DatabaseSeeder.SeedQuestionsAsync(dbContext, seederEnv, seederLogger);

app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));

app.Run();
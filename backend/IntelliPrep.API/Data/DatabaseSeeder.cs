using IntelliPrep.API.Models;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;

namespace IntelliPrep.API.Data
{
    /// <summary>
    /// Seeds the Questions table on startup by reading the master ICT dataset Excel file.
    /// Only runs when the Questions table is completely empty — safe for repeat restarts.
    /// </summary>
    public static class DatabaseSeeder
    {
        // Relative to the executing assembly location so it works in both
        // Development (bin/Debug) and Production (publish) layouts.
        private const string ExcelFileName = "2011-2025_ICT_Master_Dataset_Complete.xlsx";
        private const string SheetName     = "2015_2025_ICT_Master_Dataset_CL";

        public static async Task SeedQuestionsAsync(
            ApplicationDbContext db,
            IWebHostEnvironment env,
            ILogger logger)
        {
            // ── Guard: skip if data already exists ────────────────────────────
            if (await db.Questions.AnyAsync())
            {
                logger.LogInformation("[Seeder] Questions table already populated — skipping Excel import.");
                return;
            }

            // ── Locate the Excel file ─────────────────────────────────────────
            // Search order: Data/Datasets/ (source tree) → ContentRootPath → app base dir
            var searchDirs = new[]
            {
                Path.Combine(env.ContentRootPath, "Data", "Datasets"),
                env.ContentRootPath,
                AppContext.BaseDirectory
            };

            string? excelPath = searchDirs
                .Select(d => Path.Combine(d, ExcelFileName))
                .FirstOrDefault(File.Exists);

            if (excelPath is null)
            {
                logger.LogWarning(
                    "[Seeder] Excel file '{File}' not found in any of: {Dirs}. Skipping seed.",
                    ExcelFileName, string.Join(", ", searchDirs));
                return;
            }

            logger.LogInformation("[Seeder] Loading questions from: {Path}", excelPath);

            // ── Set EPPlus licence (NonCommercial) ───────────────────────────
            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

            var questions = new List<Question>();

            using var package = new ExcelPackage(new FileInfo(excelPath));

            // Try the exact sheet name first, fall back to the first sheet
            var sheet = package.Workbook.Worksheets[SheetName]
                     ?? package.Workbook.Worksheets[0];

            if (sheet is null)
            {
                logger.LogError("[Seeder] No worksheets found in '{File}'. Aborting seed.", ExcelFileName);
                return;
            }

            logger.LogInformation("[Seeder] Reading sheet '{Sheet}' ({Rows} data rows).",
                sheet.Name, sheet.Dimension?.Rows - 1 ?? 0);

            // ── Read column headers from row 1 ───────────────────────────────
            int totalRows = sheet.Dimension?.Rows ?? 1;
            if (totalRows < 2)
            {
                logger.LogWarning("[Seeder] Sheet has no data rows. Skipping.");
                return;
            }

            // Build a header→column-index map (case-insensitive trim)
            var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            for (int col = 1; col <= sheet.Dimension!.Columns; col++)
            {
                var header = sheet.Cells[1, col].Text.Trim();
                if (!string.IsNullOrEmpty(header) && !headerMap.ContainsKey(header))
                    headerMap[header] = col;
            }

            // Helper: read a cell text safely
            string Cell(int row, string name)
            {
                if (!headerMap.TryGetValue(name, out int col)) return string.Empty;
                return sheet.Cells[row, col].Text.Trim();
            }

            int Int(int row, string name)
                => int.TryParse(Cell(row, name), out var v) ? v : 0;

            // ── Parse each data row ──────────────────────────────────────────
            var seenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            int skipped = 0;

            for (int row = 2; row <= totalRows; row++)
            {
                var qId = Cell(row, "Question_ID");
                var qText = Cell(row, "Question_Text");

                // Skip blank or duplicate rows
                if (string.IsNullOrWhiteSpace(qId) || string.IsNullOrWhiteSpace(qText))
                {
                    skipped++;
                    continue;
                }

                if (!seenIds.Add(qId))
                {
                    logger.LogDebug("[Seeder] Duplicate Question_ID '{Id}' at row {Row} — skipped.", qId, row);
                    skipped++;
                    continue;
                }

                // Derive Correct_Answer from Correct_Option_No if column exists
                var correctOptionNo = Int(row, "Correct_Option_No");
                var correctAnswer   = Cell(row, "Correct_Answer");
                if (string.IsNullOrWhiteSpace(correctAnswer) && correctOptionNo >= 1 && correctOptionNo <= 5)
                {
                    correctAnswer = Cell(row, $"Option_{correctOptionNo}");
                }

                questions.Add(new Question
                {
                    Question_ID      = qId,
                    Year             = Int(row, "Year"),
                    Paper_Type       = Cell(row, "Paper_Type"),
                    Lesson_Name      = Cell(row, "Lesson_Name"),
                    Difficulty_Level = Cell(row, "Difficulty_Level"),
                    Question_Text    = qText,
                    Option_1         = Cell(row, "Option_1"),
                    Option_2         = Cell(row, "Option_2"),
                    Option_3         = Cell(row, "Option_3"),
                    Option_4         = Cell(row, "Option_4"),
                    Option_5         = Cell(row, "Option_5"),
                    Correct_Answer   = correctAnswer,
                    Correct_Option_No= correctOptionNo,
                    Image_Filename   = Cell(row, "Image_Filename")   is { } img  && img.Length  > 0 ? img  : "NONE",
                    Image_Description= Cell(row, "Image_Description") is { } desc && desc.Length > 0 ? desc : "NONE",
                });
            }

            if (questions.Count == 0)
            {
                logger.LogWarning("[Seeder] No valid rows parsed from Excel. Nothing inserted.");
                return;
            }

            // ── Bulk insert using AddRangeAsync + SaveChanges ─────────────────
            // EF Core batches INSERTs automatically — no manual chunking needed.
            logger.LogInformation("[Seeder] Inserting {Count} questions ({Skipped} rows skipped)…",
                questions.Count, skipped);

            await db.Questions.AddRangeAsync(questions);
            await db.SaveChangesAsync();

            logger.LogInformation("[Seeder] ✅ Seeding complete — {Count} questions inserted.", questions.Count);
        }
    }
}

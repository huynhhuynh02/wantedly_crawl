const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const { Op } = require("sequelize");
const { Company, sequelize } = require("./Company");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

// Middleware for parsing JSON
app.use(express.json());
// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

app.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      const transaction = await sequelize.transaction();

      try {
        for (let record of results) {
          const created_date = new Date();
          const { name, website, source } = record;
          // Use `website` if that's what your model expects
          const existingCompany = await Company.findOne({
            where: { website },
            transaction,
          });

          if (!existingCompany) {
            await Company.create(
              { name, website, source, created_date },
              { transaction }
            );
          }
        }

        await transaction.commit();
        res.send("CSV file imported successfully");
      } catch (error) {
        await transaction.rollback();
        res.status(500).send(`Error processing CSV file: ${error.message}`);
      } finally {
        // Clean up the uploaded file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error(`Failed to delete file: ${err}`);
        });
      }
    });
});

app.get("/companies", async (req, res) => {
  const {
    page = 1,
    pageSize = 10,
    search = "",
    startDate,
    endDate,
  } = req.query;

  // Create the where clause with optional search and date range
  const whereClause = {
    [Op.and]: [
      search ? { name: { [Op.iLike]: `%${search}%` } } : null,
      startDate && endDate
        ? {
            created_date: {
              [Op.between]: [new Date(startDate), new Date(endDate)],
            },
          }
        : null,
    ].filter(Boolean), // Remove null values
  };

  try {
    // Get total count for pagination
    const total = await Company.count({ where: whereClause });

    // Fetch paginated results
    const companies = await Company.findAll({
      where: whereClause,
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize, // Offset for pagination
    });

    // Send the data back with total, current page, and total pages
    res.json({
      data: companies,
      total,
      pages: Math.ceil(total / pageSize),
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(500).send("An error occurred while fetching companies");
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

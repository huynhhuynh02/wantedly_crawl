const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const xlsx = require("xlsx");
const puppeteer = require("puppeteer");
const sequelize = require("./database");
const Company = require("./Company");

const baseURL = "https://www.wantedly.com";

const startPage = 1786;
const endPage = 2000;

// Function to fetch company links
async function getCompaniesLinks(page) {
  try {
    // Launch Puppeteer in headful mode and simulate a desktop environment
    const browser = await puppeteer.launch({
      headless: false, // Launch in headful mode so you can see the browser
      args: ["--start-maximized"], // Start maximized (optional)
    });

    const pageInstance = await browser.newPage();

    // Set the user agent to simulate a desktop browser (e.g., Chrome)
    await pageInstance.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Set a larger viewport size to mimic desktop resolution
    await pageInstance.setViewport({ width: 1366, height: 768 });

    await pageInstance.goto(`${baseURL}/projects?&page=${page}`, {
      waitUntil: "networkidle0", // Ensure that network requests are done
    });

    // Wait for the specific section that contains the job posts to appear
    await pageInstance.waitForSelector(
      'section[class^="ProjectListJobPostsLaptop"]'
    );

    // Get the page content after the section has fully loaded
    const content = await pageInstance.content();
    const $ = cheerio.load(content);

    const links = [];

    // Target only the section with the class prefix "ProjectListJobPostsLaptop"
    $('section[class^="ProjectListJobPostsLaptop"] a[href^="/companies"]').each(
      (i, element) => {
        const href = $(element).attr("href");
        if (href) {
          links.push(baseURL + href);
        }
      }
    );

    await browser.close();
    return links;
  } catch (error) {
    console.error(`Error fetching page ${page}:`, error);
    return [];
  }
}

// Function to get company details
async function getCompanyDetails(companyURL) {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(companyURL, { waitUntil: "networkidle0" });

    const content = await page.content();
    const $ = cheerio.load(content);

    const companyName = $('div[class^="BasicInfoSection__CompanyName"]')
      .text()
      .trim();

    const address = $("i.wt-icon-location")
      .next('div[class^="BasicInfoSection__CompanyInfoDescription"]')
      .text()
      .trim();

    const website =
      $('div[class^="BasicInfoSection__CompanyInfoDescription"] a').attr(
        "href"
      ) || "Website not available";

    const founded = $("i.wt-icon-person")
      .next('div[class^="BasicInfoSection__CompanyInfoDescription"]')
      .text()
      .trim();

    const foundedDate = $("i.fa-flag")
      .next('div[class^="BasicInfoSection__CompanyInfoDescription"]')
      .text()
      .trim();

    const members = [];
    $('div[class^="FeaturedMembershipCard__Name"]').each((i, element) => {
      const name = $(element).text().trim();
      if (name) {
        members.push(name);
      }
    });

    await browser.close();

    return { companyName, address, website, foundedDate, founded, members };
  } catch (error) {
    console.error(`Error fetching company URL ${companyURL}:`, error);
    return null;
  }
}

// Function to save company details using Sequelize
async function saveCompanyToDatabase(companyDetails, companyURL, page) {
  const { companyName, address, website, foundedDate, founded, members } =
    companyDetails;

  try {
    // Use `findOrCreate` to avoid duplicates
    await Company.findOrCreate({
      where: { url: companyURL },
      defaults: {
        name: companyName,
        address,
        website,
        foundedDate,
        founded,
        members: members.join(", "),
        created_date: new Date(),
        source: baseURL,
        page: page,
      },
    });
    console.log(`Saved company: ${companyName}`);
  } catch (error) {
    console.error(`Error saving company ${companyName}:`, error);
  }
}

// Main function to run the crawler
(async () => {
  try {
    await sequelize.authenticate(); // Connect to the database
    await sequelize.sync(); // Sync the model with the database
    console.log("Database connected and synced.");

    for (let page = startPage; page <= endPage; page++) {
      console.log(`Fetching page ${page}...`);
      const linksFromPage = await getCompaniesLinks(page);
      for (const link of linksFromPage) {
        // Use for...of to handle async properly
        console.log(`Crawling company ${link}...`);
        const companyDetails = await getCompanyDetails(link); // Fetch company details
        if (companyDetails) {
          await saveCompanyToDatabase(companyDetails, link, page); // Save the details to the database
        }
      }
    }

    console.log("Data crawling and saving completed.");
  } catch (error) {
    console.error("Error in the crawling process:", error);
  } finally {
    await sequelize.close(); // Close the connection
  }
})();

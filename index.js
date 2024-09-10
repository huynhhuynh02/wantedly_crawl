const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const xlsx = require("xlsx");
const puppeteer = require("puppeteer");
const sequelize = require("./database");
const Company = require("./Company");

const baseURL = "https://www.wantedly.com";

const startPage = 1;
const endPage = 1000;

// Function to fetch company links
async function getCompaniesLinks(page) {
  try {
    const browser = await puppeteer.launch();
    const pageInstance = await browser.newPage();

    await pageInstance.goto(
      `${baseURL}/projects?new=true&page=${page}&order=popular`,
      {
        waitUntil: "networkidle0", // Ensure that network requests are done
      }
    );

    // Wait for a specific selector that appears after the data has fully loaded
    await pageInstance.waitForSelector('a[href^="/companies"]');

    // Get page content after it fully loads
    const content = await pageInstance.content();
    const $ = cheerio.load(content);

    const links = [];
    $('a[href^="/companies"]').each((i, element) => {
      const href = $(element).attr("href");
      if (href) {
        links.push(baseURL + href);
      }
    });

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
async function saveCompanyToDatabase(companyDetails, companyURL) {
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

    const results = [];
    const listCompanyUrl = [];

    for (let page = startPage; page <= endPage; page++) {
      console.log(`Fetching page ${page}...`);
      const linksFromPage = await getCompaniesLinks(page);
      linksFromPage.forEach((link) => listCompanyUrl.push(link));
      console.log(listCompanyUrl);
    }

    for (const link of listCompanyUrl) {
      console.log(`Crawling company ${link}...`);

      const companyDetails = await getCompanyDetails(link);
      if (companyDetails) {
        await saveCompanyToDatabase(companyDetails, link); // Save to database
        results.push(companyDetails);
      }
    }

    console.log("Data crawling and saving completed.");
  } catch (error) {
    console.error("Error in the crawling process:", error);
  } finally {
    await sequelize.close(); // Close the connection
  }
})();

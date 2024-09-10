const { Sequelize } = require("sequelize");

const sequelize = new Sequelize("wantedly_crawl", "root", "12345678", {
  host: "localhost",
  dialect: "mysql",
  logging: false, // Disable logging for clean output
});

module.exports = sequelize;

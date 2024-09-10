const { DataTypes } = require("sequelize");
const sequelize = require("./database");

const Company = sequelize.define(
  "Companies",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING,
    },
    website: {
      type: DataTypes.STRING,
    },
    foundedDate: {
      type: DataTypes.STRING,
    },
    founded: {
      type: DataTypes.STRING,
    },
    members: {
      type: DataTypes.TEXT,
    },
    url: {
      type: DataTypes.STRING,
      unique: true, // Ensure the URL is unique to avoid duplicates
    },
  },
  {
    timestamps: false, // Disable createdAt and updatedAt
  }
);

module.exports = Company;

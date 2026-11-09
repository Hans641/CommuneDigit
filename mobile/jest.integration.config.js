const base = require("./jest.config");
module.exports = {
  ...base,
  testMatch: ["**/integration/*.test.js"],
  testTimeout: 30000,
};

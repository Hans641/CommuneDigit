module.exports = {
  preset: "react-native",
  setupFilesAfterEnv: ["<rootDir>/test.setup.js"],
  testMatch: ["**/__tests__/**/*.test.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-keychain|react-native-svg|lucide-react-native)/)",
  ],
};

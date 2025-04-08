module.exports = {
  preset: "ts-jest",
  testMatch: ["**/test/**/*.ts?(x)"],
  testEnvironment: "jsdom",
  transform: {
    "^.+.tsx?$": [
      "ts-jest",
      {
        tsconfig: "./test/tsconfig.json",
      },
    ],
  },
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ["./test/setup.ts"],
};

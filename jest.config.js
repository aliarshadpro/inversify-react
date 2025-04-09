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
  testTimeout: 30000,
  setupFilesAfterEnv: ["./test/setup.ts"],
  testEnvironmentOptions: {
    url: "http://localhost",
  },
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};

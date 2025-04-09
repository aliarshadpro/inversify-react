import "reflect-metadata";
import "@testing-library/jest-dom";

// This file is used for setup only, no tests needed

// Ensure proper cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

// Add a dummy test to satisfy Jest's requirement for at least one test
describe("setup", () => {
  test("setup file loads correctly", () => {
    expect(true).toBe(true);
  });
});

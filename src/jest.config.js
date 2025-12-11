/** @type {import('ts-jest').JestConfigWithTsJest} */
// eslint-disable-next-line no-undef
module.exports = {
    testEnvironment: "node", // note that we can't use tauri stuff in this environment!
    transform: {
        "^.+.tsx?$": ["ts-jest", {}],
    },
    testMatch: ["<rootDir>/src/**/*.test.ts"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
    roots: ["<rootDir>/src"],
};

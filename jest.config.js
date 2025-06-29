export default {
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": ["es-jest", { "format": "esm" }],
    "^.+\\.mjs$": ["es-jest", { "format": "esm" }],
  },
};

export default {
  preset: "ts-jest/presets/default-esm",
  moduleNameMapper: {},
  testEnvironment: "miniflare",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      // required due to custom location of tsconfig.json configuration file
      // https://kulshekhar.github.io/ts-jest/docs/getting-started/options/tsconfig
      { tsconfig: "./tests/tsconfig.json", useESM: true },
    ],
  },
};

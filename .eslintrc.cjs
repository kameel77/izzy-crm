module.exports = {
  root: true,
  ignorePatterns: [
    "node_modules",
    "dist",
    "build",
    "coverage",
    "*.config.js",
    "*.config.cjs",
    "*.config.mjs",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/explicit-module-boundary-types": "off",
  },
  overrides: [
    {
      files: ["apps/frontend/**/*.{ts,tsx}"],
      env: {
        browser: true,
        es2021: true,
      },
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      plugins: ["react", "react-hooks"],
      extends: [
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "plugin:@typescript-eslint/recommended",
      ],
      settings: {
        react: {
          version: "detect",
        },
      },
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
      },
    },
    {
      files: ["apps/backend/**/*.ts"],
      env: {
        node: true,
        es2021: true,
      },
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
      },
      rules: {
        "@typescript-eslint/no-var-requires": "off",
      },
    },
    {
      files: ["packages/**/*.{ts,tsx}"],
      env: {
        es2021: true,
      },
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
      },
    },
    {
      files: ["**/*.{test,spec}.{ts,tsx}"],
      env: {
        node: true,
        es2021: true,
        jest: true,
      },
    },
  ],
};

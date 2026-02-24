/**
 * Jest Configuration
 *
 * Configures testing framework for mission-control project
 * TypeScript support via ts-jest
 * Path mapping support for @/ imports
 */

module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Test environment - use Node for backend tests (can be overridden per file)
  testEnvironment: 'node',

  // Root directories to search for tests
  roots: ['<rootDir>/lib', '<rootDir>/convex', '<rootDir>/src'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],

  // Module name mapping for @/ imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // TypeScript configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'lib/**/*.ts',
    'convex/**/*.ts',
    'src/app/api/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/.next/**',
    '!**/coverage/**',
  ],

  // Coverage threshold
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'text-summary', 'html', 'json'],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,
};

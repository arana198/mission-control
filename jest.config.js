/**
 * Jest Configuration
 *
 * Configures testing framework for mission-control monorepo project
 * TypeScript support via ts-jest
 * Path mapping support for @/ imports
 */

module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Test environment - use jsdom to support JSX in both frontend and backend
  testEnvironment: 'jsdom',

  // Root directories to search for tests
  roots: [
    '<rootDir>/backend/convex',
    '<rootDir>/backend/lib',
    '<rootDir>/frontend/src',
    '<rootDir>/frontend/lib',
  ],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],

  // Module name mapping for @/ imports
  // Must match tsconfig.json paths exactly for ts-jest to resolve correctly
  moduleNameMapper: {
    '^@/convex/(.*)$': '<rootDir>/backend/convex/$1',
    '^@/lib/(.*)$': '<rootDir>/frontend/lib/$1',
    '^@/types/(.*)$': '<rootDir>/frontend/src/types/$1',
    '^@/components/(.*)$': '<rootDir>/frontend/src/components/$1',
    '^@/contexts/(.*)$': '<rootDir>/frontend/src/contexts/$1',
    '^@/hooks/(.*)$': '<rootDir>/frontend/src/hooks/$1',
    '^@/styles/(.*)$': '<rootDir>/frontend/src/styles/$1',
    '^@/services/(.*)$': '<rootDir>/frontend/src/services/$1',
    '^@/app/(.*)$': '<rootDir>/frontend/src/app/$1',
    '^@/(.*)$': '<rootDir>/frontend/$1',
  },

  // TypeScript configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
        jsxImportSource: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'backend/lib/**/*.ts',
    'backend/convex/**/*.ts',
    'frontend/src/app/api/**/*.ts',
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

  // Setup files to run after test environment is ready
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Verbose output
  verbose: true,
};

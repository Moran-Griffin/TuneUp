module.exports = {
  projects: [
    {
      displayName: 'logic',
      testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'babel-jest',
          {
            configFile: false,
            presets: [
              ['@babel/preset-env', { targets: { node: 'current' } }],
              '@babel/preset-typescript',
            ],
          },
        ],
      },
      testEnvironment: 'node',
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
    },
    {
      displayName: 'react-native',
      preset: 'jest-expo',
      setupFilesAfterEnv: ['@testing-library/react-native/matchers'],
      testMatch: ['<rootDir>/**/*.test.tsx', '<rootDir>/**/*.spec.tsx'],
      testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
    },
  ],
};

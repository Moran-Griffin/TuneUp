module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};

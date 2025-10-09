module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  moduleFileExtensions: ['cjs','ts','js','json'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: { '^.+\\.ts$': [ 'ts-jest', { useESM: true } ] },
  testMatch: [ '<rootDir>/__tests__/**/*.(spec|test).(cjs|js)' ],
  transformIgnorePatterns: [ 'node_modules/(?!(algoliasearch))/' ]
};
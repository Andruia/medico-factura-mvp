module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testPathIgnorePatterns: [
        '/node_modules/',
        '/scratch/',
    ],
    moduleNameMapper: {
        '^@/modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@/(.*)$': '<rootDir>/src/$1',
    },
};
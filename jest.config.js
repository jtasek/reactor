// module.exports = {
//   testEnvironment: 'node',
//   roots: ['<rootDir>/src'],
//   transform: {
//     '^.+\\.tsx?$': 'ts-jest'
//   },
//   testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
//   moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
// };
module.exports = {
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest'
  }
};

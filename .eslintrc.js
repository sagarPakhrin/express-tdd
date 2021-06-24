module.exports = {
  parserOptions: {
    ecmaVersion: 2018,
  },
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  plugins: ['prettier'],
  env: {
    node: true,
    es6: true,
    jest: true,
  },
  rules: {
    eqeqeq: 'warn',
    'prettier/prettier': 'warn',
  },
};

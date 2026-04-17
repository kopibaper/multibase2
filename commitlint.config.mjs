/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce standard types
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'ci', 'revert'],
    ],
    // Allow longer subject lines for this project
    'subject-max-length': [1, 'always', 100],
    // Don't enforce body max line length (URLs can be long)
    'body-max-line-length': [0],
  },
};

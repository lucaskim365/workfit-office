/*
  훅 순서 검사 한 가지만 본다(react-hooks/rules-of-hooks).
  훅을 조건문 안이나 일찍 돌아가는 줄(early return) 뒤에서 부르면, 그리는 때마다 훅 개수가 달라져 화면이 통째로 죽는다.
  타입 검사로는 잡히지 않아 따로 돌린다 — npm run lint · npm run build 에 들어 있다.
*/
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    // 다른 규칙은 켜지 않으므로, 그 규칙을 끄는 주석이 '쓸모없다'고 알리지 않는다
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
];

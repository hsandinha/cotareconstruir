import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

const config = [
    {
        ignores: [
            '.next/**',
            'node_modules/**',
            'coverage/**',
            'dist/**',
            'build/**',
        ],
    },
    ...compat.extends('next/core-web-vitals'),
    {
        rules: {
            'react-hooks/exhaustive-deps': 'off',
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/immutability': 'off',
            'react-hooks/rules-of-hooks': 'off',
            'react/no-unescaped-entities': 'off',
        },
    },
];

export default config;

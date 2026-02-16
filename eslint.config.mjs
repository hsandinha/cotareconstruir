import nextVitals from 'eslint-config-next/core-web-vitals.js';

const config = [
    ...nextVitals,
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

/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
    theme: {
        extend: {
            // "crimson" = Tailwind's rose palette so we can write bg-crimson-600, etc.
            colors: {
                crimson: colors.rose,
            },
            boxShadow: {
                card: '0 1px 3px rgba(0,0,0,.06)',
            },
        },
    },
    plugins: [],
};

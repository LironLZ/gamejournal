/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
    theme: {
        extend: {
            colors: {
                // Brand + Accent
                brand: colors.indigo,
                crimson: colors.rose,
            },
            boxShadow: {
                card: '0 1px 3px rgba(0,0,0,.06)',
            },
        },
    },
    // we generate these badge classes by name; safelist ensures they’re not purged
    safelist: [
        'badge-playing',
        'badge-planning',
        'badge-paused',
        'badge-dropped',
        'badge-completed',
    ],
    plugins: [],
};

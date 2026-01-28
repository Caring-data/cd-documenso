/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@documenso/tailwind-config');
const path = require('path');

module.exports = {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    './app/**/*.{ts,tsx}',
    `${path.join(require.resolve('@documenso/ui'), '..')}/components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/ui'), '..')}/icons/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/ui'), '..')}/lib/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/ui'), '..')}/primitives/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/email'), '..')}/templates/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/email'), '..')}/template-components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/email'), '..')}/providers/**/*.{ts,tsx}`,
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme?.extend,
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Caveat', 'cursive'],
        dancing: ['"Dancing Script"', 'cursive'],
        greatVibes: ['"Great Vibes"', 'cursive'],
        cookie: ['Cookie', 'cursive'],
        monteCarlo: ['"Monte Carlo"', 'cursive'],
        lato: ['Lato', 'sans-serif'],
        arial: ['Arial', 'sans-serif'],
      },
    },
  },
};

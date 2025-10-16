/** @type {import('tailwindcss').Config} */
module.exports = {
  // ← THESE globs must cover every template & component
  content: [
    "./src/**/*.{html,ts}",        // all Angular files
    "./projects/**/*.{html,ts}"    // if you use libs
  ],

  // Utility classes you build dynamically go here
  safelist: [],

  theme: { extend: {} },
  plugins: [],
};

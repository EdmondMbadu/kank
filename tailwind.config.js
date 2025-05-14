/** @type {import('tailwindcss').Config} */
module.exports = {
  // ← THESE globs must cover every template & component
  content: [
    "./src/**/*.{html,ts}",        // all Angular files
    "./projects/**/*.{html,ts}"    // if you use libs
  ],

  // Utility classes you build dynamically go here
  safelist: [
    // exact class names
    "w-36",
    "bg-green-700",
    "text-red-600",
    // or a RegExp pattern for whole families
    { pattern: /(bg|text|border|ring)-(green|red|blue)-(100|200|300|400|500|600|700)/ }
  ],

  theme: { extend: {} },
  plugins: [],
};

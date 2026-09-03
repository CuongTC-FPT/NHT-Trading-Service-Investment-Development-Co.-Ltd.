/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./HTML/**/*.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e05915",
          hover: "#bf480d",
          light: "#fff7ed",
        },
        navy: {
          DEFAULT: "#0f172a",
          light: "#1e293b",
          muted: "#475569",
        },
      },
    },
  },
  plugins: [],
};

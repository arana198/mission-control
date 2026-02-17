const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
}

module.exports = nextConfig

import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  output: {
    target: 'node',
    distPath: {
      root: 'build',
    },
    filename: {
      js: '[name].js',
    },
    // Clean the output directory before building
    cleanDistPath: true,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  tools: {
    rspack: {
      target: 'node18',
      externals: {
        // Mark these as external to avoid bundling them
        'better-sqlite3': 'commonjs better-sqlite3',
        'sqlite3': 'commonjs sqlite3',
        'express': 'commonjs express',
      },
      node: {
        // Preserve __dirname and __filename
        __dirname: false,
        __filename: false,
      },
    },
  },
  mode: 'production',
});

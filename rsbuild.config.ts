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
      output: {
        module: true,
        chunkFormat: 'module',
        library: {
          type: 'module',
        },
      },
      experiments: {
        outputModule: true,
      },
      externalsType: 'module',
      externals: {
        // Mark these as external to avoid bundling them
        'better-sqlite3': 'better-sqlite3',
        'sqlite3': 'sqlite3',
        'express': 'express',
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

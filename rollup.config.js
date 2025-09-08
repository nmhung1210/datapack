
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import polyfill from 'rollup-plugin-polyfill-node';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: false,
    },
    {
      file: 'dist/index.mjs',
      format: 'es',
      sourcemap: false,
    },
    {
        file: 'dist/index.umd.js',
        format: 'umd',
        name: 'datapack',
        sourcemap: false,
        plugins: [terser()]
      }
  ],
  plugins: [
    typescript({ tsconfig: './tsconfig.json' }),
    nodeResolve(),
    polyfill(),
  ],
};

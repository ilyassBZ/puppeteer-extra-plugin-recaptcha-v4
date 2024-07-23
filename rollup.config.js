import resolve from 'rollup-plugin-node-resolve'
import sourceMaps from 'rollup-plugin-sourcemaps'
import typescript from 'rollup-plugin-typescript2'
const pkg = require('./package.json')

const banner = `
/*!
 * ${pkg.name} v${pkg.version} by ${pkg.author}
 * ${pkg.homepage || `https://github.com/${pkg.repository}`}
 * @license ${pkg.license}
 */
`.trim()

const defaultExportOutro = `
  module.exports = exports.default || {};
  Object.entries(exports).forEach(([key, value]) => { module.exports[key] = value; });
`

export default {
  input: './src/index.ts',
  output: [
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      outro: defaultExportOutro,
      banner,
    },
    {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
      exports: 'named',
      banner,
    },
  ],
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
  watch: {
    include: 'src/**',
  },
  plugins: [
    typescript({ useTsconfigDeclarationDir: true }),
    resolve(),
    sourceMaps(),
  ],
}

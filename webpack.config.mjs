import webpack from 'webpack';
import path, { dirname } from 'path';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import ESLintWebpackPlugin from 'eslint-webpack-plugin'

import { fileURLToPath } from 'url';

const { NODE_ENV = 'development' } = process.env;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  devtool: 'source-map',
  entry: [
    // activate HMR for React
    // 'react-hot-loader/patch',
    'webpack-hot-middleware/client',
    // 'eventsource-polyfill',
    './src/index.tsx'
  ],
  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, 'dist')
    // publicPath: '/'
  },
  mode: NODE_ENV,
  module: {
    rules: [
      {
        test: /\.(mjs|js|ts|tsx)$/,
        exclude: /node_modules/,
        include: [path.resolve(__dirname, 'src')],
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript'
              }
            }
          }
        }
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        include: [path.resolve(__dirname, 'src')],
        use: [
          'style-loader',
          '@teamsupercell/typings-for-css-modules-loader',
          {
            loader: 'css-loader',
            options: { modules: { namedExport: false, exportLocalsConvention: 'as-is' } }
          },
          'postcss-loader'
        ]
      },
      {
        test: /\.svg$/,
        exclude: /node_modules/,
        include: path.join(__dirname, 'src'),
        use: [
          {
            loader: 'file-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    // enable HMR globally
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new ReactRefreshWebpackPlugin(),
    new ESLintWebpackPlugin(),
  ],
  optimization: {
    // prints more readable module names in the browser console on HMR updates
    moduleIds: 'named',
    // do not emit compiled assets that include errors
    emitOnErrors: false
  },
  resolve: {
    alias: {
      src: path.join(__dirname, 'src')
    },
    modules: [path.join(__dirname, 'src'), '.', 'node_modules'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css']
    // To sync path aliases between tsconfig and webpack
    // plugins: [
    //   new TsconfigPathsPlugin({
    //     configFile: 'tsconfig.json',
    //     extensions: ['.ts', '.tsx', '.js', '.jsx']
    //   })
    // ]
  }
};

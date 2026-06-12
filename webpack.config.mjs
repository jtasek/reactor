import webpack from 'webpack';
import path, { dirname } from 'path';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import ESLintWebpackPlugin from 'eslint-webpack-plugin';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';

import { fileURLToPath } from 'url';

const { NODE_ENV = 'development' } = process.env;
const isDev = NODE_ENV === 'development';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
    // Full source maps in dev; none in prod to avoid leaking source.
    devtool: isDev ? 'source-map' : false,
    entry: isDev ? ['webpack-hot-middleware/client', './src/index.tsx'] : ['./src/index.tsx'],
    output: {
        // Content-hashed filenames in prod enable long-term immutable caching.
        filename: isDev ? 'bundle.js' : '[name].[contenthash].js',
        path: path.join(__dirname, 'dist'),
        publicPath: '/',
        clean: !isDev
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
                                syntax: 'typescript',
                                tsx: true
                            },
                            transform: {
                                react: {
                                    runtime: 'automatic',
                                    development: isDev,
                                    refresh: isDev
                                }
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
                    // Inject styles at runtime in dev; extract to a hashed file in prod
                    // so a strict CSP (no 'unsafe-inline') can be enforced.
                    isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
                    '@teamsupercell/typings-for-css-modules-loader',
                    {
                        loader: 'css-loader',
                        options: { modules: { namedExport: false, exportLocalsConvention: 'as-is' } }
                    }
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
    plugins: isDev
        ? [
              // enable HMR globally
              new webpack.HotModuleReplacementPlugin(),
              new webpack.NoEmitOnErrorsPlugin(),
              new ESLintWebpackPlugin(),
              // React Fast Refresh (dev only) — preserves component state on edits
              new ReactRefreshWebpackPlugin({ overlay: { sockIntegration: 'whm' } })
          ]
        : [
              new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' }),
              new HtmlWebpackPlugin({
                  template: path.join(__dirname, 'src', 'template.html'),
                  inject: 'body',
                  minify: {
                      collapseWhitespace: true,
                      removeComments: true,
                      minifyCSS: true,
                      minifyJS: true
                  }
              })
          ],
    optimization: {
        // Readable module names on HMR in dev; stable hashes for caching in prod.
        moduleIds: isDev ? 'named' : 'deterministic',
        // do not emit compiled assets that include errors
        emitOnErrors: false,
        minimize: !isDev,
        minimizer: ['...', new CssMinimizerPlugin()],
        runtimeChunk: isDev ? false : 'single',
        splitChunks: isDev ? false : { chunks: 'all' }
    },
    resolve: {
        alias: {
            src: path.join(__dirname, 'src')
        },
        modules: [path.join(__dirname, 'src'), '.', 'node_modules'],
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
        // To sync path aliases between tsconfig and webpack
        plugins: [
            new TsconfigPathsPlugin({
                configFile: 'tsconfig.json',
                extensions: ['.ts', '.tsx', '.js', '.jsx']
            })
        ]
    }
};

export default config;

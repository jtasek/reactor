const path = require('path');
const webpack = require('webpack');

const { NODE_ENV = 'development' } = process.env;
const nodeExternals = require('webpack-node-externals');

module.exports = {
  devtool: 'source-map',
  entry: [
    // activate HMR for React
    'react-hot-loader/patch',
    'webpack-hot-middleware/client',
    'eventsource-polyfill',
    './src/index.tsx'
  ],
  externals: [nodeExternals()],
  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, 'dist'),
    publicPath: '/',
    context: 'src'
  },
  mode: NODE_ENV,
  module: {
    rules: [
      {
        test: /\.[js|ts].x?$/,
        exclude: /node_modules/,
        use: ['eslint-loader', 'ts-loader']
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]-[local]-[hash:base64:5]'
              }
            }
          },
          {
            loader: 'typings-for-css-modules-loader',
            options: {
              modules: true,
              namedExport: true
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              ident: 'postcss',
              plugins: () => [require('autoprefixer')]
            }
          }
        ]
      },
      {
        test: /\.svg$/,
        exclude: /node_modules/,
        include: path.join(__dirname, 'src'),
        loader: 'file-loader'
      }
    ]
  },
  plugins: [
    // enable HMR globally
    new webpack.HotModuleReplacementPlugin()
  ],
  optimization: {
    // prints more readable module names in the browser console on HMR updates
    moduleIds: 'named',
    // do not emit compiled assets that include errors
    noEmitOnErrors: true
  },
  resolve: {
    modules: [path.join(__dirname, 'src'), 'node_modules'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.css']
  }
};

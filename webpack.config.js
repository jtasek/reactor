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
    publicPath: '/'
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
    // eslint-loader seem to try to access this.options which was removed.
    // As workaround use
    new webpack.LoaderOptionsPlugin({ options: {} }),
    // enable HMR globally
    new webpack.HotModuleReplacementPlugin(),
    // prints more readable module names in the browser console on HMR updates
    new webpack.NamedModulesPlugin(),
    // do not emit compiled assets that include errors
    new webpack.NoEmitOnErrorsPlugin()
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.css']
  }
};

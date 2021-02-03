const webpack = require('webpack');
const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const { NODE_ENV = 'development' } = process.env;

module.exports = {
  devtool: 'source-map',
  entry: [
    // activate HMR for React
    // 'react-hot-loader/patch',
    // 'webpack-hot-middleware/client',
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
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
        include: [path.resolve(__dirname, 'src')]
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
            options: { modules: true }
          },
          'postcss-loader'
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
    // new webpack.HotModuleReplacementPlugin()
  ],
  optimization: {
    // prints more readable module names in the browser console on HMR updates
    moduleIds: 'named',
    // do not emit compiled assets that include errors
    noEmitOnErrors: true
  },
  resolve: {
    // alias: {
    //   src: path.join(__dirname, 'src/')
    // },
    // modules: [path.join(__dirname, 'src')],
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

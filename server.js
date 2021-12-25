import path from 'path';
import express from 'express';
import webpack from 'webpack';
import webpackMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import { config } from './webpack.config.mjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const compiler = webpack(config);
const { PORT = 4000 } = process.env;

app.use(
  webpackMiddleware(compiler, {
    publicPath: config.output.publicPath,
    // noInfo: true,
    // hot: true,
    stats: {
      colors: true
    }
    // contentBase: 'src',
    // stats: {
    //   colors: true,
    //   hash: false,
    //   timings: true,
    //   chunks: true,
    //   chunkModules: false,
    //   modules: false
    // }
  })
);

app.use(
  webpackHotMiddleware(compiler, {
    reload: true // reload page when webpack gets stuck
  })
);

app.use('/icons', express.static(`${__dirname}/static/icons/`));
app.use('/images', express.static(`${__dirname}/static/images/`));
app.use('/styles', express.static(`${__dirname}/static/styles/`));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './src/index.html'));
});

app.listen(PORT, 'localhost', (err) => {
  if (err) {
    return console.log(err);
  }

  console.log(`Listening at http://localhost:${PORT}`);
});

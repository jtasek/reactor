import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

const root = path.dirname(fileURLToPath(import.meta.url));
export default {
    mode: 'production',
    entry: './src/preview/runtime.ts',
    output: {
        path: path.join(root, 'dist-preview'),
        filename: '[name].[contenthash].js',
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'swc-loader',
                    options: { jsc: { parser: { syntax: 'typescript' } } }
                }
            },
            { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
    },
    resolve: { extensions: ['.ts', '.js'] },
    plugins: [
        new HtmlWebpackPlugin({ template: './src/preview/template.html' }),
        new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' })
    ],
    performance: { hints: 'error', maxEntrypointSize: 492 * 1024, maxAssetSize: 248 * 1024 }
};

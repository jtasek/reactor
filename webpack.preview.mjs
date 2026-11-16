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
        publicPath: '/',
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'swc-loader',
                    options: { jsc: { target: 'es2022', parser: { syntax: 'typescript' } } }
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
    // The plan's budget for the preview runtime; it was 24.8 KiB on 2026-11-16.
    performance: { hints: 'error', maxEntrypointSize: 150 * 1024, maxAssetSize: 150 * 1024 }
};

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import webpack from 'webpack';

const root = path.dirname(fileURLToPath(import.meta.url));
const rules = (fonts) => [
    {
        test: /\.ts$/,
        use: {
            loader: 'swc-loader',
            options: { jsc: { target: 'es2022', parser: { syntax: 'typescript' } } }
        }
    },
    { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
    ...(fonts ? [{ test: /\.woff2$/, type: fonts }] : [])
];

/** Writes the runtime, its styles and fonts into one page the editor fills with a snapshot. */
class PackagePlugin {
    apply(compiler) {
        compiler.hooks.thisCompilation.tap('PackagePlugin', (compilation) => {
            compilation.hooks.processAssets.tap(
                {
                    name: 'PackagePlugin',
                    stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
                },
                (assets) => {
                    const names = Object.keys(assets);
                    const take = (extension) => {
                        const found = names.filter((name) => name.endsWith(extension));
                        if (found.length !== 1) {
                            throw new Error(`The package needs exactly one ${extension} file.`);
                        }
                        const text = assets[found[0]].source().toString();
                        compilation.deleteAsset(found[0]);

                        return text;
                    };
                    const script = take('.js');
                    const style = take('.css');
                    if (/<\/script|<!--/i.test(script) || /<\/style/i.test(style)) {
                        throw new Error('The runtime cannot be written inline into the package.');
                    }
                    const hash = createHash('sha256').update(script).digest('base64');
                    const csp = [
                        "default-src 'none'",
                        `script-src 'sha256-${hash}'`,
                        "style-src 'unsafe-inline'",
                        'img-src data:',
                        'font-src data:',
                        "base-uri 'none'",
                        "form-action 'none'"
                    ].join('; ');
                    const page = readFileSync(path.join(root, 'src/preview/package.html'), 'utf8')
                        .replace('<!-- reactor:csp -->', () => csp)
                        .replace('<!-- reactor:style -->', () => style)
                        .replace('<!-- reactor:script -->', () => script);
                    compilation.emitAsset('package.html', new webpack.sources.RawSource(page));
                }
            );
        });
    }
}

const runtime = {
    mode: 'production',
    entry: './src/preview/runtime.ts',
    output: {
        path: path.join(root, 'dist-preview'),
        filename: '[name].[contenthash].js',
        publicPath: '/',
        // The package is built beside the runtime by the second configuration.
        clean: { keep: /^package\.html$/ }
    },
    module: { rules: rules() },
    resolve: { extensions: ['.ts', '.js'] },
    plugins: [
        new HtmlWebpackPlugin({ template: './src/preview/template.html' }),
        new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' })
    ],
    // The plan's budget for the preview runtime; it was 24.8 KiB on 2026-11-16.
    performance: { hints: 'error', maxEntrypointSize: 150 * 1024, maxAssetSize: 150 * 1024 }
};

/** The downloadable standalone package: the same runtime, with fonts inlined. */
const standalonePackage = {
    mode: 'production',
    entry: './src/preview/runtime.ts',
    output: { path: path.join(root, 'dist-preview'), filename: 'package.js' },
    module: { rules: rules('asset/inline') },
    resolve: { extensions: ['.ts', '.js'] },
    plugins: [new MiniCssExtractPlugin({ filename: 'package.css' }), new PackagePlugin()],
    // The runtime plus about 100 KiB of inlined fonts.
    performance: { hints: 'error', maxEntrypointSize: 250 * 1024, maxAssetSize: 250 * 1024 }
};

export default [runtime, standalonePackage];

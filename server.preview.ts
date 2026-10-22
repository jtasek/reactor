import { fileURLToPath } from 'node:url';
import { previewConfiguration, previewServer } from './server/preview.ts';
import { parsePort } from './server/pages.ts';

const config = previewConfiguration(process.env);
if (!config) {
    throw new Error('PREVIEW_ORIGIN and EDITOR_ORIGIN are required for the preview server.');
}
const app = previewServer(fileURLToPath(new URL('./dist-preview', import.meta.url)), config);
const server = app.listen(parsePort(process.env.PORT ?? '4001'), process.env.HOST ?? '0.0.0.0');
server.on('error', (error) => {
    console.error(error);
    process.exit(1);
});
const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

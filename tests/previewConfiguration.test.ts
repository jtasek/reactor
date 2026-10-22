import { previewConfiguration } from '../server/preview';

it('leaves preview disabled unless explicitly configured', () => {
    expect(previewConfiguration({})).toBeNull();
});
it.each([
    ['https://editor.example.com', 'https://app.example.com'],
    ['https://editor.example.com', 'https://editor.example.com'],
    ['https://editor.example.com', 'http://app.preview.test'],
    ['https://editor.example.com', 'https://app.preview.test/path'],
    ['https://editor.example.com', 'https://user:pass@app.preview.test'],
    ['http://localhost:4000', 'http://localhost:4001']
])('rejects unsafe editor %s / preview %s configuration', (editor, preview) => {
    expect(() =>
        previewConfiguration({ EDITOR_ORIGIN: editor, PREVIEW_ORIGIN: preview })
    ).toThrow();
});
it('accepts a separately hosted app subdomain and explicit loopback testing', () => {
    expect(
        previewConfiguration({
            EDITOR_ORIGIN: 'https://editor.example.com',
            PREVIEW_ORIGIN: 'https://app.preview.test'
        })?.previewOrigin
    ).toBe('https://app.preview.test');
    expect(
        previewConfiguration({
            EDITOR_ORIGIN: 'http://127.0.0.1:4000',
            PREVIEW_ORIGIN: 'http://127.0.0.1:4001',
            PREVIEW_ALLOW_LOCALHOST: 'true'
        })?.local
    ).toBe(true);
});

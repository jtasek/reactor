import { packageFileName, writeStandalonePackage } from 'src/preview/standalonePackage';
import { PREVIEW_PROTOCOL_VERSION, type PreviewApplication } from 'src/shared/previewProtocol';

const template =
    '<!doctype html><html><body><main id="preview"></main><!-- reactor:package --><script>run()</script></body></html>';
const application: PreviewApplication = {
    documentId: 'document',
    images: {},
    screens: [
        {
            id: 'home',
            name: '</script><script>alert(1)</script>',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            nodes: []
        }
    ]
};

test('writes the snapshot as data no text in it can break out of', () => {
    const page = writeStandalonePackage(template, 'Shop <!-- app', application);
    const data = /<script type="application\/json" id="reactor-package">(.*?)<\/script>/.exec(
        page
    )![1];
    expect(page.match(/<script/g)).toHaveLength(2);
    expect(data).not.toContain('<');
    expect(JSON.parse(data)).toEqual({
        version: PREVIEW_PROTOCOL_VERSION,
        name: 'Shop <!-- app',
        application
    });
    expect(page.endsWith('<script>run()</script></body></html>')).toBe(true);
});

test('refuses a page that is not the package template', () => {
    expect(() => writeStandalonePackage('<html></html>', 'A', application)).toThrow('not valid');
    expect(() =>
        writeStandalonePackage(`${template}<!-- reactor:package -->`, 'A', application)
    ).toThrow('not valid');
});

test('names the file after the document', () => {
    expect(packageFileName('Shop: v2/final')).toBe('Shop- v2-final.html');
    expect(packageFileName('  ')).toBe('Reactor prototype.html');
});

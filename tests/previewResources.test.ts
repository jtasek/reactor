import { createPreviewResources } from 'src/preview/resources';
import { projectPreview } from 'src/preview/project';
import { readPreview, MAX_PREVIEW_BYTES, MAX_PREVIEW_NODES } from 'src/preview/protocol';
import { createComponent, createShape } from 'src/app/factories';
import { MAX_IMAGE_BYTES } from 'src/app/services/assets';
import { previewImageAsset, previewImageFixture, PREVIEW_PNG } from './support/previewImages';
import { previewFixture } from './support/preview';
import type { InstanceShape } from 'src/app/types';

const signal = () => new AbortController().signal;
beforeEach(() => vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() })));
afterEach(() => vi.unstubAllGlobals());

it('bounds the drawing before reading any image bytes', async () => {
    const asset = await previewImageAsset();
    const read = vi.fn().mockResolvedValue(asset);
    const prepare = createPreviewResources({ read });
    const oversized = projectPreview(previewImageFixture(asset.hash), {});
    oversized.screens[0].name = 'é'.repeat(MAX_PREVIEW_BYTES / 2);
    await expect(prepare(oversized, signal())).rejects.toThrow('8 MiB');
    const complex = projectPreview(previewImageFixture(asset.hash), {});
    const image = complex.screens[0].nodes.at(-1)!.children![0];
    complex.screens[0].nodes = Array.from({ length: MAX_PREVIEW_NODES + 1 }, (_, index) => ({
        ...image,
        key: `image-${index}`
    }));
    await expect(prepare(complex, signal())).rejects.toThrow('excessively complex');
    expect(read).not.toHaveBeenCalled();
});

it('transfers verified image bytes once, caches them across graph updates and leaves the graph unchanged', async () => {
    const asset = await previewImageAsset();
    const document = previewImageFixture(asset.hash);
    const before = JSON.stringify(document);
    const read = vi.fn().mockResolvedValue({ ...asset, type: 'image/svg+xml' });
    const prepare = createPreviewResources({ read });
    const drawing = projectPreview(document, {});
    const result = await prepare(drawing, signal());
    expect(result.images).toEqual({ [asset.hash]: `data:image/png;base64,${PREVIEW_PNG}` });
    expect(read).toHaveBeenCalledExactlyOnceWith(asset.hash, document.id);
    expect(result.screens[0].nodes.at(-2)!.children![0]).toMatchObject({
        image: asset.hash,
        attrs: { x: 24, y: 160, width: 120, height: 60, preserveAspectRatio: 'xMidYMid meet' }
    });
    expect(result.screens[0].nodes.at(-1)!.attrs).toMatchObject({
        opacity: 0.5,
        transform: expect.stringContaining('rotate(15 ')
    });
    document.frames.home.name = 'Renamed home';
    expect((await prepare(projectPreview(document, {}), signal())).screens[0].name).toBe(
        'Renamed home'
    );
    expect(read).toHaveBeenCalledTimes(1);
    document.frames.home.name = 'Home';
    expect(JSON.stringify(document)).toBe(before);
});

it('retries missing images and rejects corrupted, mismatched, oversized and executable image data', async () => {
    const asset = await previewImageAsset();
    const drawing = projectPreview(previewImageFixture(asset.hash), {});
    const read = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(asset);
    const prepare = createPreviewResources({ read });
    await expect(prepare(drawing, signal())).rejects.toThrow('not available yet');
    await expect(prepare(drawing, signal())).resolves.toHaveProperty(`images.${asset.hash}`);
    const svg = new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    );
    const oversized = new Uint8Array(MAX_IMAGE_BYTES + 1);
    for (const invalid of [
        { ...asset, bytes: svg },
        { ...asset, bytes: oversized }
    ]) {
        await expect(
            createPreviewResources({ read: vi.fn().mockResolvedValue(invalid) })(drawing, signal())
        ).rejects.toThrow('verification');
    }
    const wrong = projectPreview(previewImageFixture('0'.repeat(64)), {});
    await expect(
        createPreviewResources({ read: vi.fn().mockResolvedValue(asset) })(wrong, signal())
    ).rejects.toThrow('verification');
});

it('evicts unused bytes and excludes hidden images', async () => {
    const asset = await previewImageAsset();
    const document = previewImageFixture(asset.hash);
    const hiddenHash = '0'.repeat(64);
    document.shapes.hidden = {
        ...document.shapes.photo,
        id: 'hidden',
        visible: false,
        source: `asset:${hiddenHash}`
    } as typeof document.shapes.photo;
    document.shapesIds.push('hidden');
    const read = vi.fn().mockResolvedValue(asset);
    const prepare = createPreviewResources({ read });
    await prepare(projectPreview(document, {}), signal());
    await prepare(projectPreview(previewFixture(), {}), signal());
    await prepare(projectPreview(document, {}), signal());
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).not.toHaveBeenCalledWith(hiddenHash, expect.anything());
});

it('rejects images that have valid content signatures but cannot be decoded', async () => {
    const asset = await previewImageAsset();
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('Invalid image'));
    const prepare = createPreviewResources({ read: vi.fn().mockResolvedValue(asset) });
    await expect(
        prepare(projectPreview(previewImageFixture(asset.hash), {}), signal())
    ).rejects.toThrow('could not be decoded');
});

it('includes nested library image artwork with instance transforms and accessible alternative text', async () => {
    const asset = await previewImageAsset();
    const document = previewImageFixture(asset.hash);
    const picture = { ...document.shapes.photo, id: 'picture', position: { x: 0, y: 0 } };
    delete picture.parentFrameId;
    const hidden = {
        ...picture,
        id: 'hidden-picture',
        visible: false,
        source: `asset:${'0'.repeat(64)}`
    };
    const alt = {
        ...createShape({
            type: 'text',
            name: 'Alt',
            order: 'a1',
            position: { x: 0, y: 20 },
            value: 'Portrait',
            fontSize: 12
        }),
        id: 'alt',
        visible: false
    };
    document.components.image = createComponent({
        id: 'image',
        name: 'Image',
        shapesIds: ['picture', 'alt', 'hidden-picture'],
        sourceShapes: { picture, alt, 'hidden-picture': hidden },
        props: [{ id: 'alt', shapeId: 'alt', key: 'text', label: 'Alt' }],
        interaction: { role: 'image', props: { alt: 'alt' } }
    });
    const nested = {
        ...(createShape({
            type: 'instance',
            name: 'Nested image',
            order: 'a1',
            componentId: 'image',
            position: { x: 0, y: 0 },
            overrides: { alt: 'Ada' },
            rotation: 20
        }) as InstanceShape),
        id: 'nested'
    };
    document.components.wrapper = createComponent({
        id: 'wrapper',
        name: 'Wrapper',
        shapesIds: ['nested'],
        sourceShapes: { nested }
    });
    document.shapes.wrapper = {
        ...nested,
        id: 'wrapper',
        componentId: 'wrapper',
        parentFrameId: 'home',
        position: { x: 50, y: 250 },
        overrides: {},
        rotation: 30
    };
    document.shapesIds.push('wrapper');
    const result = await createPreviewResources({ read: vi.fn().mockResolvedValue(asset) })(
        projectPreview(document, {}),
        signal()
    );
    const wrapper = result.screens[0].nodes.at(-1)!;
    expect(wrapper.attrs.transform).toContain('rotate(30 ');
    expect(wrapper.children![0]).toMatchObject({
        control: { role: 'image', label: 'Ada' },
        attrs: { transform: expect.stringContaining('rotate(20 ') }
    });
    expect(wrapper.children![0].children![0].children![0].image).toBe(asset.hash);
    expect(Object.keys(result.images)).toEqual([asset.hash]);
});

it('aborts stale preparation without dropping an image needed by a newer update', async () => {
    const asset = await previewImageAsset();
    const drawing = projectPreview(previewImageFixture(asset.hash), {});
    const { promise, resolve } = Promise.withResolvers<typeof asset>();
    const read = vi.fn().mockReturnValue(promise);
    const prepare = createPreviewResources({ read });
    const controller = new AbortController();
    const old = prepare(drawing, controller.signal);
    controller.abort();
    const current = prepare(drawing, signal());
    resolve(asset);
    await expect(old).rejects.toMatchObject({ name: 'AbortError' });
    await expect(current).resolves.toHaveProperty(`images.${asset.hash}`);
    expect(read).toHaveBeenCalledTimes(1);
});

it('keeps the aggregate payload bound and refuses missing or externally sourced runtime resources', async () => {
    const asset = await previewImageAsset();
    const result = await createPreviewResources({ read: vi.fn().mockResolvedValue(asset) })(
        projectPreview(previewImageFixture(asset.hash), {}),
        signal()
    );
    expect(() => readPreview({ ...result, images: {} })).toThrow('resource is missing');
    expect(() =>
        readPreview({ ...result, images: { [asset.hash]: 'https://editor.test/private.png' } })
    ).toThrow('Invalid preview image');
    expect(() =>
        readPreview({ ...result, images: { [asset.hash]: 'data:image/svg+xml;base64,PHN2Zz4=' } })
    ).toThrow('Invalid preview image');
    expect(() =>
        readPreview({
            ...result,
            images: { [asset.hash]: `data:image/png;base64,${'a'.repeat(8 * 1024 * 1024)}` }
        })
    ).toThrow('8 MiB');
    const node = result.screens[0].nodes.at(-1)!.children![0];
    node.attrs.href = `data:image/png;base64,${PREVIEW_PNG}`;
    expect(() => readPreview(result)).toThrow('attributes');
});

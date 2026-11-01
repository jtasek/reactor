import type { Context } from 'src/app';
import { createPreviewResources } from 'src/preview/resources';
import { projectSvg, serializeSvg } from './svg';

export async function downloadSvg({ state, effects }: Context) {
    const drawing = projectSvg(state);
    const application = await createPreviewResources(effects.assets)(
        drawing,
        new AbortController().signal
    );
    const stroke = getComputedStyle(document.documentElement)
        .getPropertyValue('--shape-stroke-color')
        .trim();
    const url = URL.createObjectURL(
        new Blob([serializeSvg(application, stroke)], { type: 'image/svg+xml' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${drawing.screens[0].name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 150) || 'Reactor'}.svg`;
    link.click();
    // Give the browser time to consume the object URL before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

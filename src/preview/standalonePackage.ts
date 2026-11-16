import { PREVIEW_PROTOCOL_VERSION, type PreviewApplication } from '../shared/previewProtocol';

const MARKER = '<!-- reactor:package -->';

/** Writes a validated snapshot into the preview site's package page, which then plays it
 * offline: the page's policy allows no requests, so it never reaches a server. */
export function writeStandalonePackage(
    template: string,
    name: string,
    application: PreviewApplication
) {
    if (!/^<!doctype html>/i.test(template) || template.split(MARKER).length !== 2) {
        throw new Error('The prototype package from the preview site is not valid.');
    }
    if (
        !template.includes(
            `<meta name="reactor-preview-protocol" content="${PREVIEW_PROTOCOL_VERSION}" />`
        )
    ) {
        throw new Error(
            'The preview site runs a different Reactor release. Try again once both are updated.'
        );
    }
    // `<` escaped so no text in the document can end the script element early.
    const data = JSON.stringify({ version: PREVIEW_PROTOCOL_VERSION, name, application }).replace(
        /</g,
        '\\u003c'
    );

    return template.replace(
        MARKER,
        () => `<script type="application/json" id="reactor-package">${data}</script>`
    );
}

/** A file name that is safe on common systems, from the document's name. */
export function packageFileName(name: string) {
    return `${
        name
            .replace(/[\\/:*?"<>|]/g, '-')
            .slice(0, 150)
            .trim() || 'Reactor prototype'
    }.html`;
}

/** The package page of the preview site that the editor is configured with. */
export async function fetchPackageTemplate(signal: AbortSignal) {
    const config = await fetch('/api/preview-config', { signal });
    const origin = config.ok ? (await config.json()).origin : null;
    if (typeof origin !== 'string' || !URL.canParse(origin) || new URL(origin).origin !== origin) {
        throw new Error('Downloading needs the preview site. Set PREVIEW_ORIGIN and start it.');
    }
    const response = await fetch(`${origin}/package.html`, {
        credentials: 'omit',
        cache: 'no-cache',
        signal
    });
    if (!response.ok) {
        throw new Error('The prototype package could not be loaded. Try again.');
    }

    return response.text();
}

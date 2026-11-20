import {
    PREVIEW_PROTOCOL_VERSION,
    type PreviewApplication,
    type PreviewDrawing
} from '../shared/previewProtocol';
import type { Document } from '../app/types';
import { contextSession, type CheckContext } from '../app/accessibilityCheck';
import { projectPreview, type PreviewInspection, type PreviewSession } from './project';
import { createPreviewResources } from './resources';
import type { AccessibilityRules } from './accessibilityRules';

const MARKER = '<!-- reactor:package -->';
const START_PAGE = 'Choose an available start page before downloading.';

/** Another context a package can be viewed in: its modes and size, drawn as Prototype would. */
export interface PackageView {
    name: string;
    application: PreviewDrawing;
}

/** What a package carries besides the session it was tested in. */
export interface PackageExtras {
    views: PackageView[];
    accessibility: AccessibilityRules;
}

/**
 * The tested session and each chosen context, every drawing's images in one table. A
 * context that can't be drawn stops the download, as the tested session would.
 */
export async function packageContents(
    document: Document,
    session: PreviewSession,
    inspection: PreviewInspection,
    contexts: readonly CheckContext[],
    accessibility: AccessibilityRules,
    assets: Parameters<typeof createPreviewResources>[0],
    signal: AbortSignal
): Promise<{ application: PreviewApplication; extras: PackageExtras }> {
    const resources = createPreviewResources(assets);
    const tested = projectPreview(document, {}, [], session, inspection);
    if (!tested.screens.length || tested.screens[0].id !== session.screenId) {
        throw new Error(START_PAGE);
    }
    const application = await resources(tested, signal);
    const views: PackageView[] = [];
    let images = application.images;
    for (const context of contexts) {
        const drawing = projectPreview(
            document,
            {},
            [],
            contextSession(document, session, context),
            {}
        );
        const { images: used, ...view } = await resources(drawing, signal);
        images = { ...images, ...used };
        views.push({ name: context.name, application: view });
    }

    return { application: { ...application, images }, extras: { views, accessibility } };
}

/** Writes a validated snapshot into the preview site's package page, which then plays it
 * offline: the page's policy allows no requests, so it never reaches a server. */
export function writeStandalonePackage(
    template: string,
    name: string,
    application: PreviewApplication,
    extras?: PackageExtras
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
    const data = JSON.stringify({
        version: PREVIEW_PROTOCOL_VERSION,
        name,
        application,
        ...extras
    }).replace(/</g, '\\u003c');

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

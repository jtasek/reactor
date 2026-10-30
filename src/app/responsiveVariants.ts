import type { Document, InstanceShape, Size } from './types';
import type { ModeAddress } from './inheritedModes';
import { frameParents } from './frameState';

export interface VariantWidths {
    screen?: number;
    screenProblem?: string;
    parent?: number;
    parentProblem?: string;
}

/** Parent width must be independent of the instance that it selects. */
export function variantWidths(
    document: Pick<Document, 'frames'>,
    frameId?: string,
    address: ModeAddress = {},
    sizes: Record<string, Size> = {}
): VariantWidths {
    const parents = frameParents(document.frames);
    const ancestry: string[] = [];
    for (let id = frameId; id; id = parents.get(id)) {
        ancestry.push(id);
    }
    const screen =
        document.frames[
            ancestry.filter((id) => document.frames[id]?.kind === 'screen').at(-1) ??
                address.screenId ??
                ''
        ];
    const view = document.frames[address.viewId ?? ''];
    const parent = document.frames[frameId ?? ''];
    // projectScreen replaces this definition's size with its supplied local viewport.
    const viewWidth =
        address.screenId === screen?.id
            ? screen?.size.width
            : view?.kind === 'view' && view.screenId === screen?.id
              ? view.size.width
              : undefined;
    const dependsOnContent = ancestry.some(
        (id, index) =>
            document.frames[id]?.sizing?.width?.mode === 'hug' &&
            ancestry
                .slice(0, index)
                .every((child) => document.frames[child]?.sizing?.width?.mode === 'fill')
    );

    return {
        screen:
            screen?.sizing?.width?.mode === 'hug' ? undefined : (viewWidth ?? screen?.size.width),
        screenProblem:
            screen?.sizing?.width?.mode === 'hug'
                ? 'Screen width depends on its contents. Use a fixed screen viewport.'
                : undefined,
        parent:
            parent && !dependsOnContent
                ? Math.max(
                      0,
                      (sizes[parent.id]?.width ?? parent.size.width) -
                          2 * (parent.stack?.padding ?? 0)
                  )
                : undefined,
        parentProblem: dependsOnContent
            ? 'Parent width depends on its contents. Give the parent a fixed width or use Screen view width.'
            : undefined
    };
}

/** Inclusive thresholds; missing context and invalid rules have a stable default fallback. */
export function responsiveVariant(
    document: Pick<Document, 'components'>,
    instance: InstanceShape,
    widths: VariantWidths
): { componentId: string; explanation: string; problem?: string } {
    const family = document.components[instance.componentId];
    const settings = family?.responsiveVariants;
    const fallback = (problem?: string) => ({
        componentId: instance.componentId,
        explanation: 'Auto · default source',
        problem
    });
    if (instance.variantMode !== 'auto' || instance.variantId) {
        const chosen = instance.variantId;

        return {
            componentId:
                chosen && family?.variantIds?.includes(chosen) && document.components[chosen]
                    ? chosen
                    : instance.componentId,
            explanation: 'Explicit source'
        };
    }
    if (!settings || settings.rules.length === 0) {
        return fallback('No responsive rules. Add minimum widths to the component family.');
    }
    const width = widths[settings.source];
    if (width === undefined || !Number.isFinite(width)) {
        return fallback(
            settings.source === 'parent'
                ? (widths.parentProblem ??
                      'No layout parent width. Place the instance in a frame or choose Screen view width.')
                : (widths.screenProblem ?? 'No Screen view width. Place the instance in a screen.')
        );
    }
    if (new Set(settings.rules.map((rule) => rule.minWidth)).size !== settings.rules.length) {
        return fallback(
            'Duplicate minimum widths. Give each responsive rule a different threshold.'
        );
    }
    const rule = settings.rules
        .filter((item) => item.minWidth <= width)
        .sort((a, b) => b.minWidth - a.minWidth)[0];
    const label = `${settings.source === 'screen' ? 'Screen view' : 'Parent inner'} width ${width}px`;
    if (!rule) {
        return { ...fallback(), explanation: `Auto · ${label} · default below all thresholds` };
    }
    if (!family.variantIds?.includes(rule.variantId) || !document.components[rule.variantId]) {
        return fallback(
            `The variant at ≥ ${rule.minWidth}px is unavailable. Repair or remove this rule.`
        );
    }

    return {
        componentId: rule.variantId,
        explanation: `Auto · ${label} · ≥ ${rule.minWidth}px → ${document.components[rule.variantId].name}`
    };
}

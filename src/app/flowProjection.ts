import type { Document, InstanceShape } from './types';
import { screenOwners } from './screenViews';
import { screenFrames } from './screens';
import { isShapeLocked } from './utils';
import { effectiveActivation } from './screenInteractions';

/** Definitions and authored layout controls, independent of canvas placements and geometry. */
export function projectFlow(document: Document) {
    const owners = screenOwners(document.frames);
    const available = new Set(screenFrames(document).map((screen) => screen.id));
    const screens = Object.values(document.frames).filter((frame) => frame.kind === 'screen');
    const sourceIds = new Set(
        Object.values(document.components)
            .filter((component) => component.sourceOnly)
            .flatMap((component) => component.shapesIds)
    );
    const controls: {
        key: string;
        screenId: string;
        instanceId: string;
        name: string;
        target?: string;
        editable: boolean;
        shared: boolean;
    }[] = [];
    const visit = (
        instance: InstanceShape,
        screenId: string,
        path: string,
        ancestors: Set<string>
    ) => {
        const component = document.components[instance.componentId];
        if (!component || ancestors.has(component.id)) {
            return;
        }
        controls.push({
            key: path,
            screenId,
            instanceId: instance.id,
            name: instance.name,
            shared: path !== instance.id,
            target: effectiveActivation(component, instance)?.screenId,
            editable:
                document.shapes[instance.id] === instance && !isShapeLocked(document, instance.id)
        });
        const next = new Set(ancestors).add(component.id);
        for (const sourceId of [component.id, ...(component.variantIds ?? [])]) {
            const source = document.components[sourceId];
            for (const id of source?.shapesIds ?? []) {
                const child = source.sourceShapes?.[id] ?? document.shapes[id];
                if (child?.type === 'instance') {
                    visit(child, screenId, `${path}/${sourceId}/${id}`, next);
                }
            }
        }
    };
    for (const shape of Object.values(document.shapes)) {
        const owner = owners.get(shape.parentFrameId ?? '');
        if (shape.type === 'instance' && owner && !sourceIds.has(shape.id)) {
            visit(shape, owner, shape.id, new Set());
        }
    }

    return screens.map((screen) => ({
        id: screen.id,
        name: screen.name,
        available: available.has(screen.id),
        controls: controls
            .filter((control) => control.screenId === screen.id)
            .map((control) => ({
                ...control,
                missing: Boolean(control.target && !available.has(control.target))
            }))
    }));
}

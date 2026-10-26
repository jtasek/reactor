import { frameParents } from './frameState';
import type { Frame } from './types';

export function initialScreenView(screen: Frame, id: string): Frame {
    return {
        id,
        kind: 'view',
        screenId: screen.id,
        name: `${screen.size.width} px`,
        position: { ...screen.position },
        size: { ...screen.size },
        visible: screen.visible,
        locked: false
    };
}

/**
 * Upgrade a hybrid root screen/placement once; a screen with no views stays without views.
 * Nested screens stay drawn in their parent frame, so they get no view.
 */
export function extractScreenViews(frames: Record<string, Frame>) {
    const added: Frame[] = [];
    const parents = frameParents(frames);

    for (const screen of Object.values(frames)) {
        if (screen.kind !== 'screen' || screen.definitionOnly || parents.get(screen.id)) {
            continue;
        }

        let id = `${screen.id}:view`;

        while (Object.hasOwn(frames, id)) {
            id += ':view';
        }

        const view = initialScreenView(screen, id);
        frames[id] = view;
        screen.definitionOnly = true;
        Object.values(frames)
            .filter((item) => item.kind === 'view' && item.screenId === screen.id)
            .forEach((item) => {
                const prefix = `${screen.name} · `;

                if (item.name.startsWith(prefix)) {
                    item.name = item.name.slice(prefix.length);
                }

                if (item.name === `${screen.name} view`) {
                    item.name = `${item.size.width} px`;
                }
            });
        added.push(view);
    }

    return added;
}

import type { Context } from './index';
import type { InteractionSettings } from './types';
import { isReadOnly } from './documentAccess';
import { isShapeLocked } from './utils';
import { orUndefined, readInteractions } from './services/documentStorage';
import { screenFrames } from './screens';
import { effectiveActivation } from './screenInteractions';

export interface InteractionEdit {
    target: 'component' | 'instance';
    id: string;
    settings: InteractionSettings;
}

export function editInteractions({ state }: Context, edit: InteractionEdit) {
    const document = state.currentDocument;
    if (document.locked || isReadOnly(state) || state.events.pointer.gesture.kind !== 'idle') {
        return;
    }
    const instance = edit.target === 'instance' ? document.shapes[edit.id] : undefined;
    if (
        edit.target === 'instance' &&
        (instance?.type !== 'instance' || isShapeLocked(document, edit.id))
    ) {
        return;
    }
    const component =
        document.components[instance?.type === 'instance' ? instance.componentId : edit.id];
    if (!component || (edit.target === 'component' && (component.library || component.locked))) {
        return;
    }
    const settings = orUndefined(() => readInteractions(edit.settings));
    if (!settings) {
        return;
    }
    const target = instance?.type === 'instance' ? instance : component;
    const current = effectiveActivation(
        component,
        instance?.type === 'instance' ? instance : undefined
    );
    const destination = settings.activate?.screenId;
    if (
        destination &&
        destination !== current?.screenId &&
        !screenFrames(document).some((screen) => screen.id === destination)
    ) {
        return;
    }
    if (JSON.stringify(target.interactions) === JSON.stringify(settings)) {
        return;
    }
    target.interactions = settings;
}

import type * as Yjs from 'yjs';
import { frameParents } from '../frameState';
import { extractScreenViews } from '../screenViewMigration';
import { legacyTheme } from '../variableModes';
import { orUndefined, readEntity, type Collection } from './documentStorage';
import type { Frame, VariableDimension } from '../types';

export function migrateDocument(
    binding: { doc: Yjs.Doc; tables: Record<Collection, Yjs.Map<unknown>> },
    yjs: typeof Yjs,
    origin: symbol,
    writeFrame: (entity: Yjs.Map<unknown>, frame: Frame | VariableDimension) => void
): boolean {
    const legacy = [...binding.tables.variables.values()].filter(
        (entity): entity is Yjs.Map<unknown> => {
            if (!(entity instanceof yjs.Map)) {
                return false;
            }
            const raw = entity.toJSON();
            return (
                raw.type === 'color' &&
                raw.dimensionId === undefined &&
                raw.values?.dark !== undefined
            );
        }
    );

    const legacyFrames = [...binding.tables.frames.values()].filter(
        (entity): entity is Yjs.Map<unknown> => entity instanceof yjs.Map && !entity.has('kind')
    );

    // Nested screens never get views, so only a root screen can still need one.
    const legacyScreens = [...binding.tables.frames.values()].some(
        (entity) =>
            entity instanceof yjs.Map &&
            entity.get('kind') === 'screen' &&
            entity.get('definitionOnly') !== true &&
            !binding.tables.frames.has(String(entity.get('parentFrameId')))
    );
    const modeEntities = [
        ...binding.tables.frames.values(),
        ...[...binding.tables.shapes.values()].filter(
            (entity) => entity instanceof yjs.Map && entity.get('type') === 'instance'
        )
    ].filter(
        (entity): entity is Yjs.Map<unknown> =>
            entity instanceof yjs.Map && !entity.has('modeOverrides')
    );
    const frameBindings = [...binding.tables.frames.values()].filter(
        (entity): entity is Yjs.Map<unknown> => entity instanceof yjs.Map && !entity.has('bindings')
    );

    if (
        legacy.length === 0 &&
        legacyFrames.length === 0 &&
        !legacyScreens &&
        modeEntities.length === 0 &&
        frameBindings.length === 0
    ) {
        return false;
    }

    const frames: Record<string, Frame> = {};

    if (legacyFrames.length > 0 || legacyScreens) {
        binding.tables.frames.forEach((entity) => {
            if (!(entity instanceof yjs.Map)) {
                return;
            }

            const frame = orUndefined(() => readEntity('frames', entity.toJSON()));

            if (frame) {
                frames[frame.id] = frame;
            }
        });
    }

    const parents = frameParents(frames);

    binding.doc.transact(() => {
        frameBindings.forEach((entity) => entity.set('bindings', new yjs.Map()));
        modeEntities.forEach((entity) => entity.set('modeOverrides', new yjs.Map()));
        legacy.forEach((entity) => entity.set('dimensionId', 'theme'));
        if (legacy.length > 0 && !binding.tables.dimensions.has('theme')) {
            const dimension = new yjs.Map();
            binding.tables.dimensions.set('theme', dimension);
            writeFrame(dimension, legacyTheme());
        }
        legacyFrames.forEach((entity) => {
            const frame = frames[String(entity.get('id'))];

            if (!frame) {
                return;
            }

            frame.kind = parents.get(frame.id) ? 'frame' : 'screen';
            entity.set('kind', frame.kind);
        });
        const added = extractScreenViews(frames);
        Object.values(frames).forEach((frame) => {
            const entity = binding.tables.frames.get(frame.id);

            if (!(entity instanceof yjs.Map)) {
                return;
            }

            if (frame.definitionOnly) {
                entity.set('definitionOnly', true);
            }

            if (entity.get('name') !== frame.name) {
                entity.set('name', frame.name);
            }
        });
        added.forEach((frame) => {
            const entity = new yjs.Map();
            binding.tables.frames.set(frame.id, entity);
            writeFrame(entity, frame);
        });
    }, origin);

    return true;
}

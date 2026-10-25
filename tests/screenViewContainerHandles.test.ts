import { json } from 'overmind';
import { projectScreenViews } from 'src/app/screenProjection';
import { canTransformScreenViewContainer } from 'src/app/screenViewEditing';
import type { ScreenViewContainer } from 'src/app/screenViewEditing';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

function setup(kind: 'group' | 'component', store = createTestStore().store, nested = false) {
    const screenId = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'screen' } });
    const viewId = store.actions.editFrame({
        kind: 'addView',
        screenId,
        position: { x: 500, y: 300 },
        size: { width: 500, height: 250 }
    })!;
    const childId = nested
        ? store.actions.editFrame({
              kind: 'add',
              position: { x: 100, y: 180 },
              size: { width: 150, height: 100 }
          })!
        : undefined;

    if (childId) {
        store.actions.editFrame({
            kind: 'update',
            id: childId,
            changes: { parentFrameId: screenId }
        });
    }

    for (const x of [120, 180]) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x, y: 110 },
            size: { width: 40, height: 40 },
            parentFrameId: childId ?? screenId
        });
    }

    const shapeIds = [...store.state.currentDocument.shapesIds];
    const owner: ScreenViewContainer =
        kind === 'group' ? { groupId: 'container' } : { componentId: 'container' };

    if (kind === 'group') {
        store.actions.addGroup({ id: 'container', shapesIds: shapeIds });
    } else {
        store.actions.addComponent({ id: 'container', shapesIds: shapeIds });
    }

    store.actions.tools.activateTool('select');

    return { store, screenId, viewId, shapeIds, owner };
}

describe.each(['group', 'component'] as const)('%s handles in Screen views', (kind) => {
    it('resizes shared members proportionally in source coordinates, leaving viewports unchanged', () => {
        const { store, viewId, shapeIds, owner } = setup(kind);
        const document = store.state.currentDocument;
        const frames = json(document.frames);
        expect(
            store.actions.events.beginGesture({
                pointerId: 1,
                position: { x: 620, y: 370 },
                screenViewId: viewId,
                handle: { ...owner, type: 'bottomRight' }
            })
        ).toBe(true);
        store.actions.events.endGesture({ pointerId: 1, position: { x: 720, y: 410 }, free: true });
        expect(document.shapes[shapeIds[0]]).toMatchObject({
            position: { x: 120, y: 110 },
            size: { width: 80, height: 80 }
        });
        expect(document.shapes[shapeIds[1]]).toMatchObject({
            position: { x: 240, y: 110 },
            size: { width: 80, height: 80 }
        });
        expect(projectScreenViews(document).map((item) => item.projection!.shapes[0])).toEqual([
            expect.objectContaining({ size: { width: 80, height: 80 } }),
            expect.objectContaining({ size: { width: 80, height: 80 } })
        ]);
        expect(json(document.frames)).toEqual(frames);
    });

    it('rotates around the projected center and restores all members and container rotation on cancel', () => {
        const { store, viewId, shapeIds, owner } = setup(kind);
        const document = store.state.currentDocument;
        const before = json(document.shapes);
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 570, y: 306 },
            screenViewId: viewId,
            handle: { ...owner, type: 'rotate' }
        });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 650, y: 350 } });
        expect(document.shapes[shapeIds[0]]).toMatchObject({
            rotation: 90,
            position: { x: 150, y: 80 }
        });
        expect(document.shapes[shapeIds[1]]).toMatchObject({
            rotation: 90,
            position: { x: 150, y: 140 }
        });
        store.actions.events.cancelGesture();
        expect(json(document.shapes)).toEqual(before);
        expect((kind === 'group' ? document.groups : document.components).container.rotation).toBe(
            0
        );
    });

    it('snaps the placed proportional box to neighboring artwork', () => {
        const { store, screenId, viewId, shapeIds, owner } = setup(kind);
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 320, y: 110 },
            size: { width: 40, height: 40 },
            parentFrameId: screenId
        });
        store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 620, y: 370 },
            screenViewId: viewId,
            handle: { ...owner, type: 'bottomRight' }
        });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 716, y: 410 } });
        expect(store.state.currentDocument.shapes[shapeIds[0]]).toMatchObject({
            size: { width: 80, height: 80 }
        });
        const gesture = store.state.events.pointer.gesture;
        expect('snapLines' in gesture && gesture.snapLines.x).toBe(720);
        store.actions.events.cancelGesture();
    });

    it('transforms hidden members with the container without including them in its visible box', () => {
        const { store, screenId, viewId, shapeIds, owner } = setup(kind);
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 300, y: 110 },
            size: { width: 20, height: 20 },
            parentFrameId: screenId,
            visible: false
        });
        const hiddenId = store.state.currentDocument.shapesIds[2];
        const container = { id: 'container', shapesIds: [...shapeIds, hiddenId] };

        if (kind === 'group') {
            store.actions.addGroup(container);
        } else {
            store.actions.addComponent(container);
        }

        expect(
            store.actions.events.beginGesture({
                pointerId: 1,
                position: { x: 620, y: 370 },
                screenViewId: viewId,
                handle: { ...owner, type: 'bottomRight' }
            })
        ).toBe(true);
        store.actions.events.endGesture({ pointerId: 1, position: { x: 720, y: 410 }, free: true });
        expect(store.state.currentDocument.shapes[hiddenId]).toMatchObject({
            position: { x: 480, y: 110 },
            size: { width: 40, height: 40 },
            visible: false
        });
    });

    it.each(['locked', 'outside', 'stack', 'nested-stack'] as const)(
        'rejects a container with a %s member',
        (restriction) => {
            const { store, viewId, screenId, shapeIds, owner } = setup(kind);
            if (restriction === 'locked') {
                store.actions.setShapesProperty({
                    shapeIds: [shapeIds[1]],
                    key: 'locked',
                    value: true
                });
            }
            if (restriction === 'outside') {
                store.actions.addShape({
                    type: 'rectangle',
                    position: { x: 800, y: 100 },
                    size: { width: 40, height: 40 }
                });
                const outsideId = store.state.currentDocument.shapesIds[2];
                const changes = { id: 'container', shapesIds: [shapeIds[0], outsideId] };

                if (kind === 'group') {
                    store.actions.addGroup(changes);
                } else {
                    store.actions.addComponent(changes);
                }
            }
            if (restriction === 'nested-stack') {
                const childId = store.actions.editFrame({
                    kind: 'add',
                    position: { x: 100, y: 180 },
                    size: { width: 150, height: 100 }
                })!;
                store.actions.editFrame({
                    kind: 'update',
                    id: childId,
                    changes: { parentFrameId: screenId }
                });
                store.actions.editFrame({
                    kind: 'reparentShapes',
                    ids: shapeIds,
                    parentFrameId: childId
                });
            }
            if (restriction === 'stack' || restriction === 'nested-stack') {
                store.actions.editFrame({
                    kind: 'update',
                    id: screenId,
                    changes: { stack: { direction: 'row', gap: 0, padding: 0, align: 'end' } }
                });
            }
            expect(
                canTransformScreenViewContainer(store.state.currentDocument, viewId, owner)
            ).toBe(false);
            expect(
                store.actions.events.beginGesture({
                    pointerId: 1,
                    position: { x: 620, y: 370 },
                    screenViewId: viewId,
                    handle: { ...owner, type: 'bottomRight' }
                })
            ).toBe(false);
            expect(store.state.events.pointer.gesture.kind).toBe('idle');
        }
    );

    it('shares and undoes resizing, preserving a remote name when canceled', async () => {
        const copies = await createCopies(2, (store) => setup(kind, store));
        const [a, b] = copies;
        const document = shownDocument(a);
        const shapeId = document.shapesIds[0];
        const viewId = Object.values(document.frames).find(
            (frame) => frame.kind === 'view' && frame.position.x === 500
        )!.id;
        const owner: ScreenViewContainer =
            kind === 'group' ? { groupId: 'container' } : { componentId: 'container' };
        const begin = () =>
            a.store.actions.events.beginGesture({
                pointerId: 1,
                position: { x: 620, y: 370 },
                screenViewId: viewId,
                handle: { ...owner, type: 'bottomRight' }
            });
        begin();
        a.store.actions.events.movePointer({
            pointerId: 1,
            position: { x: 720, y: 410 },
            free: true
        });
        edit(b, (actions) =>
            actions.setShapesProperty({ shapeIds: [shapeId], key: 'name', value: 'Remote' })
        );
        settle(copies);
        a.store.actions.events.cancelGesture();
        settle(copies);
        expect(shownDocument(a).shapes[shapeId]).toMatchObject({
            name: 'Remote',
            size: { width: 40, height: 40 }
        });
        begin();
        a.store.actions.events.endGesture({
            pointerId: 1,
            position: { x: 720, y: 410 },
            free: true
        });
        settle(copies);
        expect(shownDocument(b).shapes[shapeId]).toMatchObject({ size: { width: 80, height: 80 } });
        a.collaboration.undo(DOCUMENT_ID);
        settle(copies);
        expect(shownDocument(b).shapes[shapeId]).toMatchObject({
            name: 'Remote',
            size: { width: 40, height: 40 }
        });
    });

    it('cancels when a remote stack starts offsetting the container only in its view', async () => {
        const copies = await createCopies(2, (store) => setup(kind, store, true));
        const [a, b] = copies;
        const document = shownDocument(a);
        const before = json(document.shapes);
        const otherBefore = json(shownDocument(b).shapes);
        const viewId = Object.values(document.frames).find(
            (frame) => frame.kind === 'view' && frame.position.x === 500
        )!.id;
        const screenId = document.frames[viewId].screenId!;
        const owner: ScreenViewContainer =
            kind === 'group' ? { groupId: 'container' } : { componentId: 'container' };
        a.store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 620, y: 370 },
            screenViewId: viewId,
            handle: { ...owner, type: 'bottomRight' }
        });
        a.store.actions.events.movePointer({
            pointerId: 1,
            position: { x: 720, y: 410 },
            free: true
        });
        edit(b, (actions) =>
            actions.editFrame({
                kind: 'update',
                id: screenId,
                changes: { stack: { direction: 'row', gap: 0, padding: 0, align: 'end' } }
            })
        );
        settle(copies);
        a.store.actions.events.endGesture({
            pointerId: 1,
            position: { x: 720, y: 410 },
            free: true
        });
        settle(copies);
        expect(json(shownDocument(a).shapes)).toEqual(before);
        expect(json(shownDocument(b).shapes)).toEqual(otherBefore);
        expect(shownDocument(a).frames[screenId].stack?.align).toBe('end');
        expect(a.store.state.events.pointer.gesture.kind).toBe('idle');
    });

    it('cancels when a remote edit adds a member, keeping the changed membership', async () => {
        const copies = await createCopies(2, (store) => {
            const { screenId } = setup(kind, store);
            store.actions.addShape({
                type: 'rectangle',
                position: { x: 240, y: 110 },
                size: { width: 40, height: 40 },
                parentFrameId: screenId
            });
        });
        const [a, b] = copies;
        const document = shownDocument(a);
        const before = json(document.shapes);
        const viewId = Object.values(document.frames).find(
            (frame) => frame.kind === 'view' && frame.position.x === 500
        )!.id;
        const owner: ScreenViewContainer =
            kind === 'group' ? { groupId: 'container' } : { componentId: 'container' };
        a.store.actions.events.beginGesture({
            pointerId: 1,
            position: { x: 620, y: 370 },
            screenViewId: viewId,
            handle: { ...owner, type: 'bottomRight' }
        });
        a.store.actions.events.movePointer({
            pointerId: 1,
            position: { x: 720, y: 410 },
            free: true
        });
        edit(b, (actions) => {
            const container = { id: 'container', shapesIds: [...shownDocument(b).shapesIds] };

            if (kind === 'group') {
                actions.addGroup(container);
            } else {
                actions.addComponent(container);
            }
        });
        settle(copies);
        a.store.actions.events.endGesture({
            pointerId: 1,
            position: { x: 720, y: 410 },
            free: true
        });
        settle(copies);
        expect(json(shownDocument(a).shapes)).toEqual(before);
        expect(
            (kind === 'group' ? shownDocument(a).groups : shownDocument(a).components).container
                .shapesIds
        ).toHaveLength(3);
        expect(a.store.state.events.pointer.gesture.kind).toBe('idle');
    });
});

import { performance } from 'node:perf_hooks';
import * as frameState from 'src/app/frameState';
import { screenLayoutMembers } from 'src/app/screenLayouts';
import type { Frame } from 'src/app/types';

function frame(id: string, parentFrameId?: string): Frame {
    return {
        id,
        name: id,
        kind: 'frame',
        parentFrameId,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        visible: true,
        locked: false
    };
}

function nestedFrames(count: number) {
    const frames: Record<string, Frame> = { screen: { ...frame('screen'), kind: 'screen' } };
    for (let index = 0; index < count; index++) {
        const id = `frame-${index}`;
        frames[id] = frame(id, index ? `frame-${index - 1}` : 'screen');
    }

    return { frames };
}

it('finds members of a deeply nested screen', () => {
    const document = nestedFrames(1000);
    screenLayoutMembers(document, 'screen');
    const durations = Array.from({ length: 20 }, () => {
        const start = performance.now();
        const members = screenLayoutMembers(document, 'screen');
        const duration = performance.now() - start;
        expect([...members]).toEqual(Object.keys(document.frames));

        return duration;
    });
    if (process.env.PROFILE_LAYOUT_MEMBERS) {
        process.stdout.write(`${JSON.stringify({ layoutMembersMs: durations })}\n`);
    }
});

it('does not repeatedly walk shared ancestry', () => {
    const document = nestedFrames(800);
    const original = frameState.frameParents;
    const reads: string[] = [];
    const spy = vi.spyOn(frameState, 'frameParents').mockImplementation((frames) => {
        const parents = original(frames);
        const get = parents.get.bind(parents);
        parents.get = (id) => {
            reads.push(id);

            return get(id);
        };

        return parents;
    });
    try {
        expect(screenLayoutMembers(document, 'screen').size).toBe(801);
        expect(reads.length).toBeLessThan(801 * 10);
    } finally {
        spy.mockRestore();
    }
});

it('preserves document order, layout boundaries and normalized invalid parents', () => {
    const document: { frames: Record<string, Frame> } = {
        frames: {
            leaf: frame('leaf', 'child'),
            alternativeLeaf: frame('alternativeLeaf', 'alternative'),
            child: frame('child', 'screen'),
            alternative: { ...frame('alternative', 'screen'), screenLayout: true },
            screen: { ...frame('screen'), kind: 'screen' as const },
            orphan: frame('orphan', 'missing'),
            cycleA: frame('cycleA', 'cycleB'),
            cycleB: frame('cycleB', 'cycleA'),
            invalidLayout: { ...frame('invalidLayout', 'child'), screenLayout: true },
            view: { ...frame('view'), kind: 'view' as const, screenId: 'screen' },
            viewChild: frame('viewChild', 'view')
        }
    };
    expect([...screenLayoutMembers(document, 'screen')]).toEqual([
        'leaf',
        'child',
        'screen',
        'invalidLayout'
    ]);
    expect([...screenLayoutMembers(document, 'screen', 'alternative')]).toEqual([
        'alternativeLeaf',
        'alternative'
    ]);
    expect([...screenLayoutMembers(document, 'screen', 'missing')]).toEqual([
        'leaf',
        'child',
        'screen',
        'invalidLayout'
    ]);
    expect([...screenLayoutMembers(document, 'missing')]).toEqual([]);

    document.frames.child.parentFrameId = 'alternative';
    expect([...screenLayoutMembers(document, 'screen')]).toEqual(['screen']);
    expect([...screenLayoutMembers(document, 'screen', 'alternative')]).toEqual([
        'leaf',
        'alternativeLeaf',
        'child',
        'alternative',
        'invalidLayout'
    ]);
});

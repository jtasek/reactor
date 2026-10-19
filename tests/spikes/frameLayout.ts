/**
 * R4 spike only: planned frame records and a deterministic layout projection.
 * Not a durable format or an editor API. All children have fixed sizes for this spike;
 * positions are local to their parent, and projected boxes use canvas coordinates.
 */
export interface StackRules {
    direction: 'row' | 'column';
    gap: number;
    padding: number;
    align: 'start' | 'center' | 'end';
}

interface LayoutBase {
    id: string;
    parentId?: string;
    order: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export type LayoutNode =
    | (LayoutBase & { kind: 'frame'; stack?: StackRules })
    | (LayoutBase & { kind: 'shape' });

export type LayoutBox = Pick<LayoutBase, 'x' | 'y' | 'width' | 'height'>;
export interface LayoutProblem {
    id: string;
    code: 'invalid-geometry' | 'invalid-stack' | 'invalid-parent' | 'parent-cycle' | 'overflow';
}

const compare = (a: string, b: string) => (a < b ? -1 : Number(a > b));
const finiteNonnegative = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;
const DIRECTIONS: readonly unknown[] = ['row', 'column'];
const ALIGNMENTS: readonly unknown[] = ['start', 'center', 'end'];

function validGeometry(node: LayoutNode) {
    if (![node.x, node.y].every(Number.isFinite)) {
        return false;
    }

    return [node.width, node.height].every(finiteNonnegative);
}

/** Rules a copy cannot read, as a newer copy's direction, leave the frame free, not dropped. */
function validStack(rules: StackRules) {
    if (!DIRECTIONS.includes(rules.direction) || !ALIGNMENTS.includes(rules.align)) {
        return false;
    }

    return [rules.gap, rules.padding].every(finiteNonnegative);
}

function readableStack(node: LayoutNode, problems: LayoutProblem[]) {
    if (node.kind !== 'frame' || !node.stack) {
        return undefined;
    }

    if (!validStack(node.stack)) {
        problems.push({ id: node.id, code: 'invalid-stack' });

        return undefined;
    }

    return node.stack;
}

/** Broken parent edges stay visible as roots; no repair is written into shared data. */
function parentEdges(nodes: Map<string, LayoutNode>, problems: LayoutProblem[]) {
    const parents = new Map<string, string>();

    for (const node of nodes.values()) {
        if (!node.parentId) {
            continue;
        }

        if (nodes.get(node.parentId)?.kind !== 'frame') {
            problems.push({ id: node.id, code: 'invalid-parent' });

            continue;
        }

        parents.set(node.id, node.parentId);
    }

    const visited = new Set<string>();

    for (const node of nodes.values()) {
        const path: string[] = [];
        const indices = new Map<string, number>();
        let current: string | undefined = node.id;

        while (current !== undefined && !visited.has(current)) {
            const cycle = indices.get(current);

            if (cycle !== undefined) {
                for (const id of path.slice(cycle)) {
                    parents.delete(id);
                    problems.push({ id, code: 'parent-cycle' });
                }

                break;
            }

            indices.set(current, path.length);
            path.push(current);
            current = parents.get(current);
        }

        path.forEach((id) => visited.add(id));
    }

    return parents;
}

function stackChildren(
    frame: LayoutBox,
    rules: StackRules,
    children: LayoutNode[],
    problems: LayoutProblem[],
    frameId: string
): LayoutBox[] {
    const row = rules.direction === 'row';
    const main = row ? 'width' : 'height';
    const cross = row ? 'height' : 'width';
    const innerMain = Math.max(0, frame[main] - 2 * rules.padding);
    const innerCross = Math.max(0, frame[cross] - 2 * rules.padding);
    const occupied =
        children.reduce((total, child) => total + child[main], 0) +
        Math.max(0, children.length - 1) * rules.gap;
    const overflows = occupied > innerMain || children.some((child) => child[cross] > innerCross);

    if (overflows) {
        problems.push({ id: frameId, code: 'overflow' });
    }

    // Overflow stays visible at its authored size. No silent shrinking or clipping.
    let cursor = rules.padding;

    return children.map((child) => {
        const available = Math.max(0, innerCross - child[cross]);
        const alignment =
            rules.align === 'end' ? available : rules.align === 'center' ? available / 2 : 0;
        const across = rules.padding + alignment;
        const box = {
            x: frame.x + (row ? cursor : across),
            y: frame.y + (row ? across : cursor),
            width: child.width,
            height: child.height
        };

        cursor += child[main] + rules.gap;

        return box;
    });
}

/**
 * Re-run after each committed rule/size edit and after receiving a merged snapshot.
 * Does not write derived positions back to the CRDT, so a stale offline layout cannot
 * overwrite a newer rule or produce a sync/undo feedback loop.
 */
export function projectFrameLayout(records: readonly LayoutNode[]) {
    const problems: LayoutProblem[] = [];
    const nodes = new Map<string, LayoutNode>();

    for (const node of [...records].sort((a, b) => compare(a.id, b.id))) {
        if (!validGeometry(node)) {
            problems.push({ id: node.id, code: 'invalid-geometry' });

            continue;
        }

        nodes.set(node.id, node);
    }

    const parents = parentEdges(nodes, problems);
    const children = new Map<string, LayoutNode[]>();

    for (const [id, parent] of parents) {
        const siblings = children.get(parent) ?? [];

        siblings.push(nodes.get(id)!);
        children.set(parent, siblings);
    }

    for (const siblings of children.values()) {
        siblings.sort((a, b) => compare(a.order, b.order) || compare(a.id, b.id));
    }

    const boxes: Record<string, LayoutBox> = {};
    const pending = [...nodes.values()].filter((node) => !parents.has(node.id));

    for (const node of pending) {
        boxes[node.id] = { x: node.x, y: node.y, width: node.width, height: node.height };
    }

    // Iterative traversal also handles deeply nested frames without a JS stack limit.
    for (let index = 0; index < pending.length; index++) {
        const node = pending[index];
        const members = children.get(node.id) ?? [];
        const box = boxes[node.id];
        const stack = readableStack(node, problems);
        const positions = stack
            ? stackChildren(box, stack, members, problems, node.id)
            : members.map((child) => ({
                  x: box.x + child.x,
                  y: box.y + child.y,
                  width: child.width,
                  height: child.height
              }));

        members.forEach((child, childIndex) => {
            boxes[child.id] = positions[childIndex];
            pending.push(child);
        });
    }

    problems.sort((a, b) => compare(a.id, b.id) || compare(a.code, b.code));

    return { boxes, problems };
}

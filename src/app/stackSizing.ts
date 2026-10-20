import type { AxisSizing, Document, Size, Sizing, StackRules } from './types';

export interface SizingItem {
    id: string;
    kind: 'frame' | 'shape';
    members: string[];
    width: number;
    height: number;
}

const AXES = ['width', 'height'] as const;
const MIN_SIZE = 1;
const mainAxis = (rules: StackRules) => (rules.direction === 'row' ? 'width' : 'height');
const key = (item: Pick<SizingItem, 'id' | 'kind'>, axis: keyof Size) =>
    `${item.kind}:${item.id}:${axis}`;

interface Node {
    dependencies: string[];
    fallback: number;
    evaluate: () => number;
    problem: (message: string) => void;
}

/** Equal shares, redistributing space left by max constraints; minimums may overflow. */
function fillSizes(available: number, rules: AxisSizing[]): number[] {
    const sizes = rules.map((rule) => rule.min ?? 0);
    const pending = new Set(rules.map((_, index) => index));
    let remaining = Math.max(0, available);

    while (pending.size > 0) {
        const share = remaining / pending.size;
        const below = [...pending].filter((index) => share < sizes[index]);
        const limited =
            below.length > 0
                ? below
                : [...pending].filter(
                      (index) => share > Math.max(sizes[index], rules[index].max ?? Infinity)
                  );

        if (limited.length === 0) {
            pending.forEach((index) => {
                sizes[index] = share;
            });
            break;
        }

        limited.forEach((index) => {
            sizes[index] = Math.max(sizes[index], Math.min(share, rules[index].max ?? Infinity));
            remaining -= sizes[index];
            pending.delete(index);
        });
    }

    return sizes;
}

/** Iterative graph evaluation: cycles use authored sizes, dependents can still resolve. */
function evaluateNodes(nodes: Map<string, Node>, values: Map<string, number>) {
    const visited = new Set<string>();
    const ordered: string[] = [];
    const reverse = new Map<string, string[]>();
    nodes.forEach((node, id) =>
        node.dependencies.forEach((dependency) => {
            const members = reverse.get(dependency) ?? [];
            members.push(id);
            reverse.set(dependency, members);
        })
    );

    for (const root of nodes.keys()) {
        if (visited.has(root)) {
            continue;
        }
        visited.add(root);
        const stack = [{ key: root, next: 0 }];

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const dependency = nodes.get(current.key)!.dependencies[current.next++];

            if (dependency === undefined) {
                ordered.push(current.key);
                stack.pop();
                continue;
            }
            if (!visited.has(dependency)) {
                visited.add(dependency);
                stack.push({ key: dependency, next: 0 });
            }
        }
    }

    const assigned = new Set<string>();
    const cyclic = new Set<string>();
    for (const root of [...ordered].reverse()) {
        if (assigned.has(root)) {
            continue;
        }
        const members = [root];
        assigned.add(root);
        for (let index = 0; index < members.length; index++) {
            for (const neighbor of reverse.get(members[index]) ?? []) {
                if (!assigned.has(neighbor)) {
                    assigned.add(neighbor);
                    members.push(neighbor);
                }
            }
        }
        if (members.length > 1 || nodes.get(root)!.dependencies.includes(root)) {
            members.forEach((id) => cyclic.add(id));
        }
    }

    cyclic.forEach((id) => {
        const node = nodes.get(id)!;
        values.set(id, node.fallback);
        node.problem(
            'Sizing cycle: hug depends on fill. Using authored size on this axis. Choose Fixed to break the cycle.'
        );
    });
    ordered.forEach((id) => {
        if (!cyclic.has(id)) {
            values.set(id, nodes.get(id)!.evaluate());
        }
    });
}

export function projectStackSizes(
    document: Document,
    items: Map<string, SizingItem[]>,
    parents: Map<string, string | undefined>,
    freeStacks: Set<string>
) {
    const frames: Record<string, Size> = {};
    const shapes: Record<string, Size> = {};
    const problems: Record<string, string> = {};
    const nodes = new Map<string, Node>();
    const resolved = new Map<string, number>();
    const rulesFor = (id: string) => (freeStacks.has(id) ? undefined : document.frames[id]?.stack);
    const describe = (id: string, axis: keyof Size, message: string) => {
        const detail = `${axis === 'width' ? 'Width' : 'Height'}: ${message}`;
        problems[id] = problems[id] ? `${problems[id]} ${detail}` : detail;
    };
    const entries: { item: SizingItem; sizing?: Sizing; parent?: string }[] = [];
    Object.values(document.frames).forEach((frame) => {
        entries.push({
            item: { ...frame.size, id: frame.id, kind: 'frame', members: [] },
            sizing: frame.sizing,
            parent: parents.get(frame.id)
        });
    });
    const supported = new Set<string>();
    items.forEach((members) =>
        members.forEach((item) => {
            const shape = document.shapes[item.id];
            if (
                item.kind === 'shape' &&
                shape?.type === 'rectangle' &&
                !shape.rotation &&
                item.members.length === 1 &&
                item.id === item.members[0]
            ) {
                supported.add(shape.id);
                entries.push({ item, sizing: shape.sizing, parent: shape.parentFrameId });
            }
        })
    );
    Object.values(document.shapes).forEach((shape) => {
        if (!shape.sizing || supported.has(shape.id)) {
            return;
        }
        problems[shape.id] =
            'Sizing rules require an unrotated, ungrouped rectangle in a stack. Intrinsic size is retained.';
    });
    const sizingFor = (item: SizingItem, axis: keyof Size): AxisSizing => {
        const definition =
            item.kind === 'frame' ? document.frames[item.id] : document.shapes[item.id];

        return definition?.sizing?.[axis] ?? { mode: 'fixed' };
    };
    const isFill = (item: SizingItem, axis: keyof Size) =>
        (item.kind === 'frame' || supported.has(item.id)) && sizingFor(item, axis).mode === 'fill';
    const value = (item: SizingItem, axis: keyof Size) =>
        resolved.get(key(item, axis)) ?? item[axis];
    const allocations = new Map<string, Map<string, number>>();

    for (const { item, sizing, parent } of entries) {
        for (const axis of AXES) {
            const rule = sizing?.[axis] ?? { mode: 'fixed' };
            const minimum = Math.max(item.kind === 'frame' ? MIN_SIZE : 0, rule.min ?? 0);
            const maximum = Math.max(minimum, rule.max ?? Infinity);
            const clamp = (size: number) => Math.min(maximum, Math.max(minimum, size));
            const problem = (message: string) => describe(item.id, axis, message);
            const node: Node = {
                dependencies: [],
                fallback: clamp(item[axis]),
                evaluate: () => clamp(item[axis]),
                problem
            };
            nodes.set(key(item, axis), node);

            if (rule.max !== undefined && rule.max < minimum) {
                problem(
                    'Maximum is below minimum. Minimum takes precedence; repair the constraints.'
                );
            }
            if (rule.mode === 'fixed') {
                continue;
            }
            const ownRules = item.kind === 'frame' ? rulesFor(item.id) : undefined;
            if (rule.mode === 'hug') {
                if (item.kind === 'shape') {
                    continue;
                }
                if (!ownRules) {
                    problem('Hug requires a row or column stack. Using authored size.');
                    continue;
                }
                const members = items.get(item.id) ?? [];
                node.dependencies = members
                    .filter((member) => member.kind === 'frame' || supported.has(member.id))
                    .map((member) => key(member, axis));
                node.evaluate = () =>
                    clamp(
                        2 * ownRules.padding +
                            (mainAxis(ownRules) === axis
                                ? members.reduce((sum, member) => sum + value(member, axis), 0) +
                                  Math.max(0, members.length - 1) * ownRules.gap
                                : Math.max(0, ...members.map((member) => value(member, axis))))
                    );
                continue;
            }
            const parentRules = parent === undefined ? undefined : rulesFor(parent);
            if (!parentRules || parent === undefined) {
                problem('Fill requires a parent row or column stack. Using authored size.');
                continue;
            }
            const parentItem = { id: parent, kind: 'frame' as const };
            const parentKey = key(parentItem, axis);
            if (mainAxis(parentRules) !== axis) {
                node.dependencies = [parentKey];
                node.evaluate = () => clamp(resolved.get(parentKey)! - 2 * parentRules.padding);
                continue;
            }
            const allocationKey = `allocation:${parent}:${axis}`;
            node.dependencies = [allocationKey];
            node.evaluate = () =>
                allocations.get(allocationKey)?.get(key(item, axis)) ?? node.fallback;
            if (nodes.has(allocationKey)) {
                continue;
            }
            const members = items.get(parent) ?? [];
            const fills = members.filter((member) => isFill(member, axis));
            const fixed = members.filter((member) => !isFill(member, axis));
            nodes.set(allocationKey, {
                dependencies: [
                    parentKey,
                    ...fixed
                        .filter((member) => member.kind === 'frame' || supported.has(member.id))
                        .map((member) => key(member, axis))
                ],
                fallback: 0,
                problem: () => {},
                evaluate: () => {
                    const available =
                        resolved.get(parentKey)! -
                        2 * parentRules.padding -
                        Math.max(0, members.length - 1) * parentRules.gap -
                        fixed.reduce((sum, member) => sum + value(member, axis), 0);
                    const sizes = fillSizes(
                        available,
                        fills.map((member) => {
                            const rule = sizingFor(member, axis);

                            return {
                                ...rule,
                                min: Math.max(member.kind === 'frame' ? MIN_SIZE : 0, rule.min ?? 0)
                            };
                        })
                    );
                    allocations.set(
                        allocationKey,
                        new Map(fills.map((member, index) => [key(member, axis), sizes[index]]))
                    );

                    return 0;
                }
            });
        }
    }

    evaluateNodes(nodes, resolved);
    entries.forEach(({ item }) => {
        const size = {
            width: resolved.get(key(item, 'width'))!,
            height: resolved.get(key(item, 'height'))!
        };
        (item.kind === 'frame' ? frames : shapes)[item.id] = size;
    });

    return { frames, shapes, problems };
}

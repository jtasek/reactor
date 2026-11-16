import type { Machine } from './flowMachine';
import type { Point } from './types';

/** The drawing's fixed measures; `Flow.css` draws cards and rows at exactly these sizes. */
export const FLOW = {
    cardWidth: 264,
    thumbHeight: 170,
    nameHeight: 36,
    rowHeight: 30,
    columnGap: 150,
    rowGap: 56,
    margin: 80,
    /** Room above the cards for links that travel back or over a column. */
    top: 110,
    lane: 9,
    corner: 8
} as const;

export interface FlowCard {
    id: string;
    column: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FlowLayout {
    cards: FlowCard[];
    width: number;
    height: number;
}

export const cardHeight = (rows: number) =>
    FLOW.thumbHeight + FLOW.nameHeight + (rows + 1) * FLOW.rowHeight;

/** Where a transition row's link leaves its card: the middle of the row's trailing edge. */
export const rowAnchor = (card: FlowCard, row: number): Point => ({
    x: card.x + card.width,
    y: card.y + FLOW.thumbHeight + FLOW.nameHeight + row * FLOW.rowHeight + FLOW.rowHeight / 2
});

/**
 * Screens in columns by how many links they are from the start; ones nothing leads to go
 * last. With the `previous` layout, a Screen that keeps its column keeps its place in it, so
 * a new link moves only what it has to; one that arrives goes below those already there.
 */
export function layoutFlow(machine: Machine, previous?: FlowLayout): FlowLayout {
    const byId = new Map(machine.states.map((state) => [state.id, state]));
    /** Steps from the start, through links Preview draws or through every link. */
    const walk = (drawnOnly: boolean) => {
        const distance = new Map<string, number>();
        const parents = new Map<string, string[]>();
        let frontier = machine.initial && byId.has(machine.initial) ? [machine.initial] : [];
        frontier.forEach((id) => distance.set(id, 0));
        while (frontier.length > 0) {
            const next: string[] = [];
            for (const id of frontier) {
                for (const transition of byId.get(id)!.transitions) {
                    const to = transition.effect.kind === 'go' ? transition.effect.to : undefined;
                    if (!to || !byId.has(to) || (drawnOnly && transition.inactive)) {
                        continue;
                    }
                    if (!distance.has(to)) {
                        distance.set(to, distance.get(id)! + 1);
                        next.push(to);
                    }
                    if (distance.get(to) === distance.get(id)! + 1) {
                        parents.set(to, [...(parents.get(to) ?? []), id]);
                    }
                }
            }
            frontier = next;
        }

        return { distance, parents };
    };
    const drawn = walk(true);
    const every = walk(false);
    const parents = drawn.parents;
    // What nothing leads to, as Preview plays it, goes last; the rest by how far it is.
    const steps = (id: string) =>
        byId.get(id)!.reachable ? (drawn.distance.get(id) ?? every.distance.get(id)) : undefined;
    const last = Math.max(-1, ...machine.states.flatMap((state) => steps(state.id) ?? [])) + 1;
    const columns: string[][] = [];
    machine.states.forEach((state) => {
        const column = steps(state.id) ?? last;
        (columns[column] ??= []).push(state.id);
    });
    const before = new Map(previous?.cards.map((card) => [card.id, card]));
    const cards: FlowCard[] = [];
    const placed = new Map<string, number>();
    columns.forEach((ids, column) => {
        const documentOrder = new Map(ids.map((id, index) => [id, index]));
        // Under the middle of the Screens that lead here, so links cross less.
        const pull = (id: string) => {
            const from = (parents.get(id) ?? []).flatMap((parent) => placed.get(parent) ?? []);

            return from.length > 0
                ? from.reduce((sum, value) => sum + value, 0) / from.length
                : Infinity;
        };
        const kept = (id: string) =>
            before.get(id)?.column === column ? before.get(id)!.y : undefined;
        const stay = ids.filter((id) => kept(id) !== undefined);
        const arrive = ids.filter((id) => kept(id) === undefined);
        stay.sort((a, b) => kept(a)! - kept(b)!);
        arrive.sort((a, b) => pull(a) - pull(b) || documentOrder.get(a)! - documentOrder.get(b)!);
        let next = FLOW.top;
        [...stay, ...arrive].forEach((id) => {
            const height = cardHeight(byId.get(id)!.transitions.length);
            // A Screen that stays is pushed down only when one above it grew into it.
            const y = Math.max(next, kept(id) ?? next);
            cards.push({
                id,
                column,
                x: FLOW.margin + column * (FLOW.cardWidth + FLOW.columnGap),
                y,
                width: FLOW.cardWidth,
                height
            });
            placed.set(id, y + height / 2);
            next = y + height + FLOW.rowGap;
        });
    });
    // In the machine's order, so a card's place in the list never depends on its position.
    const order = new Map(machine.states.map((state, index) => [state.id, index]));
    cards.sort((a, b) => order.get(a.id)! - order.get(b.id)!);

    return bounded(cards);
}

const bounded = (cards: FlowCard[]): FlowLayout => ({
    cards,
    width: Math.max(0, ...cards.map((card) => card.x + card.width)) + FLOW.margin,
    height: Math.max(0, ...cards.map((card) => card.y + card.height)) + FLOW.margin
});

/** The layout with each card moved by where someone dragged it to. */
export const offsetLayout = (layout: FlowLayout, offsets: Record<string, Point>): FlowLayout =>
    bounded(
        layout.cards.map((card) => ({
            ...card,
            x: card.x + (offsets[card.id]?.x ?? 0),
            y: card.y + (offsets[card.id]?.y ?? 0)
        }))
    );

export interface FlowLink {
    key: string;
    from: string;
    to: string;
    /** The corners the link turns at, first to last. */
    points: Point[];
    path: string;
}

/** A path through `points` with its corners rounded. */
function rounded(points: Point[]): string {
    const parts = [`M ${points[0].x} ${points[0].y}`];
    for (let index = 1; index < points.length - 1; index++) {
        const [a, b, c] = [points[index - 1], points[index], points[index + 1]];
        const radius = Math.min(
            FLOW.corner,
            Math.hypot(b.x - a.x, b.y - a.y) / 2,
            Math.hypot(c.x - b.x, c.y - b.y) / 2
        );
        const toward = (from: Point, to: Point) => {
            const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;

            return {
                x: from.x + ((to.x - from.x) / length) * radius,
                y: from.y + ((to.y - from.y) / length) * radius
            };
        };
        const start = toward(b, a);
        const end = toward(b, c);
        parts.push(`L ${start.x} ${start.y} Q ${b.x} ${b.y} ${end.x} ${end.y}`);
    }
    const end = points[points.length - 1];
    parts.push(`L ${end.x} ${end.y}`);

    return parts.join(' ');
}

/**
 * Links as right-angled paths that stay in the gaps between columns and above the cards, so
 * none passes under a card of the automatic layout. A link to the next column runs through
 * the gap between them; one further on, or back, climbs over the cards; one within a column
 * uses the gap to its right; one to its own Screen is a small loop.
 */
export function routeLinks(machine: Machine, layout: FlowLayout): FlowLink[] {
    const cards = new Map(layout.cards.map((card) => [card.id, card]));
    const top = Math.min(...layout.cards.map((card) => card.y));
    const arriving = new Map<string, number>();
    const leaving = new Map<number, number>();
    const entering = new Map<number, number>();
    let over = 0;
    const links: FlowLink[] = [];
    const take = <K>(counts: Map<K, number>, key: K) => {
        const count = counts.get(key) ?? 0;
        counts.set(key, count + 1);

        return count;
    };
    for (const state of machine.states) {
        const source = cards.get(state.id);
        if (!source) {
            continue;
        }
        state.transitions.forEach((transition, row) => {
            const target =
                transition.effect.kind === 'go' ? cards.get(transition.effect.to) : undefined;
            if (!target) {
                return;
            }
            const start = rowAnchor(source, row);
            let points: Point[];
            if (target === source) {
                const reach = start.x + 22;
                points = [
                    start,
                    { x: reach, y: start.y },
                    { x: reach, y: start.y - 18 },
                    { x: start.x, y: start.y - 18 }
                ];
            } else {
                // Arrowheads spread down the picture instead of meeting at one point.
                const slot = take(arriving, target.id);
                const y = target.y + 22 + (slot % 9) * 16;
                const out = start.x + 24 + (take(leaving, source.column) % 9) * FLOW.lane;
                if (target.column === source.column + 1 && target.x > out) {
                    points = [start, { x: out, y: start.y }, { x: out, y }, { x: target.x, y }];
                } else if (target.column === source.column) {
                    const edge = target.x + target.width;
                    points = [start, { x: out, y: start.y }, { x: out, y }, { x: edge, y }];
                } else {
                    const into = target.x - 24 - (take(entering, target.column) % 9) * FLOW.lane;
                    const lane = top - 24 - (over++ % 7) * FLOW.lane;
                    points = [
                        start,
                        { x: out, y: start.y },
                        { x: out, y: lane },
                        { x: into, y: lane },
                        { x: into, y },
                        { x: target.x, y }
                    ];
                }
            }
            links.push({
                key: transition.key,
                from: source.id,
                to: target.id,
                points,
                path: rounded(points)
            });
        });
    }

    return links;
}

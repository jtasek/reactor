/**
 * The tool bar's buttons, most used first. A slot with several tools shows one
 * button that keeps the last tool picked from it and opens a menu of the others.
 * Registered tools left out here, such as Circle, which only draws documents' old
 * circles, are not offered.
 */
export const TOOL_BAR_LAYOUT: readonly (readonly string[])[] = [
    ['select', 'move'],
    ['frame'],
    ['rectangle'],
    ['ellipse'],
    ['text'],
    ['image'],
    ['instance'],
    ['line'],
    ['pen']
];

/** `tools` in the bar's slots, as `TOOL_BAR_LAYOUT` places them. */
export function toolBarSlots<T extends { id: string }>(tools: readonly T[]): T[][] {
    const byId = new Map(tools.map((tool) => [tool.id, tool]));

    return TOOL_BAR_LAYOUT.map((ids) => ids.flatMap((id) => byId.get(id) ?? [])).filter(
        (slot) => slot.length > 0
    );
}

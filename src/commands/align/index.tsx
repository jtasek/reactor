import type { Command, Orientation } from 'src/app/types';
import { ALIGN_MINIMUM, AlignTo, SPACE_MINIMUM, Spacing } from 'src/app/alignment';

const alignCommand = (
    id: string,
    name: string,
    to: AlignTo,
    icon: string,
    shortcut: string
): Command => ({
    id,
    name,
    category: 'align',
    inCommandBar: false,
    description: `${name}: line the selected items up on their box`,
    icon: { group: 'editor', name: icon, size: 24 },
    shortcut,
    canExecute: ({ state }) => state.currentDocument.movableSelectedItems.length >= ALIGN_MINIMUM,
    execute: ({ actions }) => actions.alignSelection(to)
});

const spaceCommand = (
    id: string,
    name: string,
    axis: Orientation,
    spacing: Spacing,
    shortcut?: string
): Command => ({
    id,
    name,
    category: 'space',
    inCommandBar: false,
    description:
        spacing === 'between'
            ? `${name}: equal gaps between the selected items, the outermost staying`
            : `${name}: equal distances between the selected items' centers, the outermost staying`,
    icon: { group: 'reactor', name: `space_${spacing}_${axis}`, size: 24 },
    shortcut,
    canExecute: ({ state }) => state.currentDocument.movableSelectedItems.length >= SPACE_MINIMUM,
    execute: ({ actions }) => actions.spaceSelection({ axis, spacing })
});

export const AlignLeftCommand = alignCommand(
    'align-left',
    'Align left',
    'left',
    'format_align_left',
    'shift+a'
);
export const AlignCenterCommand = alignCommand(
    'align-center',
    'Align center',
    'center',
    'format_align_center',
    'shift+c'
);
export const AlignRightCommand = alignCommand(
    'align-right',
    'Align right',
    'right',
    'format_align_right',
    'shift+d'
);
export const AlignTopCommand = alignCommand(
    'align-top',
    'Align top',
    'top',
    'vertical_align_top',
    'shift+w'
);
export const AlignMiddleCommand = alignCommand(
    'align-middle',
    'Align middle',
    'middle',
    'vertical_align_center',
    'shift+m'
);
export const AlignBottomCommand = alignCommand(
    'align-bottom',
    'Align bottom',
    'bottom',
    'vertical_align_bottom',
    'shift+s'
);

export const SpaceBetweenHorizontallyCommand = spaceCommand(
    'space-between-horizontally',
    'Space between horizontally',
    'horizontal',
    'between',
    'shift+x'
);
export const SpaceBetweenVerticallyCommand = spaceCommand(
    'space-between-vertically',
    'Space between vertically',
    'vertical',
    'between',
    'shift+y'
);
export const SpaceEquallyHorizontallyCommand = spaceCommand(
    'space-equally-horizontally',
    'Space equally horizontally',
    'horizontal',
    'centers'
);
export const SpaceEquallyVerticallyCommand = spaceCommand(
    'space-equally-vertically',
    'Space equally vertically',
    'vertical',
    'centers'
);

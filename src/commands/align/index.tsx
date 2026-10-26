import {
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical,
    AlignStartHorizontal,
    AlignCenterHorizontal,
    AlignEndHorizontal,
    AlignHorizontalSpaceBetween,
    AlignVerticalSpaceBetween,
    AlignHorizontalDistributeCenter,
    AlignVerticalDistributeCenter
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Command, Orientation } from 'src/app/types';
import { ALIGN_MINIMUM, AlignTo, SPACE_MINIMUM, Spacing } from 'src/app/alignment';

const alignCommand = (
    id: string,
    name: string,
    to: AlignTo,
    icon: LucideIcon,
    shortcut: string
): Command => ({
    id,
    name,
    category: 'align',
    places: ['inspector'],
    description: `${name}: line the selected items up on their box`,
    icon: { component: icon, size: 24 },
    shortcut,
    canExecute: ({ state }) => state.alignmentItems.length >= ALIGN_MINIMUM,
    execute: ({ actions }) => actions.alignSelection(to)
});

const spaceCommand = (
    id: string,
    name: string,
    axis: Orientation,
    spacing: Spacing,
    icon: LucideIcon,
    shortcut?: string
): Command => ({
    id,
    name,
    category: 'space',
    places: ['inspector'],
    description:
        spacing === 'between'
            ? `${name}: equal gaps between the selected items, the outermost staying`
            : `${name}: equal distances between the selected items' centers, the outermost staying`,
    icon: { component: icon, size: 24 },
    shortcut,
    canExecute: ({ state }) => state.alignmentItems.length >= SPACE_MINIMUM,
    execute: ({ actions }) => actions.spaceSelection({ axis, spacing })
});

export const AlignLeftCommand = alignCommand(
    'align-left',
    'Align left',
    'left',
    AlignStartVertical,
    'shift+a'
);
export const AlignCenterCommand = alignCommand(
    'align-center',
    'Align center',
    'center',
    AlignCenterVertical,
    'shift+c'
);
export const AlignRightCommand = alignCommand(
    'align-right',
    'Align right',
    'right',
    AlignEndVertical,
    'shift+d'
);
export const AlignTopCommand = alignCommand(
    'align-top',
    'Align top',
    'top',
    AlignStartHorizontal,
    'shift+w'
);
export const AlignMiddleCommand = alignCommand(
    'align-middle',
    'Align middle',
    'middle',
    AlignCenterHorizontal,
    'shift+m'
);
export const AlignBottomCommand = alignCommand(
    'align-bottom',
    'Align bottom',
    'bottom',
    AlignEndHorizontal,
    'shift+s'
);

export const SpaceBetweenHorizontallyCommand = spaceCommand(
    'space-between-horizontally',
    'Space between horizontally',
    'horizontal',
    'between',
    AlignHorizontalSpaceBetween,
    'shift+x'
);
export const SpaceBetweenVerticallyCommand = spaceCommand(
    'space-between-vertically',
    'Space between vertically',
    'vertical',
    'between',
    AlignVerticalSpaceBetween,
    'shift+y'
);
export const SpaceEquallyHorizontallyCommand = spaceCommand(
    'space-equally-horizontally',
    'Space equally horizontally',
    'horizontal',
    'centers',
    AlignHorizontalDistributeCenter
);
export const SpaceEquallyVerticallyCommand = spaceCommand(
    'space-equally-vertically',
    'Space equally vertically',
    'vertical',
    'centers',
    AlignVerticalDistributeCenter
);

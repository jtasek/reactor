import { Box, Corner, Point, ResizeHandlerType, Shape, Size } from '../app/types';
import type { GroupFrame } from '../app/membership';
import type { Gap, SnapLines } from '../app/snapping';

/** Selection flags captured when a gesture starts, restored if it is canceled. */
export type SelectionSnapshot = Record<string, boolean>;

/**
 * Copies of the shapes a gesture edits live, restored if it is canceled. Other
 * copies' changes update them, so canceling undoes only the gesture's own changes.
 */
export type ShapesSnapshot = Record<string, Shape>;

/**
 * The pointer that owns a gesture. Input from any other pointer is ignored until
 * the gesture ends. `moved` records whether the owner has moved since it started.
 */
type Owner = { pointerId: number; touch: boolean; moved: boolean };

/**
 * The gesture in progress. A two-finger pinch is driven by touch contacts and has
 * no owning pointer; it lasts until every contact has lifted.
 */
export type Gesture =
    | { kind: 'idle' }
    | {
          kind: 'pinching';
          touchIds: [number, number];
          /** Finger distance and camera scale when the pinch started. */
          distance: number;
          scale: number;
          /** World point kept under the fingers' midpoint. */
          anchor: Point;
      }
    | (Owner &
          (
              | { kind: 'drawing' }
              | {
                    kind: 'marquee';
                    selection: SelectionSnapshot;
                    /** Whether the pointer has gone beyond a slip, so a release draws no click. */
                    dragged: boolean;
                }
              | {
                    kind: 'moving';
                    selection: SelectionSnapshot;
                    shapes: ShapesSnapshot;
                    /** Whether the pointer has gone beyond a slip, so the shapes follow it. */
                    dragged: boolean;
                    /** The moved shapes' box when the drag began, which snaps; none before it. */
                    box: Box | null;
                    /** The shapes the drag moves: selected, shown and unlocked when it began. */
                    movingIds: string[];
                    /** How far the shapes have been moved so far. */
                    movedBy: Point;
                    /** The lines the box snapped to, shown while the drag lasts. */
                    snapLines: SnapLines;
                    /** The gaps in its row equal to the one it snapped to keep. */
                    equalGaps: Gap[];
                }
              | {
                    kind: 'resizing';
                    shapeId: string;
                    handle: ResizeHandlerType;
                    shapes: ShapesSnapshot;
                    /** The lines the handle's edges snapped to, shown while the resize lasts. */
                    snapLines: SnapLines;
                }
              | { kind: 'rotating'; shapeId: string; shapes: ShapesSnapshot }
              | { kind: 'rounding'; shapeId: string; corner: Corner; shapes: ShapesSnapshot }
              | {
                    kind: 'resizingGroup';
                    groupId: string;
                    handle: ResizeHandlerType;
                    shapes: ShapesSnapshot;
                    /** The group's box and rotation when the drag began. */
                    frame: GroupFrame;
                    snapLines: SnapLines;
                }
              | {
                    kind: 'rotatingGroup';
                    groupId: string;
                    shapes: ShapesSnapshot;
                    frame: GroupFrame;
                }
          ));

/** A touch contact in surface-local SVG units. */
export type TouchContact = { id: number; point: Point };

/** What a handle resizes or rotates: a shape, or a group as one. */
export type HandleOwner = { shapeId: string } | { groupId: string };

/** A resize, rotate or radius handle under the pointer when a gesture starts. */
export type HandleTarget =
    | ({ type: ResizeHandlerType | 'rotate' } & HandleOwner)
    | { type: 'radius'; shapeId: string; corner: Corner };

export interface Pointer {
    background: boolean;
    bottomRight: Point;
    center: Point;
    current: Point;
    dragging: boolean;
    /** Whether the pointer is over the canvas, where `current` follows it. */
    inside: boolean;
    /**
     * Where a document's canvas was last pressed, which is where a paste into it
     * goes while that place is in view; null until the canvas is pressed.
     */
    lastPress: { documentId: string; position: Point } | null;
    gesture: Gesture;
    offset: Point;
    path: Point[];
    radius: number;
    size: Size;
    start: Point;
    topLeft: Point;
}

export interface Keyboard {
    altKey: boolean;
    ctrlKey: boolean;
    key: string;
    metaKey: boolean;
    shiftKey: boolean;
    text: string;
    typing: boolean;
}

export interface Events {
    keyboard: Keyboard;
    pointer: Pointer;
}

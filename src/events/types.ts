import { Point, ResizeHandlerType, Shape, Size } from '../app/types';

/** Selection flags captured when a gesture starts, restored if it is canceled. */
export type SelectionSnapshot = Record<string, boolean>;

/** Copies of the shapes a gesture edits live, restored if it is canceled. */
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
              | { kind: 'marquee'; selection: SelectionSnapshot }
              | { kind: 'moving'; selection: SelectionSnapshot; shapes: ShapesSnapshot }
              | {
                    kind: 'resizing';
                    shapeId: string;
                    handle: ResizeHandlerType;
                    shapes: ShapesSnapshot;
                }
              | { kind: 'rotating'; shapeId: string; shapes: ShapesSnapshot }
          ));

/** A touch contact in surface-local SVG units. */
export type TouchContact = { id: number; point: Point };

/** A resize or rotate handle under the pointer when a gesture starts. */
export type HandleTarget = { shapeId: string; type: ResizeHandlerType | 'rotate' };

export interface Pointer {
    background: boolean;
    bottomRight: Point;
    center: Point;
    current: Point;
    dragging: boolean;
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

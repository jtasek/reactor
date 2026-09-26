import { Context } from './index';

export enum Alignment {
    Bottom = 'bottom',
    Left = 'left',
    Right = 'right',
    Top = 'top'
}

export enum Orientation {
    Horizontal = 'horizontal',
    Vertical = 'vertical'
}

export enum Spacing {
    SameHorizontal = 'sameHorizontal',
    SameVertical = 'sameVertical'
}

export enum Sizing {
    SameHeight = 'sameHeight',
    SameSize = 'sameSize',
    SameWidth = 'sameWidth'
}

export enum LinkType {
    Aggregate = 'aggregate',
    Compose = 'compose',
    Inherit = 'inherit',
    Refer = 'refer'
}

export enum MouseButton {
    Left = 0,
    Middle = 1,
    Right = 2
}

export type Point = {
    x: number;
    y: number;
};

export type Vector = {
    x: number;
    y: number;
};

export type Box = {
    bottomRight: Point;
    height: number;
    topLeft: Point;
    width: number;
};

export enum Side {
    'left',
    'right',
    'bottom',
    'top'
}

export const bottomLeft = Side.right + Side.left;

export type ResizeHandlerType =
    | 'bottomLeft'
    | 'bottomRight'
    | 'middleBottom'
    | 'middleLeft'
    | 'middleRight'
    | 'middleTop'
    | 'topLeft'
    | 'topRight';

export type Size = {
    height: number;
    width: number;
};

export interface HashTable<T> {
    [key: string]: T;
}

export interface Ruler {
    id: string;
    locked: boolean;
    name: string;
    orientation: Orientation;
    position: Point;
    selected: boolean;
    visible: boolean;
}

export interface Grid {
    width: number;
    visible: boolean;
    factor: number;
    height: number;
}

/** Fields every shape carries, whatever its geometry. */
export interface ShapeBase {
    active: boolean;
    bounds?: Box;
    children?: Shape[];
    created: Date;
    createdBy: string;
    description?: string;
    id: string;
    key: string;
    locked: boolean;
    modified: Date;
    modifiedBy: string;
    name: string;
    order: string;
    parentShapeId?: string;
    rotation?: number;
    selected: boolean;
    visible: boolean;
}

export interface Rectangle extends ShapeBase {
    type: 'rectangle';
    position: Point;
    size: Size;
}

export interface Image extends ShapeBase {
    type: 'image';
    position: Point;
    size: Size;
    source: string;
}

/** `position` is the center. */
export interface Circle extends ShapeBase {
    type: 'circle';
    position: Point;
    radius: number;
}

/** `position` is the center. */
export interface Ellipse extends ShapeBase {
    type: 'ellipse';
    position: Point;
    radius: Point;
}

export interface Line extends ShapeBase {
    type: 'line';
    start: Point;
    end: Point;
}

export interface Pen extends ShapeBase {
    type: 'pen';
    points: Point[];
}

/** `position` is the left end of the text baseline. */
export interface Text extends ShapeBase {
    type: 'text';
    position: Point;
    value: string;
    fontSize?: number;
}

export type Shape = Rectangle | Image | Circle | Ellipse | Line | Pen | Text;

export type ShapeType = Shape['type'];

type ShapeMetadata = Exclude<
    keyof ShapeBase,
    'bounds' | 'children' | 'description' | 'parentShapeId' | 'rotation'
>;

/**
 * What a caller supplies to create a shape: its type and geometry, plus any
 * metadata to override. The factory fills in the remaining metadata.
 */
export type ShapeInput = Shape extends infer S
    ? S extends Shape
        ? Omit<S, ShapeMetadata> & Partial<Pick<S, ShapeMetadata>>
        : never
    : never;

export interface Link {
    id: string;
    locked: boolean;
    name: string;
    selected: boolean;
    source?: string;
    target?: string;
    type: string;
    visible: boolean;
}

export interface Group {
    id: string;
    locked: boolean;
    name: string;
    selected: boolean;
    shapesIds: string[];
    visible: boolean;
}

export interface Layer {
    id: string;
    locked: boolean;
    name: string;
    selected: boolean;
    shapesIds: string[];
    visible: boolean;
}

export interface Component {
    id: string;
    parentId?: string;
    locked: boolean;
    name: string;
    selected: boolean;
    shapesIds: string[];
    visible: boolean;
}

export interface Camera {
    position: Point;
    scale: number;
}

export interface Document {
    id: string;
    author: string;
    camera: Camera;
    created: Date;
    createdBy: string;
    description?: string;
    filter: string;
    grid: Grid;
    componentsIds: string[];
    components: HashTable<Component>;
    groupsIds: string[];
    selectedGroupsIds: string[];
    groups: HashTable<Group>;
    //history: Action[];
    selectedLayersIds: string[];
    layers: HashTable<Layer>;
    layersIds: string[];
    links: HashTable<Link>;
    linksIds: string[];
    locked: boolean;
    modified: Date;
    modifiedBy: string;
    name: string;
    rulers: HashTable<Ruler>;
    rulersIds: string[];
    selected: boolean;
    selectedShapes: Shape[];
    selectedShapesIds: string[];
    shapes: HashTable<Shape>;
    shapesIds: string[];
    tags: string[];
}

export interface Icon {
    color?: string;
    group: string;
    name: string;
    size: number;
}

export type Action = (context: Context) => void;
export type ActionGuard = (context: Context) => boolean;
export type ActionWithParam<T> = (context: Context, param: T) => void;

/**
 * Whether a command can run now. It may only read state, so the UI can evaluate
 * it while rendering and stay in sync as the state changes.
 */
export type CommandGuard = (context: Pick<Context, 'state'>) => boolean;

export interface Command {
    id: string;
    category: string;
    description?: string;
    icon?: Icon;
    name: string;
    regex: RegExp;
    shortcut?: string;
    canExecute: CommandGuard;
    execute: Action;
    shouldDeactivate?: ActionGuard;
}

export interface User {
    id: string;
    avatar?: string;
    email?: string;
    isAuthenticated: boolean;
    lastLoggedIn: Date;
    loggedIn: Date;
    name?: string;
}

export interface Event {
    action: string;
    category: string;
    data: unknown;
    occurred: Date;
    user: string;
}

export type Device = Shape;

export interface Provider {
    id: string;
    name: string;
    description?: string;
    data?: unknown;
}

export interface OnlineProvider extends Provider {
    url: string;
}

export type NotificationType = 'info' | 'warn' | 'error';

export interface Notification {
    id: string;
    created: Date;
    scope?: string;
    message: string;
    type: NotificationType;
}

export type Configuration = {
    autoSave: boolean;
    debugMode: boolean;
    version: string;
};

export type Application = {
    id: string;
    commands: HashTable<Command>;
    commandsIds: string[];
    config: Configuration;
    currentDocumentId: string;
    currentDocument: Document;
    currentPage: string;
    devices: HashTable<Device>;
    documents: HashTable<Document>;
    documentsIds: string[];
    notifications: Notification[];
    providers: HashTable<Provider>;
    started: Date;
    user: User;
};

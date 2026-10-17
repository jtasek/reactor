import { Context } from './index';
import type { GroupFrame } from './membership';
import type { LucideIcon } from 'lucide-react';

export type Orientation = 'horizontal' | 'vertical';

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

export type Side = 'left' | 'right' | 'top' | 'bottom';

export type ResizeHandlerType =
    | 'bottomLeft'
    | 'bottomRight'
    | 'middleBottom'
    | 'middleLeft'
    | 'middleRight'
    | 'middleTop'
    | 'topLeft'
    | 'topRight';

/** A corner of a box. */
export type Corner = Extract<
    ResizeHandlerType,
    'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft'
>;

export type Size = {
    height: number;
    width: number;
};

export interface HashTable<T> {
    [key: string]: T;
}

export interface Guide {
    id: string;
    locked: boolean;
    name: string;
    orientation: Orientation;
    position: Point;
    selected: boolean;
    visible: boolean;
}

/** What a variable holds; a property may use a variable of its own kind. */
export type VariableType = 'color' | 'number' | 'text' | 'boolean';

type VariableOf<T extends VariableType, V> = {
    id: string;
    name: string;
    type: T;
    /** By mode; only `default` exists yet. */
    values: { default: V };
};

/** A named value kept in a document, written into the shape properties bound to it. */
export type Variable =
    | VariableOf<'color', string>
    | VariableOf<'number', number>
    | VariableOf<'text', string>
    | VariableOf<'boolean', boolean>;

export interface Grid {
    width: number;
    visible: boolean;
    factor: number;
    height: number;
}

/** Fields every shape carries, whatever its geometry. */
export interface ShapeBase {
    active: boolean;
    /** The variable each property follows, by property key, while it holds its value. */
    bindings?: Record<string, string>;
    bounds?: Box;
    children?: Shape[];
    created: Date;
    createdBy: string;
    description?: string;
    /** The color it is filled with, as `#rrggbb`; unfilled when unset. */
    fill?: string;
    /** A text's color for its letters, as `#rrggbb`; the default when unset. */
    fontColor?: string;
    id: string;
    key: string;
    locked: boolean;
    modified: Date;
    modifiedBy: string;
    name: string;
    /** How opaque it is drawn, from 0, clear, to 1, the default. */
    opacity?: number;
    order: string;
    parentShapeId?: string;
    rotation?: number;
    selected: boolean;
    /** The color its outline is drawn in, as `#rrggbb`; the default outline when unset. */
    stroke?: string;
    visible: boolean;
}

export interface Rectangle extends ShapeBase {
    type: 'rectangle';
    position: Point;
    size: Size;
    /** How round its corners are; drawn at most half its shorter side. */
    cornerRadius?: number;
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
    /** What `value` is made from while it holds the text it makes: see `resolveTemplate`. */
    template?: string;
    value: string;
    fontSize?: number;
}

/** A live reference to a component's source shapes. */
export interface InstanceShape extends ShapeBase {
    type: 'instance';
    componentId: string;
    position: Point;
    overrides: Record<string, PropertyValue | { variableId: string }>;
}

export type PropertyValue = string | number | boolean;

export interface ComponentProp {
    id: string;
    label: string;
    shapeId: string;
    key: string;
}

export type Shape = Rectangle | Image | Circle | Ellipse | Line | Pen | Text | InstanceShape;

type ShapeMetadata = Exclude<
    keyof ShapeBase,
    'bounds' | 'children' | 'description' | 'order' | 'parentShapeId' | 'rotation'
>;

/**
 * What a caller supplies to create a shape: its type and geometry, plus any
 * metadata to override. The factory fills in the remaining metadata, and the
 * store assigns the draw order.
 */
export type ShapeInput = Shape extends infer S
    ? S extends Shape
        ? Omit<S, ShapeMetadata | 'order'> & Partial<Pick<S, ShapeMetadata>>
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
    /** Degrees the group's box is turned by; its shapes carry their own rotations. */
    rotation?: number;
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
    /** Rotation of the source's selection frame; its shapes carry their own geometry. */
    rotation?: number;
    /** Source members live only in the definition; the canvas shows instances. */
    sourceOnly?: boolean;
    parentId?: string;
    locked: boolean;
    name: string;
    selected: boolean;
    shapesIds: string[];
    props?: ComponentProp[];
    /** Imported library source shapes live here rather than on the canvas. */
    sourceShapes?: HashTable<Shape>;
    library?: { documentId: string; hash: string };
    visible: boolean;
}

/** Whether this copy has changes of a document to undo or redo. */
export interface UndoHistory {
    canUndo: boolean;
    canRedo: boolean;
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
    /** When the document was moved to Recently Deleted, which deletes it for good 30 days later. */
    deleted?: Date;
    description?: string;
    filter: string;
    grid: Grid;
    componentsIds: string[];
    components: HashTable<Component>;
    sourceOnlyShapesIds: ReadonlySet<string>;
    selectedComponentsIds: string[];
    componentFrames: Record<string, GroupFrame | undefined>;
    /** The shapes of the document's own components. */
    componentMembersIds: ReadonlySet<string>;
    /** Runtime source editing context; other scene shapes are hidden while it is open. */
    editingComponentId: string | null;
    groupsIds: string[];
    selectedGroupsIds: string[];
    groupFrames: Record<string, GroupFrame | undefined>;
    groups: HashTable<Group>;
    selectedLayersIds: string[];
    layers: HashTable<Layer>;
    layersIds: string[];
    links: HashTable<Link>;
    linksIds: string[];
    locked: boolean;
    modified: Date;
    modifiedBy: string;
    name: string;
    guides: HashTable<Guide>;
    guidesIds: string[];
    /** Runtime: what this copy can undo and redo of the document. */
    history: UndoHistory;
    selected: boolean;
    selectedShapes: Shape[];
    selectedShapesIds: string[];
    selectionExtent: Box | null;
    movableSelectedItems: string[][];
    editableSelectedShapesIds: string[];
    shapes: HashTable<Shape>;
    shapesIds: string[];
    /** The one layer this screen shows, with the shapes on no layer; all layers when unset. */
    shownLayerId?: string;
    /** Runtime selection of the built-in layer for shapes on no named layer. */
    surfaceSelected?: boolean;
    tags: string[];
    /**
     * The tone picked for a tag, by its `tagKey`; a tag without one, or with a value that
     * is not a tone, takes its name's.
     */
    tagTones: Record<string, string>;
    variables: HashTable<Variable>;
    /** Sorted by name, then id. */
    variablesIds: string[];
}

/** Runtime metadata kept in the plain command/tool registries, never document or store state. */
export interface Icon {
    component: LucideIcon;
    color?: string;
    fill?: string;
    size: number;
}

export type Action = (context: Context) => void;
export type ActionGuard = (context: Context) => boolean;
export type ActionWithParam<T> = (context: Context, param: T) => void;
/** An action that answers its caller, as copying answers with the clipboard text. */
export type ActionWithResult<R> = (context: Context) => R;
export type ActionWithParamAndResult<T, R> = (context: Context, param: T) => R;

/**
 * Whether a command can run now. It may only read state, so the UI can evaluate
 * it while rendering and stay in sync as the state changes.
 */
export type CommandGuard = (context: Pick<Context, 'state'>) => boolean;

/** Where a command is offered as a button. */
export type CommandPlace = 'commandBar' | 'inspector';

/** What a command acts on: one shape, a group selected as one, a layer, or several items. */
export type CommandScope = 'shape' | 'group' | 'layer' | 'selection' | 'layers' | 'components';

export interface Command {
    id: string;
    category: string;
    description?: string;
    icon?: Icon;
    name: string;
    regex?: RegExp;
    shortcut?: string;
    /**
     * The browser clipboard event that runs the command when its shortcut is
     * pressed, so it gets the event's data without asking to read the clipboard.
     */
    clipboardEvent?: 'copy' | 'cut' | 'paste';
    /** Where the command is offered as a button; in the command bar unless named. */
    places?: CommandPlace[];
    /** The items whose menus offer the command. */
    scopes?: CommandScope[];
    /** Its place in those menus, lowest first. */
    menuOrder?: number;
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

/** What a notification tells: each kind is shown in a color of its own. */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
    id: string;
    created: Date;
    scope?: string;
    message: string;
    type: NotificationType;
    /** A link that does what the notification suggests. */
    link?: { label: string; url: string };
}

/**
 * Whether someone is signed in: `loading` until the server is asked, and
 * `unavailable` when it has no accounts.
 */
export type Account =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'signedOut' }
    | { kind: 'signedIn'; id: string; name: string; email: string };

/** Whether the server offers AI to the person signed in; never signed out or without a provider. */
export type AiAvailability = 'available' | 'unavailable';

/** Whether this copy's documents are saved, and signed in synced; `reason` says why they are not saved. */
export type SaveStatus =
    | { kind: 'saved' }
    | { kind: 'saving' }
    | { kind: 'syncing' }
    | { kind: 'offline' }
    | { kind: 'notSaving'; reason: string };

export type Configuration = {
    /**
     * How far an arrow key moves the selection, in canvas units, or pans the canvas
     * without one, in screen pixels.
     */
    arrowKeyStep: number;
    autoSave: boolean;
    debugMode: boolean;
    /** How the Documents page shows documents, kept per device. */
    documentsLayout: DocumentsLayout;
    panelLayout: Record<string, PanelPlacement>;
    version: string;
};

export type DocumentsLayout = 'cards' | 'list';

export type PanelPlacement = {
    dock:
        | 'top-left'
        | 'left'
        | 'bottom-left'
        | 'top-right'
        | 'right'
        | 'bottom-right'
        | 'top'
        | 'bottom'
        | null;
    position: Point;
    /** The size its corners were dragged to: the default width without `width`, its content's height without `height`. */
    size?: { width?: number; height?: number };
    /** Its place among the panels docked with it, the lowest first. */
    order?: number;
};

export type Application = {
    id: string;
    account: Account;
    ai: AiAvailability;
    commands: HashTable<Command>;
    commandsIds: string[];
    config: Configuration;
    currentDocumentId: string;
    currentDocument: Document;
    /** The source or child being inspected, on this screen only. */
    selectedComponent?: { documentId: string; componentId: string; shapeId?: string } | null;
    currentPage: string;
    /** The group double-clicked into, whose shapes are selected one by one. */
    enteredGroupId: string | null;
    enteredComponentId: string | null;
    /** Canvas context to restore after editing a component, on this screen only. */
    componentEditingReturn?: {
        documentId: string;
        shapeIds: string[];
        camera: Camera;
    } | null;
    resetDocumentId: string | null;
    /** The document a person is asking AI to change, while its chat is open. */
    aiEditDocumentId: string | null;
    devices: HashTable<Device>;
    documents: HashTable<Document>;
    documentsIds: string[];
    /** Saved documents are still loading, so the pages wait. */
    loading: boolean;
    notifications: Notification[];
    providers: HashTable<Provider>;
    saveStatus: SaveStatus;
    started: Date;
    user: User;
};

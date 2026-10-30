import type { FrameLayout } from './frameLayout';
import type { FrameState } from './frameState';
import type { DocumentAccess } from './documentAccess';
import { Context } from './index';
import type { GroupFrame } from './membership';
import type { LucideIcon } from 'lucide-react';
import type { ScreenViewAddress } from '../events/types';

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

export interface AxisSizing {
    mode: 'fixed' | 'hug' | 'fill';
    min?: number;
    max?: number;
}

/** Authored rules; calculated sizes stay in the local layout projection. */
export type Sizing = Partial<Record<keyof Size, AxisSizing>>;

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

/** Local artwork color context; never changes document geometry. */
export type VariableContext = Readonly<Record<string, string>>;

export interface PackageIdentity {
    packageId: string;
    tokenId: string;
}

export interface VariableDimension {
    source?: PackageIdentity;
    id: string;
    name: string;
    order: number;
    defaultModeId: string;
    /** Absent means manual selection; thresholds are opt-in and independent per dimension. */
    selection?: 'width';
    modes: Record<string, { id: string; name: string; order: number; minWidth?: number }>;
}

/** What a variable holds; a property may use a variable of its own kind. */
export type VariableType = 'color' | 'number' | 'text' | 'boolean';

type VariableOf<T extends VariableType, V> = {
    source?: PackageIdentity;
    id: string;
    name: string;
    type: T;
    /** Base value; colors and numbers may also supply overrides keyed by mode ID. */
    values: { default: V };
    /** Same-type source by ID; default is retained as the fallback while following it. */
    alias?: string;
};

/** A named value kept in a document, written into the shape properties bound to it. */
export type Variable =
    | (VariableOf<'color', string> & {
          dimensionId?: string;
          values: { default: string; [modeId: string]: string };
      })
    | (VariableOf<'number', number> & {
          dimensionId?: string;
          values: { default: number; [modeId: string]: number };
      })
    | (VariableOf<'text', string> & {
          dimensionId?: string;
          values: { default: string; [modeId: string]: string };
      })
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
    /** Explicit membership; geometry stays in canvas coordinates. */
    parentFrameId?: string;
    layoutOrder?: number;
    sizing?: Sizing;
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
    /** Optional wrapping limit in canvas units; zero/absent keeps single-line behavior. */
    wrapWidth?: number;
    /** Local measured lines, never serialized or shared. */
    textLayout?: { lines: string[]; lineHeight: number };
}

/** A live reference to a component's source shapes. */
export interface InstanceShape extends ShapeBase {
    /** Explicit alternate source within the component family. */
    variantId?: string;
    /** Opt-in automatic selection; absent preserves the explicit/default source. */
    variantMode?: 'auto';
    /** Local resolved source for this instance path, never serialized or shared. */
    layoutSize?: Size;
    projectedSource?: import('./componentSource').ComponentSource;
    /** Authored mode IDs by dimension; an absent entry inherits. */
    modeOverrides?: VariableContext;
    /** Absent inherits the source; none explicitly removes its semantic role. */
    interaction?: RoleSettings;
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

export type ComponentRole = 'text' | 'input' | 'button' | 'list' | 'image';

/** Semantic property names refer to existing exposed property IDs, never copied values. */
export interface RoleSettings {
    role: ComponentRole | 'none';
    props: Record<string, string>;
    /** Optional button navigation to a top-level frame. Missing targets remain repairable. */
    navigateTo?: string;
    /** Explicit input identity shared by compatible instances across screen layouts. */
    controlId?: string;
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
    /** Alternate components selectable by instances of this component. */
    variantIds?: string[];
    responsiveVariants?: {
        source: 'screen' | 'parent';
        rules: { minWidth: number; variantId: string }[];
    };
    interaction?: RoleSettings;
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

/** A free-positioned screen boundary; its parent and children keep canvas coordinates. */
export interface StackRules {
    direction: 'row' | 'column';
    gap: number;
    padding: number;
    align: 'start' | 'center' | 'end';
}

export interface Frame {
    /** Numeric variable IDs for fixed dimensions and stack spacing. */
    bindings?: Record<string, string>;
    /** Authored mode IDs by dimension; an absent entry inherits. */
    modeOverrides?: VariableContext;
    kind?: 'frame' | 'screen' | 'view';
    /** Screens are source definitions; every canvas placement is a separate view. */
    definitionOnly?: true;
    /** A separate artwork tree owned by its parent screen, never a destination. */
    screenLayout?: true;
    /** Optional screen rules; a screen ID selects its default artwork. */
    responsiveLayouts?: { minWidth: number; layoutId: string }[];
    /** Explicit layout inspection choice on a Screen view; absent uses the default. */
    layoutId?: string;
    layoutMode?: 'auto';
    /** A placed view references its screen definition; its box is view-local. */
    screenId?: string;
    stack?: StackRules;
    id: string;
    parentFrameId?: string;
    layoutOrder?: number;
    sizing?: Sizing;
    name: string;
    position: Point;
    size: Size;
    locked: boolean;
    visible: boolean;
}

export interface Document {
    frames: HashTable<Frame>;
    framesIds: string[];
    /** Local projection; never saved or shared. */
    frameStates: Record<string, FrameState>;
    frameLayout: FrameLayout;
    /** Local: whether modes or wrapping need contextual geometry on the Canvas. */
    contextualGeometry: boolean;
    /** Local selection; never saved or shared. */
    selectedFrameId?: string;
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
    dimensions: HashTable<VariableDimension>;
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
    | { kind: 'signedIn'; id: string; name: string; email: string; image?: string | null };

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
    /** Which Explorer view shows, kept per device. */
    explorerView: ExplorerView;
    panelLayout: Record<string, PanelPlacement>;
    version: string;
};

export type DocumentsLayout = 'cards' | 'list';

export type ExplorerView = 'objects' | 'layers';

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
    documentAccess: Record<string, DocumentAccess>;
    ai: AiAvailability;
    commands: HashTable<Command>;
    commandsIds: string[];
    config: Configuration;
    previewModes: Record<string, Record<string, string>>;
    currentDocumentId: string;
    currentDocument: Document;
    /** Local alignment geometry, resolved once for the active canvas or Screen view. */
    alignmentItems: { shapeIds: string[]; box: Box }[];
    /** The source or child being inspected, on this screen only. */
    selectedComponent?: { documentId: string; componentId: string; shapeId?: string } | null;
    currentPage: string;
    /** The group double-clicked into, whose shapes are selected one by one. */
    enteredGroupId: string | null;
    enteredComponentId: string | null;
    /** The text shape double-clicked to change its words on the canvas. */
    editingText?: { documentId: string; shapeId: string } | null;
    /** Canvas context to restore after editing a component, on this screen only. */
    componentEditingReturn?: {
        documentId: string;
        shapeIds: string[];
        camera: Camera;
        screenView?: ScreenViewAddress | null;
        selectedComponentId?: string;
        componentOrigin?: { componentId: string; instanceId: string; position: Point; size: Size };
    } | null;
    resetDocumentId: string | null;
    /** The document a person is asking AI to change, while its chat is open. */
    aiEditDocumentId: string | null;
    previewDocumentId: string | null;
    /** Modes captured when Preview opens, independent of later canvas simulation changes. */
    previewModeContext: {
        modes: VariableContext;
        screenId?: string;
        viewport?: Size;
        layoutId?: string;
        layoutMode?: 'auto';
    } | null;
    devices: HashTable<Device>;
    documents: HashTable<Document>;
    documentsIds: string[];
    /** Saved documents are still loading, so the pages wait. */
    loading: boolean;
    /** Local readiness invalidates geometry computed before the editor loaded. */
    editorReady: boolean;
    notifications: Notification[];
    providers: HashTable<Provider>;
    saveStatus: SaveStatus;
    started: Date;
    user: User;
};

import { currentDocument } from './computed/currentDocument';
import { documentsIds } from './computed/documents';
import {
    commandsIds,
    componentsIds,
    selectedGroupsIds,
    groupFrames,
    groupsIds,
    selectedLayersIds,
    layersIds,
    linksIds,
    guidesIds,
    selectedShapes,
    selectedShapesIds,
    selectionExtent,
    movableSelectedItems,
    editableSelectedShapesIds,
    variablesIds
} from './computed/shapes';
import { inDrawingOrder } from './drawOrder';
import { v4 as newId } from 'uuid';
import { Sequence } from './sequence';
import { DEFAULT_PANEL_LAYOUT, readPanelLayout } from './panelLayout';

import {
    Application,
    Camera,
    Component,
    Document,
    Grid,
    Group,
    Layer,
    Link,
    Notification,
    Guide,
    Shape,
    ShapeInput,
    User
} from './types';

export const DEFAULT_ARROW_KEY_STEP = 10;

const componentSequence = new Sequence();
const documentSequence = new Sequence();
const groupSequence = new Sequence();
const layerSequence = new Sequence();
const linkSequence = new Sequence();
const guideSequence = new Sequence();

export const newApplicationName = (): string => `reactor-${Date.now()}`;
export const newComponentName = (): string => `component-${componentSequence.next()}`;
export const newDocumentName = (number = documentSequence.next()): string => `document-${number}`;
export const newGroupName = (): string => `group-${groupSequence.next()}`;
export const newLayerName = (): string => `layer-${layerSequence.next()}`;
export const newLinkName = (): string => `link-${linkSequence.next()}`;
export const newGuideName = (): string => `guide-${guideSequence.next()}`;

/** A name in a type's sequence, such as `rectangle-3`. */
const SEQUENCE_NAME = /^([a-z]+)-(\d+)$/;

/**
 * Names shapes in a document's sequences, one per type: each call gives the next
 * `type-N`, one past the highest number among `shapes`' names of that type and the
 * names it gave before, so a sequence goes on across reloads and copies.
 */
export function shapeNamer(shapes: Iterable<Shape>): (type: Shape['type']) => string {
    const highest = new Map<string, number>();

    for (const shape of shapes) {
        const [, type, number] = SEQUENCE_NAME.exec(shape.name) ?? [];

        if (type !== undefined) {
            highest.set(type, Math.max(highest.get(type) ?? 0, Number(number)));
        }
    }

    return (type) => {
        const next = (highest.get(type) ?? 0) + 1;

        highest.set(type, next);

        return `${type}-${next}`;
    };
}

/**
 * `name` followed by the lowest number from 2 that `taken` does not have, as `Logo 2`;
 * a number it already ends with is replaced, so `Logo 2` gives `Logo 3`.
 */
export function numberedName(name: string, taken: Set<string>): string {
    const base = name.replace(/ \d+$/, '');
    let number = 2;

    while (taken.has(`${base} ${number}`)) {
        number++;
    }

    return `${base} ${number}`;
}

/**
 * A name for a copy of a shape of `type` named `name`, one `taken` does not have: its
 * own while it is free, else the next in its type's sequence (`nameShape`) for a name in
 * one, or the name with a number, as `Logo 2`.
 */
export function copyName(
    name: string,
    type: Shape['type'],
    taken: Set<string>,
    nameShape: (type: Shape['type']) => string
): string {
    if (!taken.has(name)) {
        return name;
    }

    return SEQUENCE_NAME.test(name) ? nameShape(type) : numberedName(name, taken);
}

/** The next name in a document's sequence for shapes of `type`: see `shapeNamer`. */
export const nextShapeName = (shapes: Iterable<Shape>, type: Shape['type']): string =>
    shapeNamer(shapes)(type);

export const getAnonymousUser = (): User => {
    return {
        id: '1',
        isAuthenticated: true,
        lastLoggedIn: new Date(),
        loggedIn: new Date(),
        name: 'Anonymous'
    };
};

export function getCurrentUserName(): string {
    return 'anonymous';
}

export function createNotification(options: Partial<Notification> = {}): Notification {
    return {
        id: newId(),
        created: new Date(),
        message: 'Empty message',
        type: 'info',
        ...options
    };
}

export function createShape(input: ShapeInput & Pick<Shape, 'order' | 'name'>): Shape {
    const id = newId();

    return {
        active: false,
        children: [],
        created: new Date(),
        createdBy: getCurrentUserName(),
        locked: false,
        modified: new Date(),
        modifiedBy: getCurrentUserName(),
        rotation: 0,
        selected: true,
        visible: true,
        ...input,
        id,
        key: `${input.type}-${id}`
    };
}

export function createLink(options: Partial<Link> = {}): Link {
    return {
        id: newId(),
        locked: false,
        name: newLinkName(),
        selected: false,
        visible: true,
        type: 'arrow',
        ...options
    };
}

export function createGuide(options: Partial<Guide> = {}): Guide {
    return {
        id: newId(),
        locked: false,
        name: newGuideName(),
        orientation: 'horizontal',
        position: { x: 0, y: 0 },
        selected: false,
        visible: true,
        ...options
    };
}

export function createGroup(options: Partial<Group> = {}): Group {
    return {
        id: newId(),
        locked: false,
        name: newGroupName(),
        selected: false,
        shapesIds: [],
        visible: true,
        ...options
    };
}

export function createLayer(options: Partial<Layer> = {}): Layer {
    return {
        id: newId(),
        locked: false,
        name: newLayerName(),
        selected: false,
        shapesIds: [],
        visible: true,
        ...options
    };
}

export function createDocument(options: Partial<Document> = {}): Document {
    return {
        id: newId(),
        author: getCurrentUserName(),
        camera: createCamera(),
        created: new Date(),
        createdBy: getCurrentUserName(),
        description: '',
        filter: '',
        grid: createGrid(),
        components: {},
        groups: {},
        //history: [],
        layers: {},
        links: {},
        locked: false,
        modified: new Date(),
        modifiedBy: getCurrentUserName(),
        name: newDocumentName(),
        guides: {},
        selected: false,
        shapes: {},
        tags: [],
        variables: {},
        ...options,
        componentsIds,
        selectedGroupsIds,
        groupFrames,
        groupsIds,
        selectedLayersIds,
        layersIds,
        linksIds,
        guidesIds,
        selectedShapesIds,
        selectionExtent,
        movableSelectedItems,
        editableSelectedShapesIds,
        selectedShapes,
        variablesIds,
        shapesIds: inDrawingOrder(options.shapes ?? {})
    };
}

export function createComponent(options: Partial<Component> = {}): Component {
    return {
        id: newId(),
        locked: false,
        name: newComponentName(),
        selected: false,
        shapesIds: [],
        visible: true,
        ...options
    };
}

export function createCamera(): Camera {
    return { scale: 1, position: { x: 0, y: 0 } };
}

export function createGrid(): Grid {
    return { width: 10, visible: true, factor: 10, height: 10 };
}

export function createApplication(options: Partial<Application> = {}): Application {
    return {
        id: newApplicationName(),
        started: new Date(),
        user: getAnonymousUser(),
        commands: {},
        commandsIds,
        config: {
            version: '1.0',
            arrowKeyStep: DEFAULT_ARROW_KEY_STEP,
            autoSave: true,
            debugMode: false,
            panelLayout: readPanelLayout(DEFAULT_PANEL_LAYOUT)
        },
        currentDocumentId: 'document-1',
        currentDocument,
        currentPage: 'designer',
        enteredGroupId: null,
        resetDocumentId: null,
        devices: {},
        notifications: [],
        providers: {},
        documentsIds,
        documents: { 'document-1': createDocument({ id: 'document-1' }) },
        loading: true,
        saveStatus: { kind: 'notSaving', reason: 'Documents are loading.' },
        account: { kind: 'loading' },
        ...options
    };
}

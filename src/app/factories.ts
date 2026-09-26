import { currentDocument } from './computed/currentDocument';
import { documentsIds } from './computed/documents';
import {
    commandsIds,
    componentsIds,
    selectedGroupsIds,
    groupsIds,
    selectedLayersIds,
    layersIds,
    linksIds,
    rulersIds,
    selectedShapes,
    selectedShapesIds,
    shapesIds
} from './computed/shapes';
import { newId } from './effects';
import { Sequence } from './sequence';

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
    Orientation,
    Ruler,
    Shape,
    ShapeInput,
    User
} from './types';

export const getDefaultName = (): string => 'rectangle';

const componentSequence = new Sequence();
const documentSequence = new Sequence();
const groupSequence = new Sequence();
const layerSequence = new Sequence();
const linkSequence = new Sequence();
const rulerSequence = new Sequence();
const shapeSequence = new Sequence();

export const newApplicationName = (): string => `reactor-${Date.now()}`;
export const newComponentName = (): string => `component-${componentSequence.next()}`;
export const newDocumentName = (number = documentSequence.next()): string => `document-${number}`;
export const newGroupName = (): string => `group-${groupSequence.next()}`;
export const newLayerName = (): string => `layer-${layerSequence.next()}`;
export const newLinkName = (): string => `link-${linkSequence.next()}`;
export const newRulerName = (): string => `ruler-${rulerSequence.next()}`;
export const newShapeName = (): string => `shape-${shapeSequence.next()}`;

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

export function createShape(input: ShapeInput & Pick<Shape, 'order'>): Shape {
    const id = newId();

    return {
        active: false,
        children: [],
        created: new Date(),
        createdBy: getCurrentUserName(),
        locked: false,
        modified: new Date(),
        modifiedBy: getCurrentUserName(),
        name: newShapeName(),
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

export function createRuler(options: Partial<Ruler> = {}): Ruler {
    return {
        id: newId(),
        locked: false,
        name: newRulerName(),
        orientation: Orientation.Horizontal,
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
        rulers: {},
        selected: false,
        shapes: {},
        tags: [],
        ...options,
        componentsIds,
        selectedGroupsIds,
        groupsIds,
        selectedLayersIds,
        layersIds,
        linksIds,
        rulersIds,
        selectedShapesIds,
        selectedShapes,
        shapesIds
    };
}

export function createComponent(options: Partial<Component> = {}): Component {
    return {
        id: newId(),
        locked: false,
        name: newComponentName(),
        selected: false,
        shapesIds: [],
        visible: false,
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
            autoSave: true,
            debugMode: true
        },
        currentDocumentId: 'document-1',
        currentDocument,
        currentPage: 'designer',
        devices: {},
        notifications: [],
        providers: {},
        documentsIds,
        documents: { 'document-1': createDocument({ id: 'document-1' }) },
        ...options
    };
}

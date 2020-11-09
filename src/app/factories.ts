import { newId } from './effects';

import {
  Application,
  Camera,
  Command,
  Document,
  Grid,
  Group,
  Layer,
  Link,
  Notification,
  NotificationType,
  Orientation,
  Ruler,
  Shape,
  User
} from './types';

export const getDefaultName = (type: string): string => 'Rect';

const documentSequence = sequence();
const groupSequence = sequence();
const layerSequence = sequence();
const linkSequence = sequence();
const rulerSequence = sequence();
const shapeSequence = sequence();

export const newApplicationName = (): string => `reactor-${Date.now()}`;
export const newDocumentName = (): string => `Document-${documentSequence.next().value}`;
export const newGroupName = (): string => `Group-${groupSequence.next().value}`;
export const newLayerName = (): string => `Layer-${layerSequence.next().value}`;
export const newLinkName = (): string => `Link-${linkSequence.next().value}`;
export const newRulerName = (): string => `Ruler-${rulerSequence.next().value}`;
export const newShapeName = (): string => `Shape-${shapeSequence.next().value}`;

export function* sequence() {
  let i = 1;
  while (true) {
    yield i++;
  }
}

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

export function getDefaultType(): string {
  return 'rect';
}

export function createCommand(options: Partial<Command> = {}): Command {
  return {
    id: newId(),
    action: () => console.log('not implemented'),
    category: 'test',
    name: 'Print document name',
    ...options
  };
}

export function createNotification(options: Partial<Notification> = {}): Notification {
  return {
    id: newId(),
    created: new Date(),
    message: 'Empty message',
    type: NotificationType.Info,
    ...options
  };
}

export function createShape(options: Partial<Shape> = {}): Shape {
  const id = newId();
  const type = options.type ?? getDefaultType();

  return {
    id,
    code: `${type}-${id}`,
    children: [],
    created: new Date(),
    createdBy: getCurrentUserName(),
    locked: false,
    modified: new Date(),
    modifiedBy: getCurrentUserName(),
    name: newShapeName(),
    selected: true,
    type,
    visible: true,
    ...options
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
    shapes: [],
    visible: false,
    ...options
  };
}

export function createLayer(options: Partial<Layer> = {}): Layer {
  return {
    id: newId(),
    locked: false,
    name: newLayerName(),
    selected: false,
    shapes: [],
    visible: false,
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
    groups: {},
    history: [],
    layers: {},
    links: {},
    locked: false,
    modified: new Date(),
    modifiedBy: getCurrentUserName(),
    name: newDocumentName(),
    rulers: {},
    selected: false,
    selectedShapes: [],
    shapes: {},
    ...options
  };
}

export function createCamera(): Camera {
  return { scale: 1, position: { x: 0, y: 0 } };
}

export function createGrid(): Grid {
  return { width: 10, visible: true, factor: 10, height: 10 };
}

export function createApplication(
  options: Partial<Application> = {}
): Partial<Application> & { id: string; started: Date; user: User } {
  return {
    id: newApplicationName(),
    started: new Date(),
    user: getAnonymousUser(),
    ...options
  };
}

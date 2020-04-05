import { newId } from './effects';

import {
  Application,
  Command,
  Document,
  Group,
  Layer,
  Link,
  Orientation,
  Ruler,
  Shape,
  User
} from './types';

export const getDefaultName = (type: string) => 'Rect';

const documentSequence = sequence();
const groupSequence = sequence();
const layerSequence = sequence();
const linkSequence = sequence();
const rulerSequence = sequence();
const shapeSequence = sequence();

export const newApplicationName = () => `reactor-${Date.now()}`;
export const newDocumentName = () => `Document_${documentSequence.next().value}`;
export const newGroupName = () => `Group_${groupSequence.next().value}`;
export const newLayerName = () => `Layer_${layerSequence.next().value}`;
export const newLinkName = () => `Link_${linkSequence.next().value}`;
export const newRulerName = () => `Ruler_${rulerSequence.next().value}`;
export const newShapeName = () => `Shape_${shapeSequence.next().value}`;

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

export function getCurrentUserName() {
  return 'anonymous';
}

export function getDefaultType() {
  return 'rect';
}

export function createCommand(options: Partial<Command> = {}): Command {
  return {
    id: newId(),
    category: 'test',
    name: 'Print document name',
    action: (document) => console.log(document.name),
    ...options
  };
}

export function createShape(options: Partial<Shape> = {}): Shape {
  const id = newId();
  const type = getDefaultType();

  return {
    id,
    children: [],
    created: new Date(),
    createdBy: getCurrentUserName(),
    locked: false,
    modified: new Date(),
    modifiedBy: getCurrentUserName(),
    name: newShapeName(),
    selected: true,
    type: getDefaultType(),
    visible: true,
    ...options
  };
}

export function createLink(options: Partial<Link> = {}): Link {
  return {
    id: newId(),
    name: newLinkName(),
    ...options
  };
}

export function createRuler(options: Partial<Ruler> = {}): Ruler {
  return {
    id: newId(),
    name: newRulerName(),
    orientation: Orientation.horizontal,
    position: { x: 0, y: 0 },
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
    created: new Date(),
    description: '',
    filter: '',
    grid: { width: 10, visible: true, factor: 10, height: 10 },
    groups: {},
    history: [],
    layers: {},
    links: {},
    locked: false,
    modified: new Date(),
    name: newDocumentName(),
    rulers: {},
    camera: { scale: 1, position: { x: 0, y: 0 } },
    selection: [],
    selected: false,
    shapes: {},
    ...options
  };
}

export function createApplication(options: Partial<Application> = {}): Partial<Application> {
  return {
    id: newApplicationName(),
    started: new Date(),
    user: getAnonymousUser(),
    ...options
  };
}

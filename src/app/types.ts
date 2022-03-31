// export { IAction, IConfiguration, IContext, IOperator } from 'overmind';

import { Context } from './hooks';

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

export type Position = {
  x: number;
  y: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Vector = {
  x: number;
  y: number;
};

export type Rectangle = {
  p: Point;
  size: Size;
};

export type Box = {
  topLeft: Point;
  bottomRight: Point;
};

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
  position: Position;
  selected: boolean;
  visible: boolean;
}

export interface Grid {
  width: number;
  visible: boolean;
  factor: number;
  height: number;
}

export interface Shape {
  id: string;
  parentShapeId?: string;
  centre?: Point;
  children?: Shape[];
  code: string;
  created: Date;
  createdBy: string;
  description?: string;
  locked: boolean;
  modified: Date;
  modifiedBy: string;
  name: string;
  position?: Position;
  radius?: number;
  selected: boolean;
  size?: Size;
  type: string;
  visible: boolean;
}

export interface Link {
  id: string;
  locked: boolean;
  name: string;
  selected: boolean;
  source?: string;
  target?: string;
  visible: boolean;
  type: string;
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
  scale: number;
  position: Position;
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
  group: string;
  name: string;
  color?: string;
  size: number;
}

export type ActionGuard = (context: Context, args?: Record<string, unknown>) => boolean;
export type Action = (context: Context, args?: Record<string, unknown>) => void;

export interface Command {
  id: string;
  icon: Icon;
  category?: string;
  description?: string;
  regex: RegExp;
  name: string;
  shortcut?: string;
  canExecute: ActionGuard;
  execute: Action;
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
  data: any;
  occurred: Date;
  user: string;
}

export type Device = Shape;

export interface Provider {
  id: string;
  name: string;
  description?: string;
  data?: any;
}

export interface OnlineProvider extends Provider {
  url: string;
}

export enum NotificationType {
  Info = 'Info',
  Warn = 'Warn',
  Error = 'Error'
}

export interface Notification {
  id: string;
  created: Date;
  scope?: string;
  message: string;
  type: NotificationType;
}

export type Configuration = {
  version: string;
  autoSave: boolean;
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

export interface Renderer {
  render(document: Document): void;
}

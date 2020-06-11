import { Derive } from 'overmind';

export type Action<T> = (value: T) => void;

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

export type Size = {
  height: number;
  width: number;
};

export interface HashTable<T> {
  [key: string]: T;
}

export interface Ruler {
  id: string;
  name: string;
  orientation: Orientation;
  position: Position;
}

export interface Grid {
  width: number;
  visible: boolean;
  factor: number;
  height: number;
}

export interface Shape {
  id: string;
  children?: Shape[];
  created: Date;
  createdBy: string;
  description?: string;
  locked: boolean;
  modified: Date;
  modifiedBy: string;
  name: string;
  position?: Position;
  selected: boolean;
  size?: Size;
  type: string;
  visible: boolean;
}

export interface Link {
  id: string;
  name: string;
  source?: string;
  target?: string;
}

export interface Group {
  id: string;
  locked: boolean;
  name: string;
  selected: boolean;
  shapes: string[];
  visible: boolean;
}

export interface Layer {
  id: string;
  locked: boolean;
  name: string;
  selected: boolean;
  shapes: string[];
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
  description?: string;
  filter: string;
  grid: Grid;
  groups: HashTable<Group>;
  history: Action<any>[];
  layers: HashTable<Layer>;
  links: HashTable<Link>;
  locked: boolean;
  modified: Date;
  name: string;
  rulers: HashTable<Ruler>;
  selection: string[];
  selected: boolean;
  shapes: HashTable<Shape>;
}

export interface Command {
  id: string;
  category?: string;
  description?: string;
  name: string;
  shortCut?: string;
  action: Action<any>;
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

export interface Configuration {}

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

export type Application = {
  id: string;
  commands: HashTable<Command>;
  components: HashTable<Shape>;
  config: Configuration;
  currentDocumentId?: string;
  currentDocument: Derive<Application, Document>;
  devices: HashTable<Device>;
  documents: HashTable<Document>;
  notifications: Notification[];
  providers: HashTable<Provider>;
  started: Date;
  user: User;
};

export interface Renderer {
  document: Document;
  render(document: Document): void;
}

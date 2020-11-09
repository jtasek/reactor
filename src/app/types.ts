import { IAction, IConfig, IOnInitialize, IOperator } from 'overmind';

import { config } from './';

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
  createdBy: string;
  description?: string;
  filter: string;
  grid: Grid;
  groups: HashTable<Group>;
  history: Action<any>[];
  layers: HashTable<Layer>;
  links: HashTable<Link>;
  locked: boolean;
  modified: Date;
  modifiedBy: string;
  name: string;
  rulers: HashTable<Ruler>;
  selected: boolean;
  selectedShapes: Shape[];
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
};

export type Application = {
  id: string;
  commands: HashTable<Command>;
  components: HashTable<Shape>;
  config: Configuration;
  currentDocumentId: string;
  currentDocument: Document;
  currentPage: string;
  devices: HashTable<Device>;
  documents: HashTable<Document>;
  notifications: Notification[];
  providers: HashTable<Provider>;
  started: Date;
  user: User;
};

export interface Renderer {
  render(document: Document): void;
}

// Due to circular typing we have to define an
// explicit typing of state, actions and effects since
// TS 3.9
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Config
  extends IConfig<{
    state: typeof config.state;
    actions: typeof config.actions;
    effects: typeof config.effects;
  }> {}

export type OnInitialize = IOnInitialize<Config>;

export type Action<Input = void, Output = void> = IAction<Config, Input, Output>;

export type AsyncAction<Input = void, Output = void> = IAction<Config, Input, Promise<Output>>;

export type Operator<Input = void, Output = Input> = IOperator<Config, Input, Output>;

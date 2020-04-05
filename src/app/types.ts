import { position } from '../events/computed/position';
import { Derive } from 'overmind';

export type Action<T> = (value: T) => void;

export enum Alignment {
  bottom = 'bottom',
  left = 'left',
  right = 'right',
  top = 'top'
}

export enum Orientation {
  horizontal = 'horizontal',
  vertical = 'vertical'
}

export enum Spacing {
  sameHorizontal = 'sameHorizontal',
  sameVertical = 'sameVertical'
}

export enum Sizing {
  sameHeight = 'sameHeight',
  sameSize = 'sameSize',
  sameWidth = 'sameWidth'
}

export enum LinkType {
  aggregate = 'aggregate',
  compose = 'compose',
  inherit = 'inherit',
  refer = 'refer'
}

export enum MouseButton {
  left = 0,
  middle = 1,
  right = 2
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
  history: Action[];
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
  action: Action;
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
  occured: Date;
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

export interface Message {
  title: string;
  description: string;
  category: string;
}

export type Application = {
  id: string;
  commands: HashTable<Command>;
  components: HashTable<Shape>;
  config: Configuration;
  currentDocumentId?: string;
  currentDocument?: Derive<Application, Document>;
  devices: HashTable<Device>;
  documents: HashTable<Document>;
  events: Event[];
  notifications: Message[];
  providers: HashTable<Provider>;
  started: Date;
  user: User;
};

export interface Renderer {
  render(document: Document): void;
}

// @flow

export type Alignment = 'bottom' | 'left' | 'right' | 'top'

export type Orientation = 'horizontal' | 'vertical'

export type Spacing = 'sameHorizontal' | 'sameVertical'

export type Sizing = 'sameHeight' | 'sameSize' | 'sameWidth'

export type LinkType = 'aggregate' | 'compose' | 'inherit' | 'refer'

export const MouseButton = { left: 0, middle: 1, right: 2 }

export type Position = {
    x: number,
    y: number
}

export type Point = {
    x: number,
    y: number
}

export type Vector = {
    x: number,
    y: number
}

export type Rectangle = {
    x1: number,
    y1: number,
    x2: number,
    y2: number
}

export type Size = {
    height: number,
    width: number
}

export type Ruler = {
    orientation: Orientation,
    position: Position
}

export type Grid = {
    width: number,
    visible: boolean,
    factor: number,
    height: number
}

export type Shape = {
    id: string,
    code: string,
    name: string,
    description: string,
    position: Position,
    size: Size,
    locked: boolean,
    visible: boolean,
    created: Date,
    createdBy: string,
    modified: Date,
    modifiedBy: string
}

export type Link = {
    name: string,
    source: number,
    target: number,
    type: LinkType
}

export type Group = {
    locked: boolean,
    selected: boolean,
    visible: boolean,
    name: string,
    shapes: number[]
}

export type Layer = {
    locked: boolean,
    selected: boolean,
    visible: boolean,
    name: string,
    shapes: number[]
}

export type Workspace = {
    author: string,
    grid: Grid,
    groups: Group[],
    layers: Layer[],
    links: Link[],
    rulers: Ruler[],
    shapes: Shape[]
}

export type Command = {
    category: string,
    description: string,
    name: string,
    shortCut: string,
    signal: string,
    canExecute(): boolean,
    execute(): void
}

export type User = {
    avatar: string,
    email: string,
    isAuthenticated: boolean,
    lastLoggedIn: Date,
    loggedIn: Date,
    name: string
}

export type Application = {
    name: string,
    started: Date,
    user: User,
    stats: Object,
    workspaces: Workspace[]
}

export interface IRenderer {
    render(workspace: Workspace): void;
}

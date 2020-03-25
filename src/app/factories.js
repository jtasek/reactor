
import {v4} from 'uuid'
import type {Command, Shape, Link, Ruler, Group, Layer, Workspace, Application} from './types'

export function createCommand(options: Object): Command {
    return Object.assign({
        id: v4()
    }, options)
}

export function createShape(options: Object): Shape {
    return Object.assign({
        id: v4(),
        locked: false,
        visible: true,
        selected: true,
        children: [],
        created: Date.now(),
        createdBy: 'tasek',
        modified: Date.now(),
        modifiedBy: 'tasek',
        type: 'undefined'
    }, options)
}

export function createLink(options: Object): Link {
    return Object.assign({
        type: 'refer'
    }, options)
}

export function createRuler(options: Object): Ruler {
    return Object.assign({
        type: 'refer'
    }, options)
}

export function createGroup(options: Object): Group {
    return Object.assign({
        locked: false,
        selected: false,
        visible: false,
        name: 'GROUP',
        children: []
    }, options)
}

export function createLayer(options: Object): Layer {
    return Object.assign({
        locked: false,
        selected: false,
        visible: false,
        name: 'LAYER',
        children: []
    }, options)
}

export function createWorkspace(options: Object): Workspace {
    return Object.assign({
        author: 'Jakub Tasek',
        id: 1,
        code: 'workspace-1',
        name: 'Workspace 1',
        description: 'This is my first workspace',
        created: Date.now(),
        createdBy: 'tasek',
        modified: Date.now(),
        modifiedBy: 'tasek',
        filter: '',
        grid: {
            width: 10,
            visible: true,
            factor: 10,
            height: 10
        },
        groups: [],
        layers: [],
        links: [],
        rulers: [],
        shapes: []
    }, options)
}

export function createApplication(options: Object): Application {
    return Object.assign({
        commands: [],
        config: {},
        name: 'reactor',
        stats: {},
        workspaces: []
    }, options)
}
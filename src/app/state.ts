import { Application } from './types';
import { createApplication } from './factories';

export const state = {
    ...createApplication(),
    commands: {},
    components: {},
    config: {},
    currentDocumentId: 'workspace-1',
    currentDocument: ({ state }) => state.documents[state.currentDocumentId],
    devices: {},
    events: [],
    providers: {},
    documents: {
        'workspace-1': {
            id: '1',
            author: 'Jakub Tasek',
            name: 'Workspace 1',
            description: 'This is my first workspace',
            created: new Date('1.1.2015'),
            createdBy: 'tasek',
            modified: new Date('1.1.2015'),
            modifiedBy: 'tasek',
            grid: null,
            history: [],
            selection: [],
            filter: '',
            scale: 1,
            groups: {
                '1': {
                    id: '1',
                    name: 'First group',
                    visible: true,
                    locked: false,
                    selected: false,
                    shapes: ['1', '2']
                },
                '2': {
                    id: '2',
                    name: 'Second group',
                    visible: true,
                    locked: true,
                    selected: false,
                    shapes: ['3']
                },
                '3': {
                    id: '3',
                    name: 'Third group',
                    visible: true,
                    locked: false,
                    selected: false,
                    shapes: ['4']
                }
            },
            layers: {
                '1': {
                    id: '1',
                    name: 'First layer',
                    visible: false,
                    locked: false,
                    selected: false,
                    shapes: ['1']
                },
                '2': {
                    id: '2',
                    name: 'Second layer',
                    visible: true,
                    locked: true,
                    selected: false,
                    shapes: ['2', '3']
                },
                '3': {
                    id: '3',
                    name: 'Third layer',
                    visible: true,
                    locked: false,
                    selected: false,
                    shapes: ['4']
                }
            },
            links: {
                '1': {
                    id: '1',
                    name: 'Link one',
                    source: '1',
                    target: '2',
                    type: 'composition'
                },
                '2': {
                    id: '2',
                    name: 'Link two',
                    source: '2',
                    target: '3',
                    type: 'aggregation'
                },
                '3': {
                    id: '3',
                    name: 'Link three',
                    source: '3',
                    target: '4',
                    type: 'reference'
                }
            },
            rulers: {
                '1': {
                    id: '1',
                    name: 'Ruler one',
                    position: {
                        x: 0,
                        y: 200
                    },
                    orientation: 'horizontal',
                    visible: true
                },
                '2': {
                    id: '2',
                    name: 'Ruler two',
                    position: {
                        x: 200,
                        y: 0
                    },
                    orientation: 'vertical',
                    visible: true
                },
                '3': {
                    id: '3',
                    name: 'Ruler three',
                    position: {
                        x: 0,
                        y: 500
                    },
                    orientation: 'horizontal',
                    visible: true
                },
                '4': {
                    id: '4',
                    name: 'Ruler four',
                    position: {
                        x: 500,
                        y: 0
                    },
                    orientation: 'vertical',
                    visible: true
                }
            },
            shapes: {
                '1': {
                    id: '1',
                    code: 'shape-1',
                    name: 'Shape 1',
                    description: 'This is shape no 1',
                    position: {
                        x: 100,
                        y: 100
                    },
                    radius: 20,
                    size: {
                        height: 50,
                        width: 50
                    },
                    locked: false,
                    visible: true,
                    selected: true,
                    created: new Date('1.1.2015'),
                    createdBy: 'tasek',
                    modified: new Date('1.1.2015'),
                    modifiedBy: 'tasek',
                    type: 'rect'
                },
                '2': {
                    id: '2',
                    code: 'shape-2',
                    name: 'Shape 2',
                    description: 'This is shape no 2',
                    position: {
                        x: 250,
                        y: 250
                    },
                    size: {
                        height: 75,
                        width: 75
                    },
                    locked: false,
                    visible: true,
                    selected: false,
                    created: new Date('1.1.2015'),
                    createdBy: 'tasek',
                    modified: new Date('1.1.2015'),
                    modifiedBy: 'tasek',
                    type: 'rect'
                },
                '3': {
                    id: '3',
                    code: 'shape-3',
                    name: 'Shape 3',
                    description: 'This is shape no 3',
                    position: {
                        x: 500,
                        y: 500
                    },
                    size: {
                        height: 100,
                        width: 100
                    },
                    locked: false,
                    visible: true,
                    selected: false,
                    created: new Date('1.1.2015'),
                    createdBy: 'tasek',
                    modified: new Date('1.1.2015'),
                    modifiedBy: 'tasek',
                    type: 'rect'
                },
                '4': {
                    id: '4',
                    code: 'shape-4',
                    name: 'Shape 4',
                    description: 'This is shape no 4',
                    position: {
                        x: 750,
                        y: 750
                    },
                    size: {
                        height: 125,
                        width: 125
                    },
                    locked: false,
                    visible: true,
                    selected: false,
                    created: new Date('1.1.2015'),
                    createdBy: 'tasek',
                    modified: new Date('1.1.2015'),
                    modifiedBy: 'tasek',
                    type: 'rect'
                },
                '5': {
                    id: '5',
                    code: 'shape-5',
                    name: 'Shape 5',
                    description: 'This is shape no 5',
                    position: {
                        x: 1000,
                        y: 1000
                    },
                    size: {
                        height: 150,
                        width: 150
                    },
                    locked: false,
                    visible: true,
                    selected: false,
                    created: new Date('1.1.2015'),
                    createdBy: 'tasek',
                    modified: new Date('1.1.2015'),
                    modifiedBy: 'tasek',
                    type: 'rect'
                }
            }
        }
    }
} as Application;

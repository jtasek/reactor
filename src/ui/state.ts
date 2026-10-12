import { UI } from './types';

export const state: UI = {
    commandLine: {
        id: 'commandLine',
        name: 'Command Line',
        visible: false
    },
    components: {
        id: 'components',
        name: 'Library',
        visible: false
    },
    contextMenu: {
        id: 'contextMenu',
        name: 'Context Menu',
        position: {
            x: 0,
            y: 0
        },
        target: 'canvas',
        visible: false
    },
    controlPanel: {
        id: 'controlPanel',
        name: 'Control Panel',
        visible: false
    },
    dataView: {
        id: 'dataView',
        name: 'Data View',
        visible: false
    },
    documentInfo: {
        id: 'documentInfo',
        name: 'Document Info',
        visible: false
    },
    explorer: {
        id: 'explorer',
        name: 'Explorer',
        visible: true
    },
    grid: {
        id: 'grid',
        name: 'Grid',
        factor: 10,
        height: 10,
        visible: true,
        width: 10
    },
    groupPanel: {
        id: 'groupPanel',
        name: 'Group Panel',
        visible: false
    },
    layerPanel: {
        id: 'layerPanel',
        name: 'Layer Panel',
        visible: false
    },
    menuBar: {
        id: 'menuBar',
        name: 'Menu Bar',
        visible: false
    },
    miniMap: {
        id: 'miniMap',
        name: 'Minimap',
        visible: false
    },
    inspector: {
        id: 'inspector',
        name: 'Inspector',
        visible: true
    },
    guides: {
        id: 'guides',
        name: 'Guides',
        visible: false
    },
    rulers: {
        id: 'rulers',
        name: 'Rulers',
        visible: false
    },
    surface: {
        id: 'surface',
        name: 'Surface',
        visible: true
    },
    statusBar: {
        id: 'statusBar',
        name: 'Status Bar',
        visible: true
    },
    toolBar: {
        id: 'toolBar',
        name: 'Tool Bar',
        visible: true
    },
    variables: {
        id: 'variables',
        name: 'Variables',
        visible: false
    }
};

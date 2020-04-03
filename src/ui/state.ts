import { UI } from './types';

export const state: UI = {
  controls: {
    commandLine: {
      id: 'commandline',
      name: 'Command Line',
      visible: true
    },
    contextMenu: {
      id: 'contextmenu',
      name: 'Context Menu',
      position: {
        x: 0,
        y: 0
      },
      visible: false
    },
    controlPanel: {
      id: 'controlpanel',
      name: 'Control Panel',
      visible: true
    },
    dodumentInfo: {
      id: 'documentInfo',
      name: 'Document Info'
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
      id: 'grouppanel',
      name: 'Group Panel',
      visible: true
    },
    layerPanel: {
      id: 'layerpanel',
      name: 'Layer Panel',
      visible: true
    },
    menuBar: {
      id: 'menubar',
      name: 'Menu Bar',
      visible: true
    },
    minimap: {
      id: 'minimap',
      name: 'Minimap',
      visible: true
    },
    navBar: {
      id: 'navbar',
      name: 'Navigation Bar',
      visible: true
    },
    overlay: {
      id: 'overlay',
      name: 'Overlay',
      visible: false
    },
    propertyPanel: {
      id: 'propertypanel',
      name: 'Property Panel',
      visible: true
    },
    sideBar: {
      id: 'sidebar',
      name: 'Side Bar',
      visible: true
    },
    surface: {
      id: 'surface',
      name: 'Surface',
      visible: true
    },
    statusBar: {
      id: 'statusbar',
      name: 'Status Bar',
      visible: true
    },
    toolBar: {
      id: 'toolbar',
      name: 'Tool Bar',
      visible: true
    },
    workspace: {
      id: 'workspace',
      name: 'Workspace',
      visible: true
    }
  }
};

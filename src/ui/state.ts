import { UI } from './types';

export const state: UI = {
  controls: {
    commandline: {
      id: 'commandline',
      name: 'Command Line',
      visible: true
    },
    contextmenu: {
      id: 'contextmenu',
      name: 'Context Menu',
      position: {
        x: 0,
        y: 0
      },
      visible: false
    },
    controlpanel: {
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
    grouppanel: {
      id: 'grouppanel',
      name: 'Group Panel',
      visible: true
    },
    layerpanel: {
      id: 'layerpanel',
      name: 'Layer Panel',
      visible: true
    },
    menubar: {
      id: 'menubar',
      name: 'Menu Bar',
      visible: true
    },
    minimap: {
      id: 'minimap',
      name: 'Minimap',
      visible: true
    },
    navbar: {
      id: 'navbar',
      name: 'Navigation Bar',
      visible: true
    },
    overlay: {
      id: 'overlay',
      name: 'Overlay',
      visible: false
    },
    propertypanel: {
      id: 'propertypanel',
      name: 'Property Panel',
      visible: true
    },
    sidebar: {
      id: 'sidebar',
      name: 'Side Bar',
      visible: true
    },
    surface: {
      id: 'surface',
      name: 'Surface',
      visible: true
    },
    statusbar: {
      id: 'statusbar',
      name: 'Status Bar',
      visible: true
    },
    toolbar: {
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

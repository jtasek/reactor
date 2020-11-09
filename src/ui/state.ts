import { UI } from './types';

export const state: UI = {
  commandLine: {
    id: 'commandLine',
    name: 'Command Line',
    visible: true
  },
  contextMenu: {
    id: 'contextMenu',
    name: 'Context Menu',
    position: {
      x: 0,
      y: 0
    },
    visible: false
  },
  controlPanel: {
    id: 'controlPanel',
    name: 'Control Panel',
    visible: true
  },
  dataView: {
    id: 'dataView',
    name: 'Data View',
    visible: true
  },
  documentInfo: {
    id: 'documentInfo',
    name: 'Document Info',
    visible: true
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
    visible: true
  },
  layerPanel: {
    id: 'layerPanel',
    name: 'Layer Panel',
    visible: true
  },
  menuBar: {
    id: 'menuBar',
    name: 'Menu Bar',
    visible: true
  },
  miniMap: {
    id: 'miniMap',
    name: 'Minimap',
    visible: true
  },
  navBar: {
    id: 'navBar',
    name: 'Navigation Bar',
    visible: true
  },
  overlay: {
    id: 'overlay',
    name: 'Overlay',
    visible: false
  },
  propertyPanel: {
    id: 'propertyPanel',
    name: 'Property Panel',
    visible: true
  },
  searchBox: {
    id: 'searchBox',
    name: 'Search Box',
    visible: true
  },
  sideBar: {
    id: 'sideBar',
    name: 'Side Bar',
    visible: true
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
  }
};

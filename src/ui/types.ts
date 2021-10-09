import { Position } from '../app/types';

export interface Control {
  id: string;
  name: string;
  visible: boolean;
}

export interface UI {
  commandLine: Control;
  contextMenu: Control & { position: Position };
  controlPanel: Control;
  dataView: Control;
  documentInfo: Control;
  explorer: Control;
  grid: Control & {
    factor: number;
    height: number;
    width: number;
  };
  groupPanel: Control;
  layerPanel: Control;
  menuBar: Control;
  miniMap: Control;
  navBar: Control;
  overlay: Control;
  propertyPanel: Control;
  rulers: Control;
  searchBox: Control;
  sideBar: Control;
  statusBar: Control;
  surface: Control;
  toolBar: Control;
}

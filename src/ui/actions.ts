import { Action } from 'src/app/types';

import { Position } from '../app/types';

export const displayContextMenu: Action<Position> = ({ state }, position) => {
  state.ui.contextMenu.visible = true;
};

export const showControl: Action<string> = ({ state }, controlId: string) => {
  state.ui[controlId].visible = true;
};

export const hideControl: Action<string> = ({ state }, controlId: string) => {
  state.ui[controlId].visible = false;
};

export const toggleControlVisibility: Action<string> = ({ state }, controlId: string) => {
  state.ui[controlId].visible = !state.ui[controlId].visible;
};

export const distractionFreeMode: Action = ({ state }) => {
  state.ui.commandLine.visible = false;
  state.ui.contextMenu.visible = false;
  state.ui.controlPanel.visible = false;
  state.ui.groupPanel.visible = false;
  state.ui.layerPanel.visible = false;
  state.ui.menuBar.visible = false;
  state.ui.miniMap.visible = false;
  state.ui.navBar.visible = false;
  state.ui.propertyPanel.visible = false;
  state.ui.sideBar.visible = false;
  state.ui.statusBar.visible = false;
  state.ui.surface.visible = false;
  state.ui.toolBar.visible = false;
};

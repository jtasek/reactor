import { ActionWithParam, Action } from 'src/app/types';

export const displayContextMenu: Action = ({ state }) => {
  state.ui.contextMenu.visible = true;
};

export const hideContextMenu: Action = ({ state }) => {
  state.ui.contextMenu.visible = false;
};

export const showControl: ActionWithParam<string> = ({ state }, controlId: string) => {
  state.ui[controlId].visible = true;
};

export const hideControl: ActionWithParam<string> = ({ state }, controlId: string) => {
  state.ui[controlId].visible = false;
};

export const toggleControlVisibility: ActionWithParam<string> = ({ state }, controlId: string) => {
  state.ui[controlId].visible = !state.ui[controlId].visible;
};

export const distractionFreeMode: Action= ({ state }) => {
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

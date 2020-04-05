import { Action } from 'overmind';
import { UI } from './types';

export const showControl: Action<string> = ({ controls }: UI, controlId: string) => {
  controls[controlId].visible = true;
};

export const hideControl = ({ controls }: UI, controlId: string) => {
  controls[controlId].visible = false;
};

export const distructionFreeMode: Action<boolean> = ({ controls }: UI) => {
  controls.commandLine.visible = false;
  controls.contextMenu.visible = false;
  controls.controlPanel.visible = false;
  controls.groupPanel.visible = false;
  controls.layerPanel.visible = false;
  controls.menuBar.visible = false;
  controls.minimap.visible = false;
  controls.navBar.visible = false;
  controls.propertyPanel.visible = false;
  controls.sideBar.visible = false;
  controls.statusBar.visible = false;
  controls.surface.visible = false;
  controls.toolBar.visible = false;
};

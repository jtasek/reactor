export interface UI {
  controls: {
    commandLine: {
      id: string;
      name: string;
      visible: boolean;
    };
    contextMenu: {
      id: string;
      name: string;
      visible: boolean;
      position: Position;
    };
    controlPanel: {
      id: string;
      name: string;
      visible: boolean;
    };
    documentInfo: {
      id: string;
      name: string;
      visible: boolean;
    };
    explorer: {
      id: string;
      name: string;
      visible: boolean;
    };
    grid: {
      id: string;
      name: string;
      visible: boolean;
    };
    groupPanel: {
      id: string;
      name: string;
      visible: boolean;
    };
    layerPanel: {
      id: string;
      name: string;
      visible: boolean;
    };
    menuBar: {
      id: string;
      name: string;
      visible: boolean;
    };
    minimap: {
      id: string;
      name: string;
      visible: boolean;
    };
    navBar: {
      id: string;
      name: string;
      visible: boolean;
    };
    propertyPanel: {
      id: string;
      name: string;
      visible: boolean;
    };
    ruler: {
      id: string;
      name: string;
      visible: boolean;
    };
    searchBox: {
      id: string;
      name: string;
      visible: boolean;
    };
    sideBar: {
      id: string;
      name: string;
      visible: boolean;
    };
    statusBar: {
      id: string;
      name: string;
      visible: boolean;
    };
    surface: {
      id: string;
      name: string;
      visible: boolean;
    };
    toolBar: {
      id: string;
      name: string;
      visible: boolean;
    };
  };
}

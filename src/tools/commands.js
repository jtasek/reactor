export const commands = {
  clone: {
    name: 'Clone',
    description: 'Clones selection',
    icon: {
      group: 'content',
      name: 'content_copy',
      color: 'rgb(191, 34, 243)',
      size: 24
    },
    factory: 'cloneShape',
    regex: /(?<toolCode>clone)\('(?<shapeName>\w+)'\)/,
    shortcut: 'ctrl+v',
    type: 'clone'
  },
  circle: {
    name: 'Circle',
    description: 'Draws circle',
    icon: {
      group: 'image',
      name: 'panorama_fish_eye',
      color: 'rgb(144, 254, 214)',
      size: 24
    },
    factory: 'createCircle',
    regex: /(?<toolCode>circle)\((?<cx>\d+),(?<cy>\d+),(?<radius>\d+)\)/,
    shortcut: 'ctrl+c',
    type: 'circle'
  },
  image: {
    name: 'Image',
    description: 'Inserts image',
    icon: {
      group: 'image',
      name: 'image',
      color: 'rgb(234, 2, 130)',
      size: 24
    },
    factory: 'insertImage',
    regex: /(?<toolCode>image)\('(?<protocol>www|http|https):\/\/(?<url>[^\s]+[\w])'\)/,
    shortcut: 'ctrl+i',
    type: 'image'
  },
  line: {
    name: 'Line',
    description: 'Draws a line',
    icon: {
      group: 'action',
      name: 'timeline',
      color: 'rgb(95, 216, 240)',
      size: 24
    },
    factory: 'createLine',
    regex: /(?<toolCode>line)\((?<x1>\d+),(?<y1>\d+),(?<x2>\d+),(?<y2>\d+)\)/,
    shortcut: 'ctrl+l',
    type: 'line'
  },
  move: {
    name: 'Move',
    description: 'Moves selection',
    icon: {
      group: 'action',
      name: 'visibility',
      color: 'rgba(255,255,255)',
      size: 24
    },
    factory: 'moveSelection',
    regex: /(?<toolCode>move)\('(?<shapeName>\w+)',(?<x>\d+),(?<y>\d+)\)/,
    shortcut: 'm',
    type: 'move'
  },
  pen: {
    name: 'Pen',
    description: 'Draws a curve line',
    icon: {
      group: 'content',
      name: 'create',
      color: 'rgba(255,255,255)',
      size: 24
    },
    factory: 'pen',
    regex: /(?<toolCode>pen)\((?<path>[\d, ]+)\)/,
    shortcut: 'p',
    type: 'pen'
  },
  rect: {
    name: 'Rectangle',
    description: 'Draws a rectangle or square',
    icon: {
      group: 'image',
      name: 'crop_square',
      color: 'rgba(255,255,255)',
      size: 24
    },
    factory: 'createRect',
    regex: /(?<toolCode>rect)\((?<x1>[\d]+),(?<y1>[\d]+),(?<x2>[\d]+),(?<y2>[\d]+)\)/,
    shortcut: 'r',
    type: 'rect'
  },
  select: {
    name: 'Select',
    description: 'Select a shape or group',
    icon: {
      group: 'action',
      name: 'pan_tool',
      color: 'rgba(255,255,255)',
      size: 24
    },
    factory: 'select',
    regex: /(?<toolCode>select)\((?<x1>[\d]+),(?<y1>[\d]+),(?<x2>[\d]+),(?<y2>[\d]+)\)/,
    shortcut: 's',
    type: 'select'
  },
  text: {
    name: 'Text',
    description: 'Types a text',
    icon: {
      group: 'editor',
      name: 'title',
      color: 'rgba(255,255,255)',
      size: 24
    },
    factory: 'typeText',
    regex: /(?<toolCode>text)\((?<x>[\d]+),(?<y>[\d]+),'(?<text>[\w]+)'\)/,
    shortcut: 't',
    type: 'text'
  },
  zoom: {
    name: 'Zoom',
    description: 'Zooms in and out',
    icon: {
      group: 'action',
      name: 'search',
      color: 'rgba(255,255,255)',
      size: 24
    },
    factory: 'zoom',
    regex: /(?<toolCode>zoom)\((?<factor>[\d]+)\)/,
    shortcut: 'z',
    type: 'zoom'
  }
};

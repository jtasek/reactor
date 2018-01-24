export default {
    clone: {
        name: 'Clone',
        description: 'Clones selected shape or group',
        icon: { group: 'content', name: 'content_copy', color: 'rgb(191, 34, 243)', size: 24 },
        active: false,
        visible: true,
        command: 'tools.clone',
        type: 'clone'
    },
    circle: {
        name: 'Circle',
        description: 'Draws ellipse or circle',
        icon: { group: 'image', name: 'panorama_fish_eye', color: 'rgb(144, 254, 214)', size: 24 },
        active: false,
        visible: true,
        command: 'tools.circle',
        type: 'circle'
    },
    image: {
        name: 'Image',
        description: 'Inserts image',
        icon: { group: 'image', name: 'image', color: 'rgb(234, 2, 130)', size: 24 },
        active: false,
        visible: true,
        command: 'tools.image',
        type: 'image'
    },
    line: {
        name: 'Line',
        description: 'Draws a line',
        icon: { group: 'action', name: 'timeline', color: 'rgb(95, 216, 240)', size: 24 },
        active: false,
        visible: true,
        command: 'tool.line',
        type: 'line'
    },
    move: {
        name: 'Move',
        description: 'Moves selected shape or group',
        icon: { group: 'action', name: 'visibility', color: 'rgba(255,255,255)', size: 24 },
        active: false,
        visible: true,
        command: 'tools.move',
        type: 'move'
    },
    pen: {
        name: 'Pen',
        description: 'Draws a curve line',
        icon: { group: 'content', name: 'create', color: 'rgba(255,255,255)', size: 24 },
        active: false,
        visible: true,
        command: 'tools.pen',
        type: 'pen'
    },
    rect: {
        name: 'Rectangle',
        description: 'Draws a rectangle or square',
        icon: { group: 'image', name: 'crop_square', color: 'rgba(255,255,255)', size: 24 },
        active: true,
        visible: true,
        command: 'tools.rect',
        type: 'rect'
    },
    select: {
        name: 'Select',
        description: 'Select a shape or group',
        icon: { group: 'action', name: 'pan_tool', color: 'rgba(255,255,255)', size: 24 },
        active: false,
        visible: true,
        command: 'tools.select',
        type: 'select'
    },
    text: {
        name: 'Text',
        description: 'Types a text',
        icon: { group: 'editor', name: 'title', color: 'rgba(255,255,255)', size: 24 },
        active: false,
        visible: true,
        command: 'tools.text',
        type: 'text'
    },
    zoom: {
        name: 'Zoom',
        description: 'Zooms in and out',
        icon: { group: 'action', name: 'search', color: 'rgba(255,255,255)', size: 24 },
        active: false,
        visible: true,
        command: 'tools.zoom',
        type: 'zoom'
    }
}
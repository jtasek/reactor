export default [
    {
        id: 'tools.clone',
        command: 'clone(${id})',
        description: 'Clones selected shape or group',
        shortcut: 'ctrl+c'
    }, {
        id: 'tools.circle',
        command: 'circle(${cx, cy, r})',
        description: 'Draws circle',
        shortcut: 'c'
    }, {
        id: 'tools.image',
        command: 'image(${x, y, title, size, path})',
        description: 'Inserts image',
        shortcut: 'i'
    }, {
        id: 'tools.line',
        command: 'line(${cx, cy, c2x, c2y})',
        description: 'Draws a line',
        shortcut: 'l'
    }, {
        id: 'tools.move',
        command: 'move(${id, x, y})',
        description: 'Moves selected shape or group',
        shortcut: 'm'
    }, {
        id: 'tools.pen',
        command: 'pen(${path})',
        description: 'Draws a curve line',
        shortcut: 'p'
    }, {
        id: 'tools.rect',
        command: 'rect(${cx, cy, c2x, c2y})',
        description: 'Draws a rectangle or square',
        shortcut: 'r'
    }, {
        id: 'tools.select',
        command: 'select(${id})',
        description: 'Select a shape or group',
        shortcut: 's'
    }, {
        id: 'tools.text',
        command: 'text(${x, y, text})',
        description: 'Types a text',
        shortcut: 't'
    }, {
        id: 'tools.zoom',
        command: 'zoom(${factor})',
        description: 'Zooms in and out',
        shortcut: 'z'
    }
]
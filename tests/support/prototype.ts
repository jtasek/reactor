import { automaticLayoutsPrototype } from './automaticScreenLayouts';
import { responsiveDocument } from './responsiveModes';

export function prototypeDocument() {
    const document = automaticLayoutsPrototype();
    const responsive = responsiveDocument();
    document.dimensions = responsive.dimensions;
    document.variables = responsive.variables;
    for (const id of ['caption', 'field', 'title']) {
        const shape = document.shapes[id];
        if (shape.type === 'text') {
            shape.fontColor = '#112233';
            shape.fontSize = 16;
            shape.bindings = { fontColor: 'ink', fontSize: 'font' };
        }
    }
    document.frames.view.position = { x: 400, y: 200 };
    document.frames.view.modeOverrides = { theme: 'dark' };

    return document;
}

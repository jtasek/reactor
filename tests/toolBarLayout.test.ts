import { toolBarSlots } from 'src/app/services/toolBarLayout';
import { getTools } from 'src/app/actions/startup';
import { registerEditor } from 'src/pages/registerEditor';

describe('the tool bar layout', () => {
    it('puts the editor’s tools most used first, similar ones in one slot', () => {
        registerEditor();

        expect(toolBarSlots(getTools()).map((slot) => slot.map((tool) => tool.id))).toEqual([
            ['select', 'move'],
            ['frame'],
            ['rectangle', 'ellipse', 'circle'],
            ['text'],
            ['image'],
            ['instance'],
            ['line', 'pen']
        ]);
    });

    it('leaves out tools that are not registered and adds unplaced ones at the end', () => {
        const slots = toolBarSlots([{ id: 'pen' }, { id: 'select' }, { id: 'lasso' }]);

        expect(slots.map((slot) => slot.map((tool) => tool.id))).toEqual([
            ['select'],
            ['pen'],
            ['lasso']
        ]);
    });
});

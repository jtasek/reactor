import { DEFAULT_PANEL_LAYOUT, readPanelLayout } from 'src/app/panelLayout';

describe('panel layout', () => {
    it('uses defaults for malformed saved placements', () => {
        const layout = readPanelLayout({
            sideBar: { dock: 'left', position: { x: 24, y: 32 } },
            stats: { dock: 'diagonal', position: { x: 10, y: 20 } },
            inspector: { dock: null, position: { x: '10', y: 20 } }
        });

        expect(layout.sideBar).toEqual({ dock: 'left', position: { x: 24, y: 32 } });
        expect(layout.stats).toEqual(DEFAULT_PANEL_LAYOUT.stats);
        expect(layout.inspector).toEqual(DEFAULT_PANEL_LAYOUT.inspector);
    });

    it('keeps valid floating and docked placements', () => {
        const layout = readPanelLayout({
            stats: { dock: null, position: { x: 240, y: 180 } },
            sideBar: { dock: 'bottom-right', position: { x: 4, y: 8 } }
        });

        expect(layout.stats).toEqual({ dock: null, position: { x: 240, y: 180 } });
        expect(layout.sideBar).toEqual({ dock: 'bottom-right', position: { x: 4, y: 8 } });
    });
});

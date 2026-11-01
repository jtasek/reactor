import { createComponent, createShape } from 'src/app/factories';
import { orderAbove } from 'src/app/drawOrder';
import type { Document, Shape, ShapeInput, Component, Frame } from 'src/app/types';
import { STARTER_TEMPLATES, type StarterTemplateId } from './catalog';

export type StarterDocument = Pick<
    Document,
    'name' | 'frames' | 'shapes' | 'shapesIds' | 'components' | 'camera'
>;
const WIDTH = 480;
const HEIGHT = 640;
const INSET = 32;
const CONTENT_WIDTH = WIDTH - INSET * 2;
const VIEW_GAP = 80;
const INK = '#20242c';
const MUTED = '#626b78';
const ACCENT = '#275de5';
const WHITE = '#ffffff';
const LINE = '#dce1e9';
/** Opens the three views to the right of the Explorer, with all three in a laptop-wide window. */
const CAMERA = { position: { x: 360, y: 80 }, scale: 0.75 };

/** Ordinary editable graph records. No template runtime or account integration is required. */
export function buildStarterTemplate(
    templateId: StarterTemplateId,
    newId: () => string
): StarterDocument {
    const template = STARTER_TEMPLATES.find(({ id }) => id === templateId);

    if (!template) {
        throw new Error('Unknown starter template');
    }

    const shapes: Record<string, Shape> = {};
    const components: Record<string, Component> = {};
    const frames: Record<string, Frame> = {};
    const add = (input: ShapeInput & Pick<Shape, 'name'> & Partial<Pick<Shape, 'visible'>>) => {
        const previous = Object.values(shapes).at(-1);
        const id = newId();
        const shape = {
            ...createShape({ ...input, order: orderAbove(previous?.order ?? null) }),
            id,
            key: id,
            selected: false
        };
        shapes[id] = shape;

        return id;
    };
    const text = (value: string, y: number, parentFrameId?: string, fontSize = 16, color = INK) =>
        add({
            type: 'text',
            name: value,
            value,
            position: { x: INSET, y },
            fontSize,
            fontColor: color,
            wrapWidth: CONTENT_WIDTH,
            parentFrameId
        });
    const control = (name: string, role: 'button' | 'input') => {
        const background = add({
            type: 'rectangle',
            name: `${name} background`,
            position: { x: 0, y: 0 },
            size: { width: CONTENT_WIDTH, height: 48 },
            cornerRadius: 8,
            fill: role === 'button' ? ACCENT : WHITE,
            stroke: role === 'button' ? ACCENT : LINE
        });
        const label = add({
            type: 'text',
            name: `${name} label`,
            value: name,
            position: { x: 16, y: 30 },
            fontSize: 16,
            fontColor: role === 'button' ? WHITE : MUTED,
            // A field shows its hint; its label is drawn above it on the screen and only named here.
            ...(role === 'input' ? { visible: false } : {})
        });
        const hint =
            role === 'input'
                ? add({
                      type: 'text',
                      name: `${name} placeholder`,
                      value: 'Placeholder',
                      position: { x: 16, y: 30 },
                      fontSize: 16,
                      fontColor: MUTED
                  })
                : undefined;
        const id = newId();
        components[id] = createComponent({
            id,
            name,
            sourceOnly: true,
            shapesIds: hint ? [background, label, hint] : [background, label],
            props: [
                { id: 'label', label: 'Label', shapeId: label, key: 'text' },
                ...(hint
                    ? [
                          {
                              id: 'placeholder',
                              label: 'Placeholder',
                              shapeId: hint,
                              key: 'text'
                          }
                      ]
                    : [])
            ],
            interaction: {
                role,
                props: hint ? { label: 'label', placeholder: 'placeholder' } : { label: 'label' }
            }
        });

        return id;
    };
    const button = control('Button', 'button');
    const input = control('Text field', 'input');
    const screenIds = [newId(), newId(), newId()];
    const screen = (index: number, name: string, heading: string, subtitle: string) => {
        const id = screenIds[index];
        frames[id] = {
            id,
            name,
            kind: 'screen',
            definitionOnly: true,
            position: { x: 0, y: 0 },
            size: { width: WIDTH, height: HEIGHT },
            visible: true,
            locked: false
        };
        const viewId = newId();
        frames[viewId] = {
            id: viewId,
            name: 'Desktop',
            kind: 'view',
            screenId: id,
            position: { x: index * (WIDTH + VIEW_GAP), y: 0 },
            size: { width: WIDTH, height: HEIGHT },
            visible: true,
            locked: false
        };
        add({
            type: 'rectangle',
            name: 'Page background',
            position: { x: 0, y: 0 },
            size: { width: WIDTH, height: HEIGHT },
            fill: WHITE,
            stroke: LINE,
            parentFrameId: id
        });
        text(template.name.toUpperCase(), 40, id, 12, MUTED);
        text(heading, 96, id, 28);
        text(subtitle, 132, id, 15, MUTED);
        text('Sample prototype · no data is submitted', HEIGHT - 28, id, 12, MUTED);

        return id;
    };
    const action = (screenId: string, label: string, y: number, destination: number) =>
        add({
            type: 'instance',
            name: label,
            componentId: button,
            position: { x: INSET, y },
            parentFrameId: screenId,
            overrides: { label },
            interactions: { activate: { type: 'navigate', screenId: screenIds[destination] } }
        });
    const field = (screenId: string, label: string, y: number, placeholder: string) => {
        text(label, y, screenId, 14);
        add({
            type: 'instance',
            name: label,
            componentId: input,
            position: { x: INSET, y: y + 12 },
            parentFrameId: screenId,
            overrides: { label, placeholder }
        });
    };

    if (templateId === 'list-detail') {
        const list = screen(0, 'Projects', 'Your projects', 'Choose a project to see its details.');
        action(list, 'Website redesign →', 208, 1);
        action(list, 'See empty state', 420, 2);
        const detail = screen(
            1,
            'Project details',
            'Project overview',
            'Sample project · In progress'
        );
        text('A shared place to plan your next release.', 224, detail);
        text('Owner: Alex Morgan', 272, detail, 16, MUTED);
        action(detail, 'Back to projects', 420, 0);
        const empty = screen(
            2,
            'Empty projects',
            'No projects yet',
            'Your projects will appear here once you add them.'
        );
        action(empty, 'Explore an example project', 240, 1);
    }

    if (templateId === 'forms') {
        const empty = screen(
            0,
            'Requests',
            'No requests yet',
            'Start a request to tell us what you need.'
        );
        action(empty, 'New request', 240, 1);
        const form = screen(
            1,
            'New request',
            'New request',
            'Try the fields below. Nothing will be submitted.'
        );
        field(form, 'Your name', 204, 'Ada Lovelace');
        field(form, 'Email', 300, 'name@example.com');
        field(form, 'Request summary', 396, 'What do you need?');
        action(form, 'Preview confirmation', 496, 2);
        const done = screen(
            2,
            'Confirmation',
            'Request previewed',
            'This is a demo. Your request has not been sent.'
        );
        action(done, 'Back to requests', 240, 0);
    }

    if (templateId === 'sign-in') {
        const signIn = screen(
            0,
            'Sign in',
            'Welcome back',
            'Try an email sign-in flow. No account is required.'
        );
        field(signIn, 'Email address', 220, 'name@example.com');
        action(signIn, 'Preview email link', 328, 1);
        const email = screen(
            1,
            'Check email',
            'Check your email',
            'In a real app, this step follows an email request.'
        );
        text('Prototype only. No email has been sent.', 220, email, 16, MUTED);
        action(email, 'Continue demo', 304, 2);
        action(email, 'Back to sign in', 372, 0);
        const account = screen(
            2,
            'Account',
            'No projects yet',
            'You are viewing an example account.'
        );
        action(account, 'Back to sign in', 240, 0);
    }

    if (templateId === 'settings') {
        const settings = screen(
            0,
            'Profile settings',
            'Your profile',
            'Update the details people see about you.'
        );
        field(settings, 'Display name', 204, 'Alex Morgan');
        field(settings, 'Email address', 300, 'alex@example.com');
        action(settings, 'Preview saved state', 408, 1);
        action(settings, 'Connected accounts', 476, 2);
        const saved = screen(
            1,
            'Saved state',
            'Changes previewed',
            'This is a demo. Your account has not changed.'
        );
        action(saved, 'Back to settings', 240, 0);
        const empty = screen(
            2,
            'Connections',
            'No connected accounts',
            'Connected services would appear here.'
        );
        action(empty, 'Back to settings', 240, 0);
    }

    return {
        name: `${template.name} starter`,
        shapes,
        shapesIds: Object.keys(shapes),
        frames,
        components,
        camera: { position: { ...CAMERA.position }, scale: CAMERA.scale }
    };
}

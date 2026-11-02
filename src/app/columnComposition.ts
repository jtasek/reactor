import { measureContextualText } from './textMeasurement';
import type { CompositionLibrary, ScreenComposition } from './screenComposition';

type TextContent = { text: string; fontSize: number; color: string };
type ControlContent = { componentId: string; label: string; placeholder: string };

export type ColumnComposition = Omit<ScreenComposition, 'texts' | 'controls' | 'rectangles'> & {
    padding: number;
    gap: number;
    content: Array<
        | ({ kind: 'text'; gapBefore?: number } & TextContent)
        | ({ kind: 'button' | 'input'; gapBefore?: number } & ControlContent)
    >;
    footer?: TextContent;
};

/** One-time authoring layout: ordinary editable artwork, with no new document schema. */
export function columnComposition(
    column: ColumnComposition,
    library: CompositionLibrary
): ScreenComposition {
    const { padding, gap, content, footer, ...screen } = column;
    const width = screen.width - padding * 2;
    if (width <= 0) {
        throw new Error('Screen padding must leave room for content.');
    }
    const texts: ScreenComposition['texts'] = [];
    const controls: ScreenComposition['controls'] = [];
    const textHeight = (item: TextContent) =>
        measureContextualText({
            value: item.text,
            fontSize: item.fontSize,
            wrapWidth: width,
            position: { x: 0, y: 0 }
        }).bounds.height;
    const end = content.reduce((bottom, item, index) => {
        const y = bottom + (item.gapBefore ?? (index === 0 ? 0 : gap));
        if (item.kind === 'text') {
            texts.push({
                text: item.text,
                fontSize: item.fontSize,
                color: item.color,
                x: padding,
                y,
                width
            });

            return y + textHeight(item);
        }
        const component = Object.hasOwn(library.components, item.componentId)
            ? library.components[item.componentId]
            : undefined;
        if (!component?.size) {
            throw new Error(`Use an available control with a known size: ${item.componentId}.`);
        }
        if (component.size.width > width) {
            throw new Error(
                `Control “${item.label}” needs ${component.size.width}px width. Reduce padding or increase the screen width; do not omit the control.`
            );
        }
        controls.push({
            componentId: item.componentId,
            label: item.label,
            placeholder: item.placeholder,
            x: padding,
            y
        });

        return y + component.size.height;
    }, padding);
    const footerY = footer ? screen.height - padding - textHeight(footer) : screen.height - padding;
    const limit = footer ? footerY - gap : footerY;
    if (end > limit) {
        throw new Error(
            `The content needs ${Math.ceil(end - limit)}px more height. Reduce gaps, padding or oversized fonts to fit all content; do not omit labels or controls.`
        );
    }
    if (footer) {
        texts.push({ ...footer, x: padding, y: footerY, width });
    }

    return { ...screen, texts, controls, rectangles: [] };
}

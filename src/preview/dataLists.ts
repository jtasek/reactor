import type { Document, InstanceShape, Shape, VariableContext } from '../app/types';
import type { PreviewNode } from './protocol';
import { dataRecords } from '../app/data';
import { recordOverrides } from '../app/dataLists';
import { projectGeometry } from '../app/contextualGeometry';
import { DEFAULT_TEXT_FONT_SIZE } from '../app/utils';
import { drawnBox } from '../app/membership';

/** Only rendered values cross the sandbox boundary; records stay in the editor. */
export function projectDataList(
    document: Document,
    instance: InstanceShape,
    key: string,
    modes: VariableContext,
    ancestors: ReadonlySet<string>,
    draw: (shape: Shape, path: string, recordId: string) => PreviewNode,
    report: (problem: string) => void
): PreviewNode {
    const binding = instance.dataList!;
    const records = dataRecords(document, binding.entityId);
    const context = instance.projectedSource?.context;
    const result = records.reduce<{ children: PreviewNode[]; height: number }>(
        (result, record, index) => {
            const localProblems: Record<string, string> = {};
            const { overrides, problems } = recordOverrides(document, instance, record, index + 1);
            problems.forEach(report);
            const item = projectGeometry(
                {
                    ...instance,
                    dataList: undefined,
                    projectedSource: undefined,
                    overrides
                },
                document,
                modes,
                context?.availableWidth,
                ancestors,
                localProblems,
                context?.widths
            );
            // The item template's own problems stop Preview, as they do for any instance.
            if (Object.keys(localProblems).length) {
                const message = Object.values(localProblems).join(' ');
                report(message);
                throw new Error(`${instance.name}: ${message}`);
            }
            const path = `${key}/record:${encodeURIComponent(record.id)}`;
            result.children.push({
                key: path,
                tag: 'g',
                attrs: { transform: `translate(0 ${result.height})` },
                children: [draw(item, path, record.id)]
            });
            result.height += drawnBox(item).height + binding.gap;

            return result;
        },
        { children: [], height: 0 }
    );
    if (!records.length) {
        result.children.push({
            key: `${key}/empty`,
            tag: 'text',
            attrs: {
                x: instance.position.x,
                y: instance.position.y + DEFAULT_TEXT_FONT_SIZE,
                'font-size': DEFAULT_TEXT_FONT_SIZE,
                fill: 'currentColor'
            },
            text: 'No records yet'
        });
    }

    return {
        key,
        tag: 'g',
        attrs: {},
        children: result.children,
        control: {
            role: 'list',
            label: document.dataEntities[binding.entityId].name,
            x: instance.position.x,
            y: instance.position.y,
            width: drawnBox(instance).width,
            height: result.height
        }
    };
}

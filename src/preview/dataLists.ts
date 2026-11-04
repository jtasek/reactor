import type { Document, InstanceShape, Shape, VariableContext } from '../app/types';
import type { PreviewNode } from './protocol';
import { dataRecords } from '../app/data';
import { dataListProblems, recordOverrides } from '../app/dataLists';
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
    draw: (shape: Shape, path: string, recordId: string) => PreviewNode
): PreviewNode {
    const binding = instance.dataList!;
    const problems = dataListProblems(document, instance, binding);
    if (problems.length) {
        throw new Error(problems.join(' '));
    }
    const records = dataRecords(document, binding.entityId);
    const context = instance.projectedSource?.context;
    const result = records.reduce<{ children: PreviewNode[]; height: number }>(
        (result, record) => {
            const localProblems: Record<string, string> = {};
            const item = projectGeometry(
                {
                    ...instance,
                    dataList: undefined,
                    projectedSource: undefined,
                    overrides: recordOverrides(document, instance, record)
                },
                document,
                modes,
                context?.availableWidth,
                ancestors,
                localProblems,
                context?.widths
            );
            if (Object.keys(localProblems).length) {
                throw new Error(Object.values(localProblems).join(' '));
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

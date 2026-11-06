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
    if (binding.mode === 'record') {
        const fallback = draw({ ...instance, dataList: undefined }, `${key}/unselected`, '');

        return {
            key,
            tag: 'g',
            attrs: {},
            children: [fallback],
            recordEntity: binding.entityId,
            records: Object.fromEntries(
                records.map((record, index) => [
                    record.id,
                    navigationRecord(
                        draw(
                            projectRecord(record, index),
                            `${key}/record:${encodeURIComponent(record.id)}`,
                            record.id
                        ),
                        binding.entityId,
                        record.id
                    )
                ])
            )
        };
    }
    function projectRecord(record: (typeof records)[number], index: number) {
        const localProblems: Record<string, string> = {};
        const { overrides, problems } = recordOverrides(document, instance, record, index + 1);
        problems.forEach(report);
        const item = projectGeometry(
            { ...instance, dataList: undefined, projectedSource: undefined, overrides },
            document,
            modes,
            context?.availableWidth,
            ancestors,
            localProblems,
            context?.widths
        );
        if (Object.keys(localProblems).length) {
            const message = Object.values(localProblems).join(' ');
            report(message);
            throw new Error(`${instance.name}: ${message}`);
        }

        return item;
    }
    const result = records.reduce<{ children: PreviewNode[]; height: number }>(
        (result, record, index) => {
            const item = projectRecord(record, index);
            const path = `${key}/record:${encodeURIComponent(record.id)}`;
            result.children.push({
                key: path,
                tag: 'g',
                attrs: { transform: `translate(0 ${result.height})` },
                children: [
                    navigationRecord(draw(item, path, record.id), binding.entityId, record.id)
                ]
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

/** A navigation carries only stable identity, never editable record data. */
function navigationRecord(node: PreviewNode, entityId: string, id: string): PreviewNode {
    if (node.control?.navigateTo && !node.control.record) {
        node.control.record = { entityId, id };
    }
    node.children?.forEach((child) => navigationRecord(child, entityId, id));
    Object.values(node.variants ?? {}).forEach((child) => navigationRecord(child, entityId, id));

    return node;
}

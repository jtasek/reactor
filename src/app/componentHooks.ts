import { useAppState } from './hooks';
import { selectedComponentContext } from './componentTree';
import {
    componentCandidates,
    componentLibraries,
    instanceProperties
} from './computed/componentPanels';

export const useInstanceProperties = () =>
    useAppState((state) => instanceProperties(state.currentDocument));

export const useComponentLibraries = () => useAppState(componentLibraries);

export const useComponentCandidates = (componentId: string) =>
    useAppState((state) => componentCandidates(state.currentDocument, componentId));

export const useSelectedComponentContext = () =>
    useAppState((state) =>
        selectedComponentContext(
            state.currentDocument,
            state.selectedComponent?.documentId === state.currentDocumentId
                ? state.selectedComponent
                : null
        )
    );

export const useComponentExposure = (componentId: string | null, shapeId: string | null) =>
    useAppState((state) => {
        if (!componentId || !shapeId) {
            return null;
        }
        const document = state.currentDocument;
        const component = document.components[componentId];
        const shape = document.shapes[shapeId];

        if (!component || !shape) {
            return null;
        }

        return {
            candidates: componentCandidates(document, componentId).filter(
                (candidate) => candidate.shapeId === shapeId
            ),
            props: component.props ?? [],
            disabled: Boolean(document.locked || component.locked || component.library)
        };
    });

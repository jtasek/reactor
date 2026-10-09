import { useAppState } from './hooks';
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

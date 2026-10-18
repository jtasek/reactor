import { isReadOnly } from 'src/app/documentAccess';
import { useAppState } from 'src/app/hooks';
import React, { FC } from 'react';

import {
    ApplicationBar,
    CommandBar,
    CommandLine,
    ContextMenu,
    ControlPanel,
    Components,
    DataView,
    DockablePanel,
    DocumentInfo,
    EditWithWords,
    Explorer,
    GroupPanel,
    LayerPanel,
    Layout,
    MenuBar,
    Minimap,
    Inspector,
    Stack,
    StatusBar,
    Stats,
    Canvas,
    ToolBar,
    PanelLayout,
    Variables
} from 'src/ui/components';
import { useActions } from 'src/app/hooks';
import { useAiEdit } from 'src/app/aiHooks';
import { ResetDocumentDialog } from 'src/ui/components/ResetDocumentDialog';
import { registerEditor } from './registerEditor';
import { Viewer } from './Viewer';

registerEditor();

export const Designer: FC = () => {
    const aiEdit = useAiEdit();
    const { closeAiEdit } = useActions();
    const readOnly = useAppState(isReadOnly);
    const checking = useAppState(
        (state) =>
            !state.documentAccess[state.currentDocumentId] ||
            state.documentAccess[state.currentDocumentId].role === 'unknown'
    );
    if (readOnly) return <Viewer checking={checking} />;

    return (
        <Layout>
            <ApplicationBar />
            <CommandBar />
            <CommandLine />
            <MenuBar />
            <Stack />
            <Canvas />
            <ContextMenu />
            <PanelLayout toolbar={<ToolBar />}>
                <DockablePanel
                    id="aiEdit"
                    title="AI chat"
                    docking="vertical"
                    visible={aiEdit !== undefined}
                    onClose={() => closeAiEdit()}
                >
                    <EditWithWords />
                </DockablePanel>
                <DockablePanel id="explorer" title="Explorer">
                    <Explorer />
                </DockablePanel>
                <DockablePanel id="controlPanel" title="Control Panel">
                    <ControlPanel />
                </DockablePanel>
                <DockablePanel id="components" title="Library" docking="vertical">
                    <Components />
                </DockablePanel>
                <DockablePanel id="inspector" title="Inspector" docking="vertical">
                    <Inspector />
                </DockablePanel>
                <DockablePanel id="layerPanel" title="Layers" docking="vertical">
                    <LayerPanel />
                </DockablePanel>
                <DockablePanel id="groupPanel" title="Groups" docking="vertical">
                    <GroupPanel />
                </DockablePanel>
                <DockablePanel id="miniMap" title="Minimap">
                    <Minimap />
                </DockablePanel>
                <DockablePanel id="documentInfo" title="Document Info">
                    <DocumentInfo />
                </DockablePanel>
                <DockablePanel id="dataView" title="Data View" docking="vertical">
                    <DataView />
                </DockablePanel>
                <DockablePanel id="stats" title="Stats" horizontalView={<Stats horizontal />}>
                    <Stats />
                </DockablePanel>
                <DockablePanel id="variables" title="Variables" docking="vertical">
                    <Variables />
                </DockablePanel>
            </PanelLayout>
            <StatusBar />
            <ResetDocumentDialog />
        </Layout>
    );
};

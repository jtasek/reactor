import React, { FC } from 'react';

import {
    CommandBar,
    CommandLine,
    ContextMenu,
    ControlPanel,
    Components,
    DataView,
    DockablePanel,
    DocumentInfo,
    Explorer,
    GroupPanel,
    LayerPanel,
    Layout,
    MenuBar,
    Minimap,
    Inspector,
    SideBar,
    Stack,
    StatusBar,
    Stats,
    Canvas,
    ToolBar,
    PanelLayout,
    Variables
} from 'src/ui/components';
import { ResetDocumentDialog } from 'src/ui/components/ResetDocumentDialog';
import { registerEditor } from './registerEditor';

registerEditor();

export const Designer: FC = () => (
    <Layout>
        <CommandBar />
        <CommandLine />
        <MenuBar />
        <Stack />
        <Canvas />
        <ContextMenu />
        <PanelLayout>
            <DockablePanel id="sideBar" title="Side Bar">
                <SideBar>
                    <ToolBar />
                    <Explorer />
                </SideBar>
            </DockablePanel>
            <DockablePanel id="controlPanel" title="Control Panel">
                <ControlPanel />
            </DockablePanel>
            <DockablePanel id="components" title="Components" docking="vertical">
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

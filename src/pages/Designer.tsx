import React, { FC } from 'react';

import {
    CommandBar,
    CommandLine,
    ContextMenu,
    ControlPanel,
    DataView,
    DockablePanel,
    DocumentInfo,
    Explorer,
    GroupPanel,
    LayerPanel,
    Layout,
    MenuBar,
    Minimap,
    Outline,
    Inspector,
    SideBar,
    Stack,
    StatusBar,
    Stats,
    Canvas,
    ToolBar,
    PanelLayout
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
                    <Explorer>
                        <Outline />
                    </Explorer>
                </SideBar>
            </DockablePanel>
            <DockablePanel id="controlPanel" title="Control Panel">
                <ControlPanel />
            </DockablePanel>
            <DockablePanel id="inspector" title="Inspector">
                <Inspector />
            </DockablePanel>
            <DockablePanel id="layerPanel" title="Layers">
                <LayerPanel />
            </DockablePanel>
            <DockablePanel id="groupPanel" title="Groups">
                <GroupPanel />
            </DockablePanel>
            <DockablePanel id="miniMap" title="Minimap">
                <Minimap />
            </DockablePanel>
            <DockablePanel id="documentInfo" title="Document Info">
                <DocumentInfo />
            </DockablePanel>
            <DockablePanel id="dataView" title="Data View">
                <DataView />
            </DockablePanel>
            <DockablePanel id="stats" title="Stats">
                <Stats />
            </DockablePanel>
        </PanelLayout>
        <StatusBar />
        <ResetDocumentDialog />
    </Layout>
);

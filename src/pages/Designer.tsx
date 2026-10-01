import React, { FC } from 'react';

import {
    CommandBar,
    CommandLine,
    ContextMenu,
    ControlPanel,
    DataView,
    DocumentInfo,
    Explorer,
    GroupPanel,
    LayerPanel,
    Layout,
    MenuBar,
    Minimap,
    NavBar,
    Outline,
    PropertyPanel,
    SearchBox,
    SideBar,
    Stack,
    StatusBar,
    Stats,
    Canvas,
    ToolBar
} from 'src/ui/components';

export const Designer: FC = () => (
    <Layout>
        <CommandBar />
        <CommandLine />
        <MenuBar />
        <SideBar>
            <ToolBar />
            <Explorer>
                <SearchBox />
                <Outline />
                <NavBar />
            </Explorer>
        </SideBar>
        <Stack />
        <Stats />
        <Canvas />
        <ContextMenu />
        <Minimap />
        <DataView />
        <DocumentInfo />
        <ControlPanel />
        <PropertyPanel />
        <LayerPanel />
        <GroupPanel />
        <StatusBar />
    </Layout>
);

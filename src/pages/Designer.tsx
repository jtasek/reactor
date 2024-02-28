import React, { FC } from 'react';

import {
  CommandBar,
  CommandLine,
  ContextMenu,
  ControlPanel,
  Cursor,
  DataView,
  Dialog,
  DocumentInfo,
  Explorer,
  GroupPanel,
  LayerPanel,
  Layout,
  MenuBar,
  Minimap,
  NavBar,
  PropertyPanel,
  SearchBox,
  SideBar,
  Stack,
  StatusBar,
  Stats,
  Canvas,
  Switch,
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
    {/* <Cursor /> */}
    {/* <Dialog
        description="Description"
        visible={true}
        title={'Tohle je modalni dialog'}
        // onCancel={() => alert('cancel')}
        //  onSubmit={() => alert('submit')}
      >
        <p>Nejake kecicky....</p>
      </Dialog> */}
    <StatusBar />
  </Layout>
);

import React, { FC } from 'react';

import { ConnectedCommandLine as CommandLine } from '../CommandLine';
import { ConnectedContextMenu as ContextMenu } from '../ContextMenu';
import { ConnectedControlPanel as ControlPanel } from '../ControlPanel';
import { ConnectedCursor as Cursor } from '../Cursor';
import { ConnectedDataView as DataView } from '../DataView';
import { Dialog } from '../Dialog';
import { ConnectedDocumentInfo as DocumentInfo } from '../DocumentInfo';
import { ConnectedExplorer as Explorer } from '../Explorer';
import { GroupPanelContainer as GroupPanel } from '../GroupPanel';
import { LayerPanelContainer as LayerPanel } from '../LayerPanel';
import { MenuBarContainer as MenuBar } from '../MenuBar';
import { MiniMapContainer as Minimap } from '../MiniMap';
import { NavBarContainer as NavBar } from '../NavBar';
// import { Overlay } from '../Overlay';
import { PropertyPanelContainer as PropertyPanel } from '../PropertyPanel';
import { SearchBoxContainer as SearchBox } from '../SearchBox';
import { SideBarContainer as SideBar } from '../SideBar';
import { StatusBarContainer as StatusBar } from '../StatusBar';
import { SurfaceContainer as Surface } from '../Surface';
import { Switch } from '../Switch';
import { ToolBarContainer as ToolBar } from '../ToolBar';
import { Layout } from './Layout';

export const LayoutContainer: FC = () => {
  return (
    <Layout>
      <MenuBar />
      <CommandLine />
      <Switch value={true} onChange={() => console.log('Testing switch')} />
      <SideBar>
        <ToolBar />
        <Explorer>
          <SearchBox />
          <NavBar />
        </Explorer>
      </SideBar>
      <Surface />
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
};

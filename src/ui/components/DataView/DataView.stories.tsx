import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { DataView, Props } from './DataView';

export default {
  title: 'Example/DataView',
  component: DataView
} as Meta;

const Template: Story<Props> = (args) => <DataView {...args} />;

export const Default = Template.bind({});
Default.args = {
  sources: ['source A', 'source B']
};

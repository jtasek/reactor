import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { ControlPanel, Props } from './ControlPanel';

export default {
  title: 'Example/ControlPanel',
  component: ControlPanel
} as Meta;

const Template: Story<Props> = (args) => <ControlPanel {...args} />;

export const Default = Template.bind({});
Default.args = {
  controls: [],
  onChange: () => {}
};

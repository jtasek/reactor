import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Ruler, Props } from './Ruler';
import { Orientation } from 'src/app/types';
import { createRuler } from 'src/app/factories';

export default {
  title: 'Example/Ruler',
  component: Ruler
} as Meta;

const Template: Story<Props> = (args) => <Ruler {...args} />;

export const Horizontal = Template.bind({});
Horizontal.args = {
  ruler: createRuler({ orientation: Orientation.Horizontal })
};

export const Vertical = Template.bind({});
Vertical.args = {
  ruler: createRuler({ orientation: Orientation.Vertical })
};

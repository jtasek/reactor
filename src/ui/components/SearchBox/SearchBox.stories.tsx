import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { SearchBox, Props } from './SearchBox';

export default {
  title: 'Example/SearchBox',
  component: SearchBox,
  argTypes: {
    backgroundColor: { control: 'color' }
  }
} as Meta;

const Template: Story<Props> = (args) => <SearchBox {...args} />;

export const Default = Template.bind({});
Default.args = {
  filter: 'Searched text'
};

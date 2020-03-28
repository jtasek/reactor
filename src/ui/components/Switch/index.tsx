import React from 'react';
import styles from './styles.css';

const Switch = ({ visible, onChangeHandler }) => (
  <label className={styles.switch + (visible ? ' ' + styles.selected : '')}>
    <input
      type="checkbox"
      name="distructionfreemode"
      checked={visible}
      onChange={function(e) {
        e.preventDefault();
        onChangeHandler();
      }}
    />
    <div className={styles.track}>
      <div className={styles.thumb} />
    </div>
  </label>
);

export default connect(
  {
    visible: state`distractionFreeMode`,
    onChangeHandler: signal`distructionFreeModeToggled`
  },
  Switch
);

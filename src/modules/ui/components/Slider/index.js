import React, { Component } from 'react'
import styles from './styles.css'

class Slider extends Component {
  constructor(props) {
    super(props)
    // this.state = {}
    this.onChange = this.onChange.bind(this)
  }

  onChange(e) {
    e.preventDefault()
    const value = parseFloat(e.target.value)
    if (this.props.value !== value) {
      this.props.onChange(value)
    } //this.setState({ value })
  }

  //   shouldComponentUpdate(nextProps, nextState) {
  //     const currentState =
  //       this.state && this.state.value ? this.state.value : this.props.value

  //     return currentState !== nextState.value
  //   }

  render() {
    const { min, max, step, start, value, onChange } = this.props

    return (
      <div className={styles.slider}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={this.onChange}
          //onChange={this.onChange}
        />
        <div className={styles.track}>
          <div
            className={styles.lower}
            style={{ flex: `${value / max} 1 0%` }}
          />
          <div
            className={styles.upper}
            style={{ flex: `${1 - value / max} 1 0%` }}
          />
        </div>
      </div>
    )
  }
}

export default Slider

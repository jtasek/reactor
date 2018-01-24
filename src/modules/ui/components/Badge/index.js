import React from 'react'

export default ({text, color, size}) => (
    <span style={{borderRadius: '50%', position: 'absolute', top: 0, right: 0, color: color, width: size, height: size}}>{text}</span>
)
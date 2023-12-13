import './Rabbit.css';
import React, { forwardRef, useRef, useState, useEffect, useMemo } from 'react';

function Rabbit({loggedIn, speaking, thinking, playerPanel, hide}) {
  
  var image = "https://storage.googleapis.com/rabbit-public/gif/rabbit_for_P_NotListening.gif";
  if (loggedIn && speaking) {
    image = "https://storage.googleapis.com/rabbit-public/gif/rabbit_for_P_Listening.gif"
  } else if (loggedIn) {
    image = "https://storage.googleapis.com/rabbit-public/gif/rabbit_for_P_Base.gif"
  }

  return (
    <div className="Rabbit" style={{
      position: 'absolute',
      width: '100vw',
      height: '100vh',
      top: playerPanel ? '-10vh' : '',
      transition: "all 0.2s linear",
      opacity: hide ? 0 : 1,
      margin: 'auto',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      // zIndex: 1,
    }}>
      <img style={{
          width: '400px',
          height: '400px',
          margin: 'auto',
        }} src={image} />
    </div>
  );
}

export default Rabbit;
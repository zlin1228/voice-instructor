import React, { useRef, useEffect } from 'react';
import './CanvasComponent.css';

const CanvasComponent = ({ imageUrl }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    const img = new Image();
    img.src = imageUrl;
    
    img.onload = () => {
      const canvasWidth = 400;
      const canvasHeight = Math.round(canvasWidth * 16 / 9);
      const imgWidth = img.width;
      const imgHeight = img.height;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const devicePixelRatio = window.devicePixelRatio || 1;
      const backingStorePixelRatio =
        context.webkitBackingStorePixelRatio ||
        context.mozBackingStorePixelRatio ||
        context.msBackingStorePixelRatio ||
        context.oBackingStorePixelRatio ||
        context.backingStorePixelRatio || 1;

      const ratio = devicePixelRatio / backingStorePixelRatio;

      if (devicePixelRatio !== backingStorePixelRatio) {
        canvas.width = canvasWidth * ratio;
        canvas.height = canvasHeight * ratio;
        canvas.style.width = canvasWidth + 'px';
        canvas.style.height = canvasHeight + 'px';
        context.scale(ratio, ratio);
      }

      const xOffset = (canvasWidth - imgWidth) / 2;
      const yOffset = (canvasHeight - imgHeight) / 2;

      context.drawImage(img, xOffset, yOffset, imgWidth, imgHeight);
    };
  }, [imageUrl]);

  return <canvas ref={canvasRef}></canvas>;
};

export default CanvasComponent;
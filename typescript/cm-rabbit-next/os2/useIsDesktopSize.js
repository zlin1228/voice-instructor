import React, { useEffect, useRef, useState, useCallback } from "react";

function testIsDesktop() {
  if (typeof window === "undefined") {
    return true;
  }
  return (
    window.innerWidth >= 300 &&
    window.innerHeight >= 500 &&
    window.innerWidth / window.innerHeight > 0.49 &&
    window.innerWidth / window.innerHeight < 2.99
  );
}

function useIsDesktopSize() {
  // Initialize the desktop size to an accurate value on initial state set
  const [isDesktopSize, setIsDesktopSize] = useState(testIsDesktop);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function autoResize() {
      setIsDesktopSize(testIsDesktop());
    }

    window.addEventListener("resize", autoResize);
    window.addEventListener("orientationchange", autoResize);

    // This is likely unnecessary, as the initial state should capture
    // the size, however if a resize occurs between initial state set by
    // React and before the event listener is attached, this
    // will just make sure it captures that.
    autoResize();

    // Return a function to disconnect the event listener
    return () => window.removeEventListener("resize", autoResize);
  }, []);

  return isDesktopSize;
}

export default useIsDesktopSize;

import React, { useEffect, useRef, useState, useCallback } from "react";
import styled from "styled-components";

export const FlexColumn = styled.div`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  user-select: none;
  position: relative;
`;

const SmallScreenPage = () => {
  return (
    <FlexColumn
      style={{
        position: "relative",
        width: "70%",
        height: "100%",
        margin: "0 auto",
        textTransform: "none",
        overflow: "hidden",
        alignItems: "center",
        textAlign: "center",
        marginTop: "50vh",
        fontFamily: 'bahnschrift',
      }}
    >
      <span
        style={{
          fontSize: "1.3em",
        }}
      >{`Please try viewing the page in portrait orientation and refresh.`}</span>
      <span
        style={{
          marginTop: "10px",
          fontSize: "0.7em",
        }}
        >{`OS2 requires a browser with a width greater than 300px and a height greater than 500px, and an aspect ratio between 0.5 and 3.`}</span>
    </FlexColumn>
  );
};

export default SmallScreenPage;

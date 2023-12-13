"use client"

import React, { useState, useEffect } from 'react';
import './Intro.css';
import { useRouter } from 'next/navigation'
import { untitledSansRegular, powerGroteskLight, powerGroteskRegular } from '../app/fonts/fonts';

const BASEURL = "https://storage.googleapis.com/quantum-engine-public"

const Intro = ({button}) => {
  const router = useRouter();
  //const [buttonEnabled, setButtonEnabled] = useState(false);
  const [language, setLanguage] = useState("en");

  const det = (e) => {
    return e === language ? "_selected" : "";
  }

  const handleClick = () => {
    router.push('/' + language);
  };

  const titleMap = () => {
    return language == "en" ? "hello" : "hello";
  }

  const sentenceOneMap = () => {
    return `
    This is the alpha preview of rabbit OS (version 1017), demonstrating its real-time conversation capabilities and several curated rabbits enabled by the Large Action Model.
    Our core experience, which will include the ability to "teach" the OS how to operate applications, will be made available on our dedicated hardware platform in a few months' time.
    After that, we will wind down and eventually shut off this web-based preview.
    `
  }
  const sentenceTwoMap = () => {
    return `
    Please note that you are interacting with an AI-enabled system, which may include outdated or inaccurate information. Anything the OS expresses does not reflect the values and opinions of those who created it.
    `
  }

  const buttonMap = () => {
    return language == "en" ? "Agree & Continue" : language == "cn" ? "同意并继续" : language == "jp" ? "同意して続行" : "동의하고 계속하기"
  }
  //useEffect(() => {
  //  const timer = setTimeout(() => {
  //    setButtonEnabled(true);
  //  }, 1500);
  //  return () => clearTimeout(timer);
  //}, []);
  //<img height={20} onClick={() => setLanguage("cn")} style={{cursor: "pointer", margin: 5}} src={BASEURL + "/buttons/Button_中文" + det("cn") +".png"} ></img>
  //<img height={20} onClick={() => setLanguage("jp")} style={{cursor: "pointer", margin: 5}} src={BASEURL + "/buttons/Button_日本語" + det("jp") +".png"} ></img>
  //<img height={20} onClick={() => setLanguage("kr")} style={{cursor: "pointer", margin: 5}} src={BASEURL + "/buttons/Button_한국어" + det("kr") +".png"} ></img>

  return (
    <div className={`container ${powerGroteskLight.className}`}>
      {button && <div className={`title ${powerGroteskLight.className}`}
        style={{
          fontSize: language == "en" ? "58pt" : "60pt",
          letterSpacing: "0.02em",
        }}
        >{titleMap()}</div>}
      <div className={`textbox ${untitledSansRegular.className}`}
        style={{
          letterSpacing: "-0.02em",
        }}
      >
        <span>{sentenceOneMap()}</span>
        <br /> <br />
        <span>{sentenceTwoMap()}</span>
        <br /> <br />
        <span>Enabled rabbits:</span>
        <br />
        <ul>
          <li>- Customization: referring to you by a different name, calling the OS by a different name, clearing conversation history, etc.</li>
          <li>- Searching for up-to-date information across multiple domains (e.g. news, weather, stocks, etc.)</li>
          <li>- Advanced reasoning</li>
          <li>- Streaming music with Spotify</li>
        </ul>
      </div>
      {button && <button 
        aria-label='agree and continue'
        style={{
          fontSize : language == "en" ? "12pt" : "10pt",
        }}
        className={`${powerGroteskRegular.className}`}
        onClick={handleClick}>{buttonMap()}</button>}
    </div>
  );
};

export default Intro;
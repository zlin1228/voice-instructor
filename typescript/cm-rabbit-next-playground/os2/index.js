import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import Intro from './Intro';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import {
    ClerkProvider,
    SignedIn,
    SignIn,
    SignedOut,
    SignUp,
    RedirectToSignIn,
} from "@clerk/clerk-react";

const clerkPubKey = "pk_live_Y2xlcmsucmFiYml0LnRlY2gk";

function ClerkProviderWithRoutes() {
  return (<Routes>
  <Route exact path="/" element={<Intro button={true} />} />
  <Route
    path="/:mode"
    element={ 
      <ClerkProvider 
        publishableKey={clerkPubKey} 
      >
        <SignedIn>
          <App />
        </SignedIn>
        <SignedOut>
          <RedirectToSignIn />
        </SignedOut>
      </ClerkProvider>
    }
  />
</Routes>);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <ClerkProviderWithRoutes style={{
      margin: 'auto',
    }} />
  </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

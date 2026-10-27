import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initMobileApp } from './mobileInit.js';

// Initialize native mobile features (status bar, splash, hardware back button)
initMobileApp();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

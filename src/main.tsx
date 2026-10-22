import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { initializeSpatialNavigation } from './platform/spatialNavigation';
import { ThemeProvider } from './contexts/ThemeContext';

initializeSpatialNavigation();

const root = document.getElementById('root');

if (!root) {
  throw new Error('B1O TV root element was not found.');
}

createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
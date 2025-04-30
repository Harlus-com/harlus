
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  createRoot(document.getElementById("root")!).render(<App />);
});

// Log a message when app is loaded
console.log('Equity AI Navigator application loaded');

// If running in Electron (will be defined by our preload script)
if (typeof window.electron !== 'undefined') {
  console.log('Running in Electron mode');
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Starting app...

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ Root element not found!');
  document.body.innerHTML = `
    <div style="padding: 40px; color: white; background: #1a1a1a; min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
      <h1 style="color: #ef4444;">Error: Root element not found</h1>
      <p>Make sure index.html has a div with id="root"</p>
    </div>
  `;
} else {
    // Root element found
  
  try {
    // Loading App component...
    const root = ReactDOM.createRoot(rootElement);
    // React root created
    
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // App rendered successfully
  } catch (error) {
    console.error('❌ Failed to render app:', error);
    rootElement.innerHTML = `
      <div style="padding: 40px; color: white; background: #1a1a1a; min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <h1 style="color: #ef4444; margin-bottom: 20px;">Error Loading Application</h1>
        <p style="color: #9ca3af; margin-bottom: 20px;">${error.message}</p>
        <pre style="background: #2a2a2a; padding: 20px; border-radius: 5px; overflow: auto; max-width: 800px; color: #fff;">
${error.stack}
        </pre>
      </div>
    `;
  }
}


import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Loading App component...

// Use relative imports to avoid alias resolution issues
import Home from './pages/Home.jsx';
import Game from './pages/Game.jsx';

// Components imported

function App() {
  // Rendering App...
  
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
      </Routes>
    </Router>
  );
}

export default App;


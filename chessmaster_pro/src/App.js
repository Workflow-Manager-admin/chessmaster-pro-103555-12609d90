import React from 'react';
import './App.css';
import ChessMasterPro from './ChessMasterPro';

function App() {
  return (
    <div className="app" style={{ background: '#f6f6fa', minHeight:'100vh' }}>
      <nav className="navbar" style={{ position: 'sticky', top:0, zIndex:11 }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div className="logo">
              <span className="logo-symbol" style={{color:'#E87A41'}}>*</span> ChessMaster Pro
            </div>
            <div>
              <a
                href="https://github.com/"
                style={{
                  color: '#fff',
                  background: '#2e2e2e',
                  padding: '8px 18px',
                  textDecoration: 'none',
                  fontWeight: 500,
                  borderRadius: 4,
                  border: '1px solid #b58863'
                }}
                target="_blank"
                rel="noopener noreferrer"
              >GitHub</a>
            </div>
          </div>
        </div>
      </nav>
      <main>
        <ChessMasterPro />
      </main>
    </div>
  );
}

export default App;
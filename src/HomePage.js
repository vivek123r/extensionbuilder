import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";
import BackgroundVideo from "./components/BackgroundVideo";

export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Create animated code lines in the background
    const createCodeLines = () => {
      const container = document.querySelector('.homepage-container');
      if (!container) return;
      
      // Clear existing code lines
      const existingLines = container.querySelectorAll('.code-line');
      existingLines.forEach(line => line.remove());
      
      const lines = [
        'const extension = new VSCodeExtension();',
        'extension.activate(context);',
        'vscode.window.showInformationMessage();',
        'commands.registerCommand("extension.command");',
        'async function getCompletions() { ... }',
        'export function deactivate() {}',
        'registerWebviewProvider();',
        'const config = workspace.getConfiguration();',
        'const tree = new TreeDataProvider();',
        'import * as vscode from "vscode";'
      ];
      
      for (let i = 0; i < 8; i++) {
        const codeLine = document.createElement('div');
        codeLine.className = 'code-line';
        
        // Random line of code
        const lineIndex = Math.floor(Math.random() * lines.length);
        codeLine.textContent = lines[lineIndex];
        
        // Random position and animation
        const posY = 10 + Math.random() * 80;
        const posX = Math.random() * 100;
        const opacity = 0.05 + Math.random() * 0.1;
        
        codeLine.style.top = `${posY}%`;
        codeLine.style.left = `${posX}%`;
        codeLine.style.opacity = opacity;
        codeLine.style.animationDelay = `${Math.random() * 10}s`;
        
        container.appendChild(codeLine);
      }
    };
    
    createCodeLines();
    const codeInterval = setInterval(createCodeLines, 20000);
    
    // Cleanup function
    return () => {
      clearInterval(codeInterval);
      const codeLines = document.querySelectorAll('.code-line');
      codeLines.forEach(line => line.remove());
    };
  }, []);

  return (
    <div className="homepage-container">
      <BackgroundVideo />
      
      <div className="tech-overlay"></div>
      
      <header className="homepage-header">
        <div className="logo">
          <span className="logo-icon">&lt;/&gt;</span>
          <span className="logo-text">ex<span className="logo-forge">forge</span></span>
        </div>
        <nav className="main-nav">
          <a href="#" className="nav-link">Home</a>
          <a href="#" className="nav-link">Platform</a>
          <a href="#" className="nav-link">Tools</a>
          <a href="#" className="nav-link">Extensions</a>
          <a href="#" className="nav-link">Docs</a>
        </nav>
        <button className="start-building-btn pulse-btn" onClick={() => navigate("/create")}>
          Start Building
          <span className="btn-glow"></span>
        </button>
      </header>

      <div className="hero-section">
        <div className="hero-content">
          <div className="tag-label">Extension Forge</div>
          <h1 className="hero-title">
            <span className="text-gradient">Forge Powerful</span> 
            <br />
            <span className="text-gradient-blue">Extensions</span>
            <br />
            <span className="text-gradient">With Modern Tools</span>
          </h1>
          
          <p className="hero-description">
            Build, test, and deploy browser extensions with ease. From concept to 
            Chrome Web Store, exforge provides the complete toolkit for extension
            developers with AI-powered assistance.
          </p>
          
          <div className="hero-buttons">
            <button 
              className="primary-btn glow-btn" 
              onClick={() => navigate("/create")}
            >
              Start Building
              <span className="btn-icon">→</span>
              <span className="btn-glow"></span>
            </button>
            
            <button 
              className="secondary-btn outline-btn"
              onClick={() => navigate("/modify")}
            >
              View Examples
              <span className="btn-border-glow"></span>
            </button>
          </div>
          
          <div className="tech-stats">
            <div className="stat">
              <span className="stat-number">100+</span>
              <span className="stat-label">API Integrations</span>
            </div>
            <div className="stat">
              <span className="stat-number">50k+</span>
              <span className="stat-label">Developers</span>
            </div>
            <div className="stat">
              <span className="stat-number">3M+</span>
              <span className="stat-label">Extensions Built</span>
            </div>
          </div>
        </div>
        
        <div className="feature-cards">
          <div className="feature-card glow-card">
            <div className="feature-icon code-icon">&lt;/&gt;</div>
            <div className="card-content">
              <h3>Visual Builder</h3>
              <p>Drag-and-drop interface for rapid extension development</p>
            </div>
            <div className="card-glow"></div>
          </div>
          
          <div className="feature-card glow-card">
            <div className="feature-icon tool-icon">⚙️</div>
            <div className="card-content">
              <h3>Advanced Tools</h3>
              <p>Built-in testing, debugging, and deployment tools</p>
            </div>
            <div className="card-glow"></div>
          </div>
          
          <div className="feature-card glow-card">
            <div className="feature-icon fast-icon">⚡</div>
            <div className="card-content">
              <h3>Lightning Fast</h3>
              <p>Hot reload, instant preview, and optimized workflows</p>
            </div>
            <div className="card-glow"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

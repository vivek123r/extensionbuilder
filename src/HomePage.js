import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";
import BackgroundVideo from "./components/BackgroundVideo";
import { useAuth } from "./contexts/AuthContext";

export default function HomePage() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
          <a href="#home" className="nav-link" onClick={(e) => scrollToSection(e, 'home')}>Home</a>
          <a href="#platform" className="nav-link" onClick={(e) => scrollToSection(e, 'platform')}>Platform</a>
          <a href="#tools" className="nav-link" onClick={(e) => scrollToSection(e, 'tools')}>Tools</a>
          <a href="#extensions" className="nav-link" onClick={(e) => scrollToSection(e, 'extensions')}>Extensions</a>
          <a href="#docs" className="nav-link" onClick={(e) => scrollToSection(e, 'docs')}>Docs</a>
        </nav>
        <div className="header-actions">
          {currentUser ? (
            <>
              <button 
                className="user-btn"
                onClick={() => navigate("/my-extensions")}
              >
                My Extensions
              </button>
              <button 
                className="start-building-btn pulse-btn" 
                onClick={() => navigate("/create-extension")}
              >
                Start Building
                <span className="btn-glow"></span>
              </button>
              <button 
                className="logout-btn"
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button 
                className="login-btn"
                onClick={() => navigate("/login")}
              >
                Login
              </button>
              <button 
                className="start-building-btn pulse-btn" 
                onClick={() => navigate("/signup")}
              >
                Sign Up
                <span className="btn-glow"></span>
              </button>
            </>
          )}
        </div>
      </header>

      <div id="home" className="hero-section">
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
              onClick={() => navigate(currentUser ? "/create-extension" : "/signup")}
            >
              {currentUser ? "Start Building" : "Get Started"}
              <span className="btn-icon">→</span>
              <span className="btn-glow"></span>
            </button>
            
            <button 
              className="secondary-btn outline-btn"
              onClick={() => navigate(currentUser ? "/my-extensions" : "/login")}
            >
              {currentUser ? "My Extensions" : "Login"}
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

      {/* Platform Section */}
      <section id="platform" className="content-section">
        <div className="section-container">
          <h2 className="section-title">🌐 Platform Overview</h2>
          <p className="section-subtitle">A complete ecosystem for extension development</p>
          
          <div className="platform-grid">
            <div className="platform-item">
              <div className="platform-icon">🤖</div>
              <h3>AI-Powered Generation</h3>
              <p>Leverage Xiaomi Mimo model for intelligent extension scaffolding with Chain-of-Thought reasoning</p>
            </div>
            <div className="platform-item">
              <div className="platform-icon">💾</div>
              <h3>Vector Database Storage</h3>
              <p>ChromaDB integration for context-aware modifications and semantic code search</p>
            </div>
            <div className="platform-item">
              <div className="platform-icon">🔄</div>
              <h3>Real-time Streaming</h3>
              <p>Server-Sent Events for live generation progress and instant feedback</p>
            </div>
            <div className="platform-item">
              <div className="platform-icon">🌍</div>
              <h3>Multi-Browser Support</h3>
              <p>Generate extensions for Chrome, Firefox, Edge, and Safari with proper manifest versions</p>
            </div>
            <div className="platform-item">
              <div className="platform-icon">☁️</div>
              <h3>Cloud Storage</h3>
              <p>Firebase Firestore integration for saving and syncing your extensions across devices</p>
            </div>
            <div className="platform-item">
              <div className="platform-icon">🔐</div>
              <h3>Secure Authentication</h3>
              <p>Firebase Authentication with email/password and social login support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="content-section">
        <div className="section-container">
          <h2 className="section-title">🛠️ Developer Tools</h2>
          <p className="section-subtitle">Everything you need to build professional extensions</p>
          
          <div className="tools-grid">
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon">✨</span>
                <h3>Extension Generator</h3>
              </div>
              <ul className="tool-features">
                <li>4-step wizard interface</li>
                <li>Smart permission suggestions</li>
                <li>Manifest V3 support</li>
                <li>Glass morphism UI templates</li>
              </ul>
            </div>
            
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon">🔧</span>
                <h3>Modification Engine</h3>
              </div>
              <ul className="tool-features">
                <li>Conversational modification interface</li>
                <li>Context-aware code changes</li>
                <li>Vector database retrieval</li>
                <li>Preserve existing functionality</li>
              </ul>
            </div>
            
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon">📦</span>
                <h3>Package Manager</h3>
              </div>
              <ul className="tool-features">
                <li>One-click ZIP download</li>
                <li>Automatic file organization</li>
                <li>Ready for browser upload</li>
                <li>Version control support</li>
              </ul>
            </div>
            
            
          </div>
        </div>
      </section>

      {/* Extensions Section */}
      <section id="extensions" className="content-section">
        <div className="section-container">
          <h2 className="section-title">🧩 Extension Templates</h2>
          <p className="section-subtitle">Pre-built templates to jumpstart your project</p>
          
          <div className="extensions-grid">
            <div className="extension-template">
              <div className="template-icon">🔖</div>
              <h3>Popup Extension</h3>
              <p>Click the extension icon to open a popup interface for quick interactions</p>
              <div className="template-tags">
                <span className="tag">UI</span>
                <span className="tag">Popup</span>
                <span className="tag">Storage</span>
              </div>
            </div>
            
            <div className="extension-template">
              <div className="template-icon">📄</div>
              <h3>Content Script</h3>
              <p>Modify web pages by injecting JavaScript and CSS into active tabs</p>
              <div className="template-tags">
                <span className="tag">DOM</span>
                <span className="tag">Injection</span>
                <span className="tag">Pages</span>
              </div>
            </div>
            
            <div className="extension-template">
              <div className="template-icon">⚙️</div>
              <h3>Background Service</h3>
              <p>Run persistent background tasks with service workers and event listeners</p>
              <div className="template-tags">
                <span className="tag">Workers</span>
                <span className="tag">Events</span>
                <span className="tag">API</span>
              </div>
            </div>
            
            <div className="extension-template">
              <div className="template-icon">🎨</div>
              <h3>DevTools Panel</h3>
              <p>Create custom DevTools panels for debugging and developer utilities</p>
              <div className="template-tags">
                <span className="tag">DevTools</span>
                <span className="tag">Debug</span>
                <span className="tag">Panel</span>
              </div>
            </div>
          </div>
          
          <div className="cta-box">
            <h3>Ready to build your extension?</h3>
            <button 
              className="cta-button" 
              onClick={() => navigate(currentUser ? "/create-extension" : "/signup")}
            >
              Get Started Now →
            </button>
          </div>
        </div>
      </section>

      {/* Docs Section */}
      <section id="docs" className="content-section">
        <div className="section-container">
          <h2 className="section-title">📚 Documentation</h2>
          <p className="section-subtitle">Learn how to build amazing extensions</p>
          
          <div className="docs-grid">
            <div className="doc-card">
              <h3>🚀 Quick Start</h3>
              <ol className="doc-steps">
                <li>Sign up for a free account</li>
                <li>Click "Create Extension" in the dashboard</li>
                <li>Fill in the 4-step wizard with your extension details</li>
                <li>Let AI generate your extension code</li>
                <li>Download the ZIP and load it in your browser</li>
              </ol>
            </div>
            
            <div className="doc-card">
              <h3>🔧 Key Features</h3>
              <ul className="doc-list">
                <li><strong>Agent Mode:</strong> Use LangGraph agent for advanced generation</li>
                <li><strong>Modifications:</strong> Chat with AI to modify existing extensions</li>
                <li><strong>Permissions:</strong> Automatic permission detection and configuration</li>
                <li><strong>Browser Support:</strong> Chrome, Firefox, Edge, Safari</li>
              </ul>
            </div>
            
            <div className="doc-card">
              <h3>📖 Architecture</h3>
              <ul className="doc-list">
                <li><strong>Frontend:</strong> React with Firebase Authentication</li>
                <li><strong>Backend:</strong> FastAPI with OpenRouter AI integration</li>
                <li><strong>Storage:</strong> Firestore + ChromaDB vector database</li>
                <li><strong>AI Model:</strong> Xiaomi Mimo v2 Flash</li>
              </ul>
            </div>
            
            <div className="doc-card">
              <h3>💡 Pro Tips</h3>
              <ul className="doc-list">
                <li>Use descriptive names and detailed descriptions for better AI results</li>
                <li>Enable Agent Mode for complex extensions with multiple files</li>
                <li>Review generated code before deploying to production</li>
                <li>Use the modification feature to iterate on your extension</li>
                <li>Test in multiple browsers for compatibility</li>
              </ul>
            </div>
          </div>
          
          <div className="tech-stack">
            <h3>Built with modern technologies:</h3>
            <div className="tech-badges">
              <span className="tech-badge">React</span>
              <span className="tech-badge">FastAPI</span>
              <span className="tech-badge">Firebase</span>
              <span className="tech-badge">ChromaDB</span>
              <span className="tech-badge">OpenRouter AI</span>
              <span className="tech-badge">Xiaomi Mimo</span>
              <span className="tech-badge">LangChain</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

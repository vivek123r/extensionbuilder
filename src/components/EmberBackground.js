import React, { useEffect } from 'react';

const EmberBackground = () => {
  // Array of code-like snippets for the floating code elements
  const codeSnippets = [
    'manifest.json',
    'background.js',
    'content_scripts: [...]',
    'chrome.runtime.sendMessage',
    'browser.tabs.query()',
    'permissions: ["storage"]',
    'action: { default_popup: "popup.html" }',
    'chrome.contextMenus.create',
    'browser.runtime.onInstalled',
    'executeScript({ file: "script.js" })',
    'window.addEventListener("message")',
    'const port = chrome.runtime.connect()',
    'browser.webRequest.onBeforeRequest',
    'content_security_policy',
    '<script type="module" src="app.js"></script>',
    'web_accessible_resources',
    'chrome.storage.local.get()',
    'firefox.browserAction.setBadgeText',
    'browser.notifications.create()',
  ];

  useEffect(() => {
    // Create floating embers
    const createEmbers = () => {
      const container = document.querySelector('.modify-extension');
      if (!container) return;
      
      // Remove any existing embers
      const existingEmbers = container.querySelectorAll('.background-ember');
      existingEmbers.forEach(ember => ember.remove());
      
      // Create new embers
      for (let i = 0; i < 15; i++) {
        const ember = document.createElement('div');
        ember.className = 'background-ember';
        
        // Random position and animation
        const startPosition = Math.random() * 100;
        const size = Math.random() * 3 + 1.5;
        const duration = Math.random() * 8 + 5;
        const delay = Math.random() * 10;
        
        ember.style.left = `${startPosition}%`;
        ember.style.width = `${size}px`;
        ember.style.height = `${size}px`;
        ember.style.animationDuration = `${duration}s`;
        ember.style.animationDelay = `${delay}s`;
        
        container.appendChild(ember);
      }
    };
    
    // Create floating code elements
    const createCodeElements = () => {
      const container = document.querySelector('.modify-extension');
      if (!container) return;
      
      // Remove any existing code elements
      const existingCode = container.querySelectorAll('.background-code');
      existingCode.forEach(el => el.remove());
      
      // Create new code elements
      for (let i = 0; i < 8; i++) {
        const codeElement = document.createElement('div');
        codeElement.className = 'background-code';
        
        // Select a random code snippet
        const snippetIndex = Math.floor(Math.random() * codeSnippets.length);
        codeElement.textContent = codeSnippets[snippetIndex];
        
        // Random position and animation
        const startPositionX = Math.random() * 100;
        const startPositionY = Math.random() * 100;
        const duration = Math.random() * 70 + 30;
        const delay = Math.random() * 20;
        const opacity = Math.random() * 0.15 + 0.05;
        
        codeElement.style.left = `${startPositionX}%`;
        codeElement.style.top = `${startPositionY}%`;
        codeElement.style.animationDuration = `${duration}s`;
        codeElement.style.animationDelay = `${delay}s`;
        codeElement.style.opacity = opacity;
        codeElement.style.color = 'rgba(255, 58, 47, 0.4)';
        codeElement.style.textShadow = '0 0 5px rgba(255, 58, 47, 0.2)';
        codeElement.style.fontSize = `${Math.random() * 4 + 10}px`;
        codeElement.style.zIndex = '-1';
        codeElement.style.position = 'absolute';
        codeElement.style.fontFamily = '"JetBrains Mono", monospace';
        codeElement.style.pointerEvents = 'none';
        codeElement.style.animation = `float ${duration}s linear ${delay}s infinite`;
        
        container.appendChild(codeElement);
      }
    };
    
    // Add CSS for animations
    const addStyles = () => {
      // Check if style already exists
      if (document.getElementById('ember-background-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'ember-background-styles';
      style.textContent = `
        @keyframes float {
          0% { transform: translateY(100%) translateX(0); opacity: 0; }
          10% { opacity: var(--opacity, 0.1); }
          90% { opacity: var(--opacity, 0.1); }
          100% { transform: translateY(-100vh) translateX(calc(var(--random, 0.5) * 100px - 50px)); opacity: 0; }
        }
        
        @keyframes rise {
          0% { transform: translateY(100%); opacity: 0.8; }
          100% { transform: translateY(-20px); opacity: 0; }
        }
        
        .background-ember {
          position: absolute;
          bottom: 0;
          width: 2px;
          height: 2px;
          background-color: #FF3A2F;
          border-radius: 50%;
          filter: blur(1px);
          box-shadow: 0 0 5px #FF3A2F, 0 0 10px #FF3A2F;
          z-index: -1;
          opacity: 0.7;
          animation: rise var(--duration, 7s) ease-out var(--delay, 0s) infinite;
          pointer-events: none;
        }
      `;
      
      document.head.appendChild(style);
    };
    
    // Initialize
    addStyles();
    createEmbers();
    createCodeElements();
    
    // Refresh embers and code elements periodically
    const emberInterval = setInterval(createEmbers, 10000);
    const codeInterval = setInterval(createCodeElements, 20000);
    
    return () => {
      clearInterval(emberInterval);
      clearInterval(codeInterval);
      
      // Clean up elements
      const container = document.querySelector('.modify-extension');
      if (container) {
        const embers = container.querySelectorAll('.background-ember');
        embers.forEach(ember => ember.remove());
        
        const codeElements = container.querySelectorAll('.background-code');
        codeElements.forEach(el => el.remove());
      }
      
      // Remove style element
      const styleElement = document.getElementById('ember-background-styles');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  return null; // This component doesn't render anything directly
};

export default EmberBackground;
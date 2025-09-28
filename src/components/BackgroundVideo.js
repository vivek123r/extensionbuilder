import React, { useState, useEffect } from 'react';
import './BackgroundVideo.css';
// Import the video with a simpler file name
import videoSource from '../assets/bg.mp4';

// Array of code-like snippets for the floating code elements
const codeSnippets = [
  '<div className="component">',
  'function createExtension() {',
  'const [state, setState] = useState();',
  'useEffect(() => { ... });',
  'return <Component />;',
  'import { vscode } from "vscode";',
  'export default function() {',
  'const api = await fetch("/api");',
  '<button onClick={handleClick}>',
  'extension.activate = (context) => {',
  '// TODO: Implement feature',
  'const response = await vscode.window',
  'commands.registerCommand',
  'npm install @types/vscode',
  'git commit -m "Add feature"',
  'class Extension {',
  'manifest.json',
  'console.log("Debug");',
  'export const provider = {',
];

const BackgroundVideo = () => {
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    // Create floating embers
    const createEmbers = () => {
      const container = document.querySelector('.video-background');
      if (!container) return;
      
      // Remove any existing embers
      const existingEmbers = container.querySelectorAll('.video-ember');
      existingEmbers.forEach(ember => ember.remove());
      
      // Create new embers
      for (let i = 0; i < 20; i++) {
        const ember = document.createElement('div');
        ember.className = 'video-ember';
        
        // Random position and animation
        const startPosition = Math.random() * 100;
        const size = Math.random() * 4 + 2;
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
      const container = document.querySelector('.video-background');
      if (!container) return;
      
      // Remove any existing code elements
      const existingCode = container.querySelectorAll('.code-element');
      existingCode.forEach(el => el.remove());
      
      // Create new code elements
      for (let i = 0; i < 10; i++) {
        const codeElement = document.createElement('div');
        codeElement.className = 'code-element';
        
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
        codeElement.style.color = 'rgba(255, 58, 47, 0.6)';
        codeElement.style.textShadow = '0 0 5px rgba(255, 58, 47, 0.3)';
        
        container.appendChild(codeElement);
      }
    };
    
    createEmbers();
    createCodeElements();
    
    // Refresh embers and code elements periodically
    const emberInterval = setInterval(createEmbers, 15000);
    const codeInterval = setInterval(createCodeElements, 30000);
    
    return () => {
      clearInterval(emberInterval);
      clearInterval(codeInterval);
      const embers = document.querySelectorAll('.video-ember');
      embers.forEach(ember => ember.remove());
      const codeElements = document.querySelectorAll('.code-element');
      codeElements.forEach(el => el.remove());
    };
  }, []);

  return (
    <div className="video-background">
      <video 
        autoPlay 
        loop 
        muted 
        playsInline
        onError={() => {
          console.error('Error loading video');
          setVideoError(true);
        }}
        src={videoSource}
        className="background-video"
      >
        Your browser does not support the video tag.
      </video>
      
      <div className="video-overlay"></div>
      
      {videoError && (
        <div className="video-error-message">
          Error loading video. Check console for details.
        </div>
      )}
    </div>
  );
};

export default BackgroundVideo;
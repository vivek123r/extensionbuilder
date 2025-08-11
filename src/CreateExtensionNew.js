import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import './CreateExtensionNew.css';

const CreateExtensionNew = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    version: "1.0.0",
    type: "popup",
    permissions: [],
    author: "",
    icon: null,
    targetBrowser: "chrome"
  });

  const [activeStep, setActiveStep] = useState(1);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const iconInputRef = useRef(null);

  const extensionTypes = [
    { value: 'popup', label: 'Browser Action Popup', description: 'Extension with a popup interface' },
    { value: 'content-script', label: 'Content Script', description: 'Modifies web pages directly' },
    { value: 'background', label: 'Background Service', description: 'Runs background tasks' },
    { value: 'devtools', label: 'Developer Tools', description: 'Extends browser dev tools' }
  ];

  const availablePermissions = [
    { id: 'activeTab', label: 'Active Tab', description: 'Access to the currently active tab' },
    { id: 'storage', label: 'Storage', description: 'Store and retrieve data' },
    { id: 'notifications', label: 'Notifications', description: 'Show desktop notifications' },
    { id: 'contextMenus', label: 'Context Menus', description: 'Add items to right-click menus' },
    { id: 'cookies', label: 'Cookies', description: 'Access and modify cookies' },
    { id: 'tabs', label: 'Tabs', description: 'Access to all browser tabs' },
    { id: 'bookmarks', label: 'Bookmarks', description: 'Access and modify bookmarks' },
    { id: 'history', label: 'History', description: 'Access browsing history' },
    { id: 'scripting', label: 'Scripting', description: 'Execute scripts in web pages' }
  ];

  const browsers = [
    { value: 'chrome', label: 'Chrome' },
    { value: 'firefox', label: 'Firefox' },
    { value: 'edge', label: 'Edge' },
    { value: 'safari', label: 'Safari' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (permissionId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const handleIconUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setFormData(prev => ({ ...prev, icon: file }));
    }
  };

  const aiDescription = async (currentDescription) => {
    if (!currentDescription.trim()) {
      alert("Please enter a description first!");
      return;
    }

    setIsAiLoading(true);
    setError(null);

    const apiKey = "AIzaSyBq23mkvFSmfqecjNgkfq9rA8V34nrE6Ng";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const prompt = `Based on the following extension description, generate a comprehensive list of specific tasks and features that this browser extension should include.

**Extension Description:** "${currentDescription}"

**Please provide:**
1. **Core Features** - Main functionality the extension should have
2. **User Interface Elements** - What UI components are needed
3. **Browser Integration** - How it interacts with the browser
4. **Data Management** - What data it stores/processes
5. **User Actions** - What users can do with the extension

**Format the response as a structured list with clear categories and bullet points.**

Example format:
## Core Features
• Feature 1 description
• Feature 2 description

## User Interface
• UI element 1
• UI element 2

## Browser Integration
• Integration 1
• Integration 2

## Data Management
• Data handling 1
• Data handling 2

## User Actions
• Action 1
• Action 2

Make the suggestions specific, actionable, and relevant to the described extension type.`;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);
      
      // Better response parsing with multiple fallbacks
      let aiSuggestions = null;
      
      if (data.candidates && data.candidates[0]) {
        const candidate = data.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
          aiSuggestions = candidate.content.parts[0].text;
        }
      }
      
      if (!aiSuggestions) {
        console.error('No AI suggestions found in response:', data);
        throw new Error('No suggestions received from AI');
      }
      
      // Update the description with AI suggestions
      setFormData(prev => ({ 
        ...prev, 
        description: prev.description + "\n\n--- AI SUGGESTIONS ---\n" + aiSuggestions 
      }));
      
      setError({ type: 'success', message: '✅ AI suggestions added successfully!' });
      setTimeout(() => setError(null), 3000);
      
    } catch (error) {
      console.error('AI Description Error:', error);
      setError({ type: 'error', message: '❌ Failed to get AI suggestions. Please try again.' });
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsAiLoading(false);
    }
  };

  const generateExtension = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const prompt = createDetailedPrompt();
      const response = await callGeminiAPI(prompt);
      
      if (response && response.code) {
        setGeneratedCode(response.code);
        setActiveStep(4);
      } else {
        throw new Error('Invalid response from API');
      }
    } catch (err) {
      setError(err.message || 'Failed to generate extension');
    } finally {
      setIsGenerating(false);
    }
  };

  const createDetailedPrompt = () => {
    return `Create a complete ${formData.targetBrowser} browser extension with the following specifications:

**Extension Details:**
- Name: ${formData.name}
- Description: ${formData.description}
- Version: ${formData.version}
- Type: ${formData.type}
- Author: ${formData.author}
- Target Browser: ${formData.targetBrowser}
- Permissions: ${formData.permissions.join(', ') || 'none'}

**Requirements:**
1. Generate a complete, production-ready extension
2. Include proper error handling and validation
3. Use modern JavaScript (ES6+) features
4. Add comprehensive comments explaining the code
5. Follow ${formData.targetBrowser} extension best practices
6. Include proper CSS styling for UI components
7. Implement proper event listeners and cleanup
8. Make the extension functional with real features
9. Add proper manifest structure for ${formData.targetBrowser}

**Return Format:**
Please return the code in the following JSON structure:
{
  "manifest": "// Complete manifest.json content as string",
  "popup": {
    "html": "// Complete popup.html content as string",
    "css": "// Complete popup.css content as string", 
    "js": "// Complete popup.js content as string"
  },
  "content": {
    "js": "// Content script content as string if applicable",
    "css": "// Content styles content as string if applicable"
  },
  "background": {
    "js": "// Background script content as string if applicable"
  },
  "options": {
    "html": "// Options page HTML content as string if applicable",
    "js": "// Options page JS content as string if applicable",
    "css": "// Options page CSS content as string if applicable"
  }
}

Make sure to:
- Create a manifest.json that follows the latest Chrome Extension Manifest V3 format
- Remove any icon references since no icon was provided
- Include actual functionality that works
- Add proper error handling
- Use clean, readable code with comments
- Make the UI responsive and user-friendly`;
  };

  const callGeminiAPI = async (prompt) => {
    const apiKey = "AIzaSyBq23mkvFSmfqecjNgkfq9rA8V34nrE6Ng";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Full API Response:', data);
    
    // Better response parsing with multiple fallbacks
    let responseText = null;
    
    if (data.candidates && data.candidates[0]) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
        responseText = candidate.content.parts[0].text;
      }
    }
    
    if (!responseText) {
      console.error('No response content found in:', data);
      throw new Error('No response content received from AI');
    }

    console.log('Response Text:', responseText);

    // Extract JSON from response with better regex
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                      responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText);
      throw new Error('Failed to parse API response - no JSON found');
    }

    let parsedCode;
    try {
      parsedCode = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Attempted to parse:', jsonMatch[1] || jsonMatch[0]);
      throw new Error('Failed to parse API response - invalid JSON');
    }
      
    // Remove icons from manifest if no icon provided
    if (!formData.icon && parsedCode.manifest) {
      try {
        const manifestObj = JSON.parse(parsedCode.manifest);
        if (manifestObj.icons) delete manifestObj.icons;
        if (manifestObj.action && manifestObj.action.default_icon) delete manifestObj.action.default_icon;
        if (manifestObj.browser_action && manifestObj.browser_action.default_icon) delete manifestObj.browser_action.default_icon;
        parsedCode.manifest = JSON.stringify(manifestObj, null, 2);
      } catch (e) {
        console.warn('Could not parse manifest to remove icons');
      }
    }
      
    return { code: parsedCode };
  };

  const downloadExtension = async () => {
    if (!generatedCode) return;

    const zip = new JSZip();
    
    // Add manifest
    if (generatedCode.manifest) {
      zip.file('manifest.json', generatedCode.manifest);
    }

    // Add popup files
    if (generatedCode.popup) {
      if (generatedCode.popup.html) zip.file('popup.html', generatedCode.popup.html);
      if (generatedCode.popup.css) zip.file('popup.css', generatedCode.popup.css);
      if (generatedCode.popup.js) zip.file('popup.js', generatedCode.popup.js);
    }

    // Add content scripts
    if (generatedCode.content) {
      if (generatedCode.content.js) zip.file('content.js', generatedCode.content.js);
      if (generatedCode.content.css) zip.file('content.css', generatedCode.content.css);
    }

    // Add background script
    if (generatedCode.background?.js) {
      zip.file('background.js', generatedCode.background.js);
    }

    // Add options page
    if (generatedCode.options) {
      if (generatedCode.options.html) zip.file('options.html', generatedCode.options.html);
      if (generatedCode.options.js) zip.file('options.js', generatedCode.options.js);
      if (generatedCode.options.css) zip.file('options.css', generatedCode.options.css);
    }

    // Generate ZIP file and download
    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${formData.name.replace(/\s+/g, '-').toLowerCase() || 'extension'}-files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating ZIP file:', error);
      alert('Error creating ZIP file. Please try again.');
    }
  };

  // Render methods for each step
  const renderStep1 = () => (
    <div className="step-content">
      <h3>Basic Information</h3>
      <div className="form-group">
        <label>Extension Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="My Awesome Extension"
          required
        />
      </div>
      
      <div className="form-group">
        <label>Description *</label>
        <div className="description-with-ai">
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Brief description of what your extension does (e.g., 'A productivity tool that blocks distracting websites')"
            rows="4"
            required
          />
          
          {/* AI Button with Loading State */}
          {isAiLoading ? (
            <div className="ai-loading">
              <div className="ai-spinner"></div>
              <span>Getting AI suggestions...</span>
            </div>
          ) : (
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={() => aiDescription(formData.description)}
              disabled={!formData.description.trim()}
              title="Get AI suggestions for features and tasks"
            >
              🤖 Get AI Feature Suggestions
            </button>
          )}
          
          {/* Success/Error Messages */}
          {error && (
            <div className={`ai-message ${error.type}`}>
              {error.message}
            </div>
          )}
        </div>
        <small className="help-text">
          💡 Enter a basic description, then click "Get AI Feature Suggestions" to get detailed feature recommendations
        </small>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Version</label>
          <input
            type="text"
            name="version"
            value={formData.version}
            onChange={handleInputChange}
            placeholder="1.0.0"
          />
        </div>
        
        <div className="form-group">
          <label>Author</label>
          <input
            type="text"
            name="author"
            value={formData.author}
            onChange={handleInputChange}
            placeholder="Your name"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Target Browser</label>
        <select name="targetBrowser" value={formData.targetBrowser} onChange={handleInputChange}>
          {browsers.map(browser => (
            <option key={browser.value} value={browser.value}>
              {browser.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="step-content">
      <h3>Extension Type & Configuration</h3>
      
      <div className="extension-types">
        {extensionTypes.map(type => (
          <div
            key={type.value}
            className={`type-card ${formData.type === type.value ? 'selected' : ''}`}
            onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
          >
            <h4>{type.label}</h4>
            <p>{type.description}</p>
          </div>
        ))}
      </div>

      <div className="form-group">
        <label>Extension Icon (Optional)</label>
        <input
          type="file"
          ref={iconInputRef}
          accept="image/*"
          onChange={handleIconUpload}
        />
        {formData.icon && (
          <div className="icon-preview">
            <img src={URL.createObjectURL(formData.icon)} alt="Icon preview" />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="step-content">
      <h3>Permissions</h3>
      <p>Select the permissions your extension needs:</p>
      
      <div className="permissions-grid">
        {availablePermissions.map(permission => (
          <div
            key={permission.id}
            className={`permission-card ${formData.permissions.includes(permission.id) ? 'selected' : ''}`}
            onClick={() => handlePermissionToggle(permission.id)}
          >
            <div className="permission-header">
              <h4>{permission.label}</h4>
              <div className={`checkbox ${formData.permissions.includes(permission.id) ? 'checked' : ''}`}>
                ✓
              </div>
            </div>
            <p>{permission.description}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep4 = () => {
    if (!generatedCode) {
      return (
        <div className="step-content">
          <h3>Generated Extension</h3>
          <div className="generation-status">
            {isGenerating ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Generating your extension...</p>
              </div>
            ) : (
              <div className="generate-section">
                <h4>Ready to Generate</h4>
                <p>Click the button below to generate your extension files with advanced AI-powered code generation.</p>
                <button className="btn btn-primary" onClick={generateExtension}>
                  🚀 Generate Extension
                </button>
              </div>
            )}
            
            {error && (
              <div className="error-message">
                <p>❌ {error}</p>
                <button className="btn btn-secondary" onClick={generateExtension}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Create array of generated files for carousel
    const generatedFiles = [];
    
    if (generatedCode.manifest) {
      generatedFiles.push({ name: 'manifest.json', content: generatedCode.manifest, icon: '📄' });
    }
    if (generatedCode.popup?.html) {
      generatedFiles.push({ name: 'popup.html', content: generatedCode.popup.html, icon: '🌐' });
    }
    if (generatedCode.popup?.css) {
      generatedFiles.push({ name: 'popup.css', content: generatedCode.popup.css, icon: '🎨' });
    }
    if (generatedCode.popup?.js) {
      generatedFiles.push({ name: 'popup.js', content: generatedCode.popup.js, icon: '⚡' });
    }
    if (generatedCode.content?.js) {
      generatedFiles.push({ name: 'content.js', content: generatedCode.content.js, icon: '📜' });
    }
    if (generatedCode.content?.css) {
      generatedFiles.push({ name: 'content.css', content: generatedCode.content.css, icon: '🎨' });
    }
    if (generatedCode.background?.js) {
      generatedFiles.push({ name: 'background.js', content: generatedCode.background.js, icon: '⚙️' });
    }
    if (generatedCode.options?.html) {
      generatedFiles.push({ name: 'options.html', content: generatedCode.options.html, icon: '🌐' });
    }
    if (generatedCode.options?.js) {
      generatedFiles.push({ name: 'options.js', content: generatedCode.options.js, icon: '⚡' });
    }
    if (generatedCode.options?.css) {
      generatedFiles.push({ name: 'options.css', content: generatedCode.options.css, icon: '🎨' });
    }

    const currentFile = generatedFiles[activeFileIndex] || generatedFiles[0];

    return (
      <div className="step-content full-screen">
        <div className="carousel-header">
          <h3>Generated Extension Files</h3>
          <div className="file-tabs">
            {generatedFiles.map((file, index) => (
              <button
                key={index}
                className={`file-tab ${activeFileIndex === index ? 'active' : ''}`}
                onClick={() => setActiveFileIndex(index)}
              >
                <span className="file-icon">{file.icon}</span>
                <span className="file-name">{file.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="carousel-container">
          <div className="carousel-navigation">
            <button 
              className="nav-btn prev-btn"
              onClick={() => setActiveFileIndex(prev => prev > 0 ? prev - 1 : generatedFiles.length - 1)}
              disabled={generatedFiles.length <= 1}
            >
              ←
            </button>
            
            <div className="file-display">
              <div className="file-header">
                <h4>{currentFile.icon} {currentFile.name}</h4>
                <span className="file-counter">{activeFileIndex + 1} / {generatedFiles.length}</span>
              </div>
              <div className="code-container">
                <pre className="code-display-horizontal">{currentFile.content}</pre>
              </div>
            </div>
            
            <button 
              className="nav-btn next-btn"
              onClick={() => setActiveFileIndex(prev => prev < generatedFiles.length - 1 ? prev + 1 : 0)}
              disabled={generatedFiles.length <= 1}
            >
              →
            </button>
          </div>
        </div>

        <div className="download-section-compact">
          <button className="btn btn-primary download-btn" onClick={downloadExtension}>
            📥 Download ZIP ({generatedFiles.length} files)
          </button>
          <div className="quick-instructions">
            <p>💡 Extract ZIP → Open Chrome Extensions → Enable Developer Mode → Load Unpacked</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="create-extension">
      <div className="header">
        <h1>Create Browser Extension</h1>
        <div className="progress-bar">
          {[1, 2, 3, 4].map(step => (
            <div
              key={step}
              className={`step ${activeStep >= step ? 'active' : ''} ${activeStep === step ? 'current' : ''}`}
            >
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="content">
        {activeStep === 1 && renderStep1()}
        {activeStep === 2 && renderStep2()}
        {activeStep === 3 && renderStep3()}
        {activeStep === 4 && renderStep4()}
      </div>

      <div className="navigation">
        {activeStep > 1 && (
          <button
            className="btn btn-secondary"
            onClick={() => setActiveStep(activeStep - 1)}
          >
            ← Previous
          </button>
        )}
        
        {activeStep < 4 && (
          <button
            className="btn btn-primary"
            onClick={() => setActiveStep(activeStep + 1)}
            disabled={
              (activeStep === 1 && (!formData.name || !formData.description)) ||
              (activeStep === 2 && !formData.type)
            }
          >
            Next →
          </button>
        )}
        
        <button
          className="btn btn-outline"
          onClick={() => navigate("/")}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default CreateExtensionNew;

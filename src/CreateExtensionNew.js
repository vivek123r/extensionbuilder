import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import './CreateExtensionNew.css';
import HyperspeedBackground from './components/HyperspeedBackground';
import StepTransition from './components/StepTransition';
import { useAuth } from './contexts/AuthContext';
import { saveExtension } from './services/extensionService';

const CreateExtensionNew = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
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
  
  // Streaming and animation states
  const [streamingText, setStreamingText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentAnimFileIndex, setCurrentAnimFileIndex] = useState(0);
  const [currentAnimText, setCurrentAnimText] = useState('');
  const [animationComplete, setAnimationComplete] = useState(false);
  const [animationFiles, setAnimationFiles] = useState([]);
  const [reasoningText, setReasoningText] = useState('');

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

    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
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

    // Add retry logic
    const maxRetries = 2;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`AI Description attempt ${retryCount + 1}/${maxRetries + 1}`);
        
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
          console.error(`AI Description API Error (Attempt ${retryCount + 1}/${maxRetries + 1}):`, response.status, errorText);
          
          // For 503 or 429 errors, we should retry
          if (response.status === 503 || response.status === 429) {
            retryCount++;
            if (retryCount > maxRetries) {
              throw new Error(`API Error: ${response.status}`);
            }
            
            // Exponential backoff: wait longer between each retry
            const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s
            console.log(`Server busy (${response.status}). Retrying in ${delay/1000}s...`);
            
            setError({
              type: 'warning',
              message: `Server busy. Retrying in ${delay/1000}s... (${retryCount}/${maxRetries + 1})`
            });
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
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
      
      // Success - exit the retry loop
      break;
      
    } catch (error) {
      console.error(`AI Description Error (Attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
      
      retryCount++;
      
      if (retryCount > maxRetries) {
        setError({ type: 'error', message: '❌ Failed to get AI suggestions: ' + error.message });
        setTimeout(() => setError(null), 5000);
        break;
      }
      
      // Exponential backoff for any error
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`Error occurred. Retrying in ${delay/1000}s...`);
      
      setError({
        type: 'warning',
        message: `Error: ${error.message}. Retrying in ${delay/1000}s... (${retryCount}/${maxRetries + 1})`
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    }
    
    setIsAiLoading(false);
  };

  // Helper function to get icon based on file extension
  const getFileIcon = (filename) => {
    if (filename.endsWith('.json')) return '📄';
    if (filename.endsWith('.html')) return '🌐';
    if (filename.endsWith('.css')) return '🎨';
    if (filename.endsWith('.js')) return '⚡';
    if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.svg')) return '🖼️';
    if (filename.endsWith('.md')) return '📝';
    return '📁';
  };

  const generateExtension = async () => {
    setIsGenerating(true);
    setError(null);
    setStreamingText('');
    setReasoningText('');
    setAnimationFiles([]);
    setAnimationComplete(false);
    setActiveStep(4); // Move to step 4 immediately to show streaming

    try {
      const prompt = createDetailedPrompt();
      console.log('Sending prompt to API...');
      const response = await callGeminiAPI(prompt);
      console.log('Generation complete, files received:', response);
      
      if (response && response.code) {
        // Validate that key components exist
        if (!response.code.manifest) {
          throw new Error('Generated code is missing manifest.json');
        }
        setGeneratedCode(response.code);
        setIsGenerating(false);
        setIsAnimating(false);
        setAnimationComplete(true);
        
        // Save extension to Firebase if user is logged in
        if (currentUser) {
          try {
            console.log('Attempting to save extension for user:', currentUser.uid);
            const extensionId = await saveExtension(currentUser.uid, {
              name: formData.name,
              description: formData.description,
              version: formData.version,
              type: formData.type,
              permissions: formData.permissions,
              author: formData.author,
              targetBrowser: formData.targetBrowser,
              generatedCode: response.code
            });
            console.log('Extension saved to database with ID:', extensionId);
          } catch (saveError) {
            console.error('Failed to save extension to database:', saveError);
          }
        }
      } else {
        throw new Error('Invalid response from API');
      }
    } catch (err) {
      setError({ 
        type: 'error',
        message: err.message || 'Failed to generate extension'
      });
      setIsGenerating(false);
      setIsAnimating(false);
    }
  };

  const createDetailedPrompt = () => {
    return `You are an expert browser extension developer. Create a professional, production-ready ${formData.targetBrowser} browser extension (Manifest V3).

=== EXTENSION SPECIFICATION ===
Name: ${formData.name}
Description: ${formData.description}
Version: ${formData.version}
Type: ${formData.type}
Permissions: ${formData.permissions.join(', ') || 'none'}
${formData.icon ? 'User Icon: Provided (include icon references in manifest)' : 'User Icon: NOT provided (do NOT include any icon references)'}

=== THINKING PHASE ===
Before writing code, think through:
1. What features does this extension need to fulfill the description?
2. What files are required? (manifest, popup, background, content scripts, styles, utilities)
3. How should files be organized? (use folders for clean structure)
4. What modern UI patterns will make this look professional?
5. What edge cases and error handling are needed?

=== REQUIREMENTS ===

**Functionality:**
- Fully functional, complete working code (NO placeholders, NO TODOs, NO "add your code here")
- All features described must actually work
- Proper error handling with user-friendly messages
- Form validation where needed
- Loading states for async operations
- Data persistence using chrome.storage when appropriate

**Modern UI/UX Design:**
- Clean, modern aesthetic with smooth transitions
- CSS custom properties (variables) for theming
- Flexbox/Grid for layouts
- Responsive design that works at different popup sizes
- Proper spacing, typography, and visual hierarchy
- Hover effects and micro-interactions
- Loading spinners/skeletons for async content
- Beautiful color scheme (dark mode friendly)
- Rounded corners, subtle shadows, smooth animations
- Icon usage from Unicode or CSS for visual elements

**Code Quality:**
- ES6+ JavaScript (const/let, arrow functions, async/await, destructuring)
- Modular, well-organized code
- Meaningful variable and function names
- Comments for complex logic only
- DRY principles - no repeated code

**File Structure:**
Create a professional file structure. Examples:
- manifest.json (root)
- popup/popup.html, popup/popup.css, popup/popup.js
- scripts/background.js, scripts/content.js (if needed)
- styles/common.css (shared styles if multiple pages)
- utils/storage.js, utils/api.js (utility modules if needed)

=== OUTPUT FORMAT ===
For EACH file, use this EXACT format:

FILE_START: manifest.json
{
  "manifest_version": 3,
  ...complete content...
}
FILE_END: manifest.json

FILE_START: popup/popup.html
<!DOCTYPE html>
<html>...complete content...</html>
FILE_END: popup/popup.html

=== CRITICAL RULES ===
1. ALWAYS include file extensions (.json, .html, .css, .js)
2. Use folder paths (popup/popup.html NOT just popup.html)
3. Every file referenced in manifest MUST be created
4. manifest.json MUST be valid JSON
${!formData.icon ? '5. DO NOT create icon files or add "icons" property to manifest - user has no icons' : '5. Include icon references in manifest'}
6. Create as many files as needed for a professional extension
7. CSS must be comprehensive - style EVERY element properly
8. JavaScript must have proper error handling

Now create a complete, professional ${formData.name} extension with all necessary files:`;
  };

  const callGeminiAPI = async (prompt) => {
    const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        console.log(`API attempt ${retryCount + 1}/${maxRetries + 1} with real-time streaming`);
        
        // Reset animation state for new attempt
        setIsAnimating(true);
        setAnimationFiles([]);
        setCurrentAnimFileIndex(0);
        setCurrentAnimText('');
        setStreamingText('');
        setReasoningText('');
        
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Extension Builder"
          },
          body: JSON.stringify({
            model: "xiaomi/mimo-v2-flash:free",
            messages: [
              {
                role: "system",
                content: `You are a senior browser extension developer with 10+ years experience. You create professional, production-ready extensions with beautiful modern UIs.

YOUR APPROACH:
1. First, analyze what the extension needs to do
2. Plan the file structure (use folders: popup/, scripts/, styles/)
3. Create comprehensive, fully-functional code
4. Design beautiful UIs with modern CSS (flexbox, grid, variables, animations)

OUTPUT FORMAT - Use EXACTLY this format for each file:
FILE_START: folder/filename.ext
[complete file content]
FILE_END: folder/filename.ext

MANDATORY RULES:
1. ALWAYS include file extensions (.json, .html, .css, .js)
2. Use folder paths (popup/popup.html, scripts/background.js)
3. Create ALL files needed - be thorough (typically 4-8 files for a good extension)
4. Every file in manifest.json MUST exist with complete code
5. NO placeholders, NO TODOs, NO incomplete code
6. CSS must be comprehensive - style every element beautifully
7. Use CSS custom properties, smooth transitions, hover effects
8. JavaScript must be ES6+ with proper error handling
${!formData.icon ? '9. DO NOT create icons or add "icons" to manifest - user has none' : '9. Include icon references'}`
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 24000,
            stream: true
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API Error (Attempt ${retryCount + 1}/${maxRetries + 1}):`, response.status, errorText);
          
          if (response.status === 503 || response.status === 429) {
            retryCount++;
            const delay = Math.pow(2, retryCount) * 1000;
            console.log(`Server busy (${response.status}). Retrying in ${delay/1000}s...`);
            
            setError({ 
              type: 'warning', 
              message: `Server busy. Retrying in ${delay/1000}s... (${retryCount}/${maxRetries + 1})`
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        // Handle streaming response with real-time file parsing
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let buffer = '';
        let currentFileName = null;
        let currentFileContent = '';
        const generatedFiles = [];
        const createdFileNames = new Set(); // Track created files to prevent duplicates
        let fileIndex = -1;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta || {};
                
                // Capture reasoning for display
                const reasoning = delta.reasoning || '';
                if (reasoning) {
                  setReasoningText(prev => prev + reasoning);
                }
                
                const content = delta.content || '';
                if (!content) continue;
                
                buffer += content;
                
                // Check for FILE_START marker - wait for complete filename (must have newline after)
                const startMatch = buffer.match(/FILE_START:\s*([^\n]+)\n/i);
                if (startMatch && !currentFileName) {
                  const newFileName = startMatch[1].trim();
                  
                  // Skip invalid or incomplete filenames
                  if (!newFileName || newFileName.length < 2 || newFileName.endsWith(':')) {
                    console.log(`⚠️ Skipping invalid filename: ${newFileName}`);
                    buffer = buffer.substring(startMatch.index + startMatch[0].length);
                    continue;
                  }
                  
                  // Skip if file already created
                  if (createdFileNames.has(newFileName)) {
                    console.log(`⚠️ Skipping duplicate file: ${newFileName}`);
                    buffer = buffer.substring(startMatch.index + startMatch[0].length);
                    continue;
                  }
                  
                  currentFileName = newFileName;
                  fileIndex++;
                  
                  console.log(`🔵 Creating file: ${currentFileName}`);
                  
                  // Add new file to animation state
                  setAnimationFiles(prev => [...prev, {
                    name: currentFileName,
                    icon: getFileIcon(currentFileName),
                    content: '',
                    complete: false
                  }]);
                  
                  setCurrentAnimFileIndex(fileIndex);
                  
                  // Remove everything up to and including FILE_START line
                  buffer = buffer.substring(startMatch.index + startMatch[0].length);
                  currentFileContent = '';
                  continue;
                }
                
                // Check for FILE_END marker
                const endMatch = buffer.match(/FILE_END:\s*([^\n]*)/i);
                if (endMatch && currentFileName) {
                  // Extract content before FILE_END and clean it
                  let contentBeforeEnd = buffer.substring(0, endMatch.index);
                  
                  // Remove any trailing whitespace but preserve intentional formatting
                  contentBeforeEnd = contentBeforeEnd.trimEnd();
                  
                  // Set final content (not append, use buffer as source of truth)
                  currentFileContent = contentBeforeEnd;
                  
                  // Update display with final content
                  setCurrentAnimText(currentFileContent);
                  setAnimationFiles(prev =>
                    prev.map((f, idx) =>
                      idx === fileIndex
                        ? { ...f, content: currentFileContent }
                        : f
                    )
                  );
                  
                  console.log(`✅ Completed file: ${currentFileName} (${currentFileContent.length} chars)`);
                  
                  // Mark file as created
                  createdFileNames.add(currentFileName);
                  
                  // Store completed file
                  generatedFiles.push({
                    name: currentFileName,
                    content: currentFileContent
                  });
                  
                  // Mark file as complete in UI
                  setAnimationFiles(prev => 
                    prev.map((f, idx) => 
                      idx === fileIndex
                        ? { ...f, content: currentFileContent, complete: true }
                        : f
                    )
                  );
                  
                  // Small pause between files for better UX
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Remove everything up to and including FILE_END line
                  const endLineEnd = buffer.indexOf('\n', endMatch.index);
                  buffer = endLineEnd >= 0 ? buffer.substring(endLineEnd + 1) : '';
                  currentFileName = null;
                  currentFileContent = '';
                  continue;
                }
                
                // Only accumulate content if we're in a file AND buffer has no pending markers
                if (currentFileName && !buffer.includes('FILE_START:') && !buffer.includes('FILE_END:')) {
                  // Use buffer as source of truth, not raw content
                  currentFileContent = buffer;
                  
                  // Update display in real-time
                  setCurrentAnimText(currentFileContent);
                  setAnimationFiles(prev =>
                    prev.map((f, idx) =>
                      idx === fileIndex
                        ? { ...f, content: currentFileContent }
                        : f
                    )
                  );
                } else if (!currentFileName && !buffer.includes('FILE_START:')) {
                  // Show other text in reasoning display
                  setStreamingText(prev => prev + content);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        console.log('✅ Stream complete. Files generated:', generatedFiles.length);
        
        // Store all files with full paths preserved
        const structuredCode = {
          allFiles: generatedFiles // Store all files with their full paths
        };
        
        // Also extract common files for backward compatibility
        generatedFiles.forEach(file => {
          const fileName = file.name.split('/').pop();
          
          // Handle manifest with or without .json extension
          if (fileName === 'manifest.json' || fileName === 'manifest') {
            structuredCode.manifest = file.content;
          } else if (fileName.startsWith('popup.')) {
            if (!structuredCode.popup) structuredCode.popup = {};
            const ext = fileName.split('.').pop();
            structuredCode.popup[ext] = file.content;
          } else if (fileName.startsWith('background.')) {
            if (!structuredCode.background) structuredCode.background = {};
            const ext = fileName.split('.').pop();
            structuredCode.background[ext] = file.content;
          } else if (fileName.startsWith('content.')) {
            if (!structuredCode.content) structuredCode.content = {};
            const ext = fileName.split('.').pop();
            structuredCode.content[ext] = file.content;
          } else if (fileName.startsWith('options.')) {
            if (!structuredCode.options) structuredCode.options = {};
            const ext = fileName.split('.').pop();
            structuredCode.options[ext] = file.content;
          }
        });
        
        if (!structuredCode.manifest) {
          throw new Error('No manifest.json was generated');
        }
        
        return { code: structuredCode };
      } catch (error) {
        console.error('Error in generation:', error);
        retryCount++;
        
        if (retryCount > maxRetries) {
          console.error('Max retries reached:', error);
          throw error;
        }
        
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Error occurred. Retrying in ${delay/1000}s... (${retryCount}/${maxRetries + 1})`);
        
        setError({
          type: 'warning',
          message: `Error: ${error.message}. Retrying in ${delay/1000}s... (${retryCount}/${maxRetries + 1})`
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Failed to generate extension after all retries');
  };

  const downloadExtension = async () => {
    if (!generatedCode) {
      setError({
        type: 'error',
        message: 'No extension code available for download. Please generate the extension first.'
      });
      return;
    }

    try {
      const zip = new JSZip();
    
    // Add all generated files with their full paths (including folders)
    if (generatedCode.allFiles && generatedCode.allFiles.length > 0) {
      generatedCode.allFiles.forEach(file => {
        console.log(`Adding to ZIP: ${file.name}`);
        zip.file(file.name, file.content);
      });
    } else {
      // Fallback to old structure if allFiles not available
      if (generatedCode.manifest) {
        zip.file('manifest.json', generatedCode.manifest);
      }

      if (generatedCode.popup) {
        if (generatedCode.popup.html) zip.file('popup.html', generatedCode.popup.html);
        if (generatedCode.popup.css) zip.file('popup.css', generatedCode.popup.css);
        if (generatedCode.popup.js) zip.file('popup.js', generatedCode.popup.js);
      }

      if (generatedCode.content) {
        if (generatedCode.content.js) zip.file('content.js', generatedCode.content.js);
        if (generatedCode.content.css) zip.file('content.css', generatedCode.content.css);
      }

      if (generatedCode.background?.js) {
        zip.file('background.js', generatedCode.background.js);
      }

      if (generatedCode.options) {
        if (generatedCode.options.html) zip.file('options.html', generatedCode.options.html);
        if (generatedCode.options.js) zip.file('options.js', generatedCode.options.js);
        if (generatedCode.options.css) zip.file('options.css', generatedCode.options.css);
      }
    }

      // Generate ZIP file and download
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
      setError({
        type: 'error',
        message: 'Error creating ZIP file. Please try again.'
      });
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
            <div className={`ai-message ${error.type || 'error'}`}>
              {typeof error === 'string' ? error : error.message}
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
    // Show real-time animation while generating
    if (isAnimating && animationFiles.length > 0) {
      const safeIndex = Math.min(currentAnimFileIndex, animationFiles.length - 1);
      const currentFile = animationFiles[safeIndex];
      
      return (
        <div className="step-content animation-view">
          <h3>✨ AI Creating Extension Files</h3>
          
          {reasoningText && (
            <div className="thinking-container">
              <div className="thinking-animation">
                <div className="thinking-dot"></div>
                <div className="thinking-dot"></div>
                <div className="thinking-dot"></div>
              </div>
              <h4 className="thinking-header">🧠 AI Reasoning</h4>
              <pre className="thinking-text-stream">{reasoningText}</pre>
            </div>
          )}
          
          <div className="animation-container">
            <div className="file-tree">
              <div className="file-tree-header">
                <span>📁 {formData.name || 'extension'}</span>
              </div>
              {animationFiles.map((file, index) => (
                <div 
                  key={`${index}-${file.name}`}
                  className={`file-tree-item ${index === safeIndex ? 'active' : ''} ${file.complete ? 'completed' : ''}`}
                >
                  <span className="file-icon">{file.icon}</span>
                  <span className="file-name">{file.name}</span>
                  {file.complete && <span className="check-mark">✓</span>}
                  {index === safeIndex && !file.complete && <span className="writing-indicator">...</span>}
                </div>
              ))}
            </div>
            
            <div className="code-editor">
              <div className="editor-header">
                <span className="editor-tab active">
                  {currentFile?.icon} {currentFile?.name}
                </span>
                <span className="editor-status">
                  {safeIndex + 1} / {animationFiles.length} files
                </span>
              </div>
              <pre className="editor-content">
                {currentAnimText}
                {!currentFile?.complete && <span className="typing-cursor">▌</span>}
              </pre>
            </div>
          </div>
        </div>
      );
    }
    
    if (!generatedCode) {
      return (
        <div className="step-content">
          <h3>Generated Extension</h3>
          <div className="generation-status">
            {isGenerating ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Generating your extension...</p>
                
                {streamingText && (
                  <div className="thinking-container">
                    <div className="thinking-animation">
                      <div className="thinking-dot"></div>
                      <div className="thinking-dot"></div>
                      <div className="thinking-dot"></div>
                    </div>
                    <h4 className="thinking-header">🧠 AI Reasoning</h4>
                    <pre className="thinking-text-stream">{streamingText}</pre>
                  </div>
                )}
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
              <div className={`error-message ${error.type === 'warning' ? 'warning' : error.type === 'success' ? 'success' : 'error'}`}>
                <p>{typeof error === 'string' ? error : error.message}</p>
                {(!error.type || error.type === 'error') && (
                  <button className="btn btn-secondary" onClick={generateExtension}>
                    Try Again
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Create array of generated files for carousel
    const generatedFiles = [];
    
    // Use allFiles if available (new format with folder paths)
    if (generatedCode.allFiles && generatedCode.allFiles.length > 0) {
      generatedCode.allFiles.forEach(file => {
        generatedFiles.push({
          name: file.name,
          content: file.content,
          icon: getFileIcon(file.name)
        });
      });
    } else {
      // Fallback to old structure
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

  // Track step transitions and direction
  const [stepTransition, setStepTransition] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState('forward');
  const [previousStep, setPreviousStep] = useState(1);

  // Function to handle step changes with transition effect
  const handleStepChange = (newStep) => {
    // Determine direction
    const direction = newStep > activeStep ? 'forward' : 'backward';
    setTransitionDirection(direction);
    
    // Save current step as previous before changing
    setPreviousStep(activeStep);
    
    // Trigger the transition effect
    setStepTransition(true);
    
    // Change the step immediately - animation will handle the visual transition
    setActiveStep(newStep);
    
    // Reset the transition flag after animation completes
    setTimeout(() => {
      setStepTransition(false);
    }, 2500); // Increased duration to match longer CSS transitions
  };

  return (
    <div className="create-extension">
      <HyperspeedBackground stepTransition={stepTransition} />
      <StepTransition 
        isActive={stepTransition} 
        direction={transitionDirection}
        currentStep={activeStep}
        previousStep={previousStep}
      />
      <div className="header">
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
        <div className={`step-content step-1 ${activeStep === 1 ? 'active' : ''}`} 
             style={{
               display: activeStep === 1 || previousStep === 1 ? 'flex' : 'none',
               flexDirection: 'column', 
               alignItems: 'stretch', 
               height: '100%',
               position: 'absolute',
               top: 0,
               left: 0,
               width: '100%'
             }}>
          {renderStep1()}
        </div>
        <div className={`step-content step-2 ${activeStep === 2 ? 'active' : ''}`} 
             style={{
               display: activeStep === 2 || previousStep === 2 ? 'flex' : 'none',
               flexDirection: 'column', 
               alignItems: 'stretch', 
               height: '100%',
               position: 'absolute',
               top: 0,
               left: 0,
               width: '100%'
             }}>
          {renderStep2()}
        </div>
        <div className={`step-content step-3 ${activeStep === 3 ? 'active' : ''}`} 
             style={{
               display: activeStep === 3 || previousStep === 3 ? 'flex' : 'none',
               flexDirection: 'column', 
               alignItems: 'stretch', 
               height: '100%',
               position: 'absolute',
               top: 0,
               left: 0,
               width: '100%'
             }}>
          {renderStep3()}
        </div>
        <div className={`step-content step-4 ${activeStep === 4 ? 'active' : ''}`} 
             style={{
               display: activeStep === 4 || previousStep === 4 ? 'flex' : 'none',
               flexDirection: 'column', 
               alignItems: 'stretch', 
               height: '100%',
               position: 'absolute',
               top: 0,
               left: 0,
               width: '100%'
             }}>
          {renderStep4()}
        </div>
      </div>

      <div className="navigation">
        {activeStep > 1 && (
          <button
            className="btn btn-secondary"
            onClick={() => handleStepChange(activeStep - 1)}
          >
            ← Previous
          </button>
        )}
        
        {activeStep < 4 && (
          <button
            className="btn btn-primary"
            onClick={() => handleStepChange(activeStep + 1)}
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

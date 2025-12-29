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
  const animationFiles = [
    { name: 'manifest.json', icon: '📄', key: 'manifest' },
    { name: 'popup.html', icon: '🌐', key: 'popup.html' },
    { name: 'popup.css', icon: '🎨', key: 'popup.css' },
    { name: 'popup.js', icon: '⚡', key: 'popup.js' },
    { name: 'content.js', icon: '📜', key: 'content.js' },
    { name: 'background.js', icon: '⚙️', key: 'background.js' },
    { name: 'options.html', icon: '🌐', key: 'options.html' }
  ];

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

  const startCodeAnimation = async (code) => {
    setIsAnimating(true);
    setCurrentAnimFileIndex(0);
    setAnimationComplete(false);
    
    const filesToAnimate = animationFiles.filter(file => {
      if (file.key === 'manifest') return code.manifest;
      if (file.key === 'popup.html') return code.popup?.html;
      if (file.key === 'popup.css') return code.popup?.css;
      if (file.key === 'popup.js') return code.popup?.js;
      if (file.key === 'content.js') return code.content?.js;
      if (file.key === 'background.js') return code.background?.js;
      if (file.key === 'options.html') return code.options?.html;
      return false;
    });
    
    for (let i = 0; i < filesToAnimate.length; i++) {
      setCurrentAnimFileIndex(i);
      const file = filesToAnimate[i];
      let content = '';
      
      if (file.key === 'manifest') content = code.manifest;
      else if (file.key === 'popup.html') content = code.popup?.html;
      else if (file.key === 'popup.css') content = code.popup?.css;
      else if (file.key === 'popup.js') content = code.popup?.js;
      else if (file.key === 'content.js') content = code.content?.js;
      else if (file.key === 'background.js') content = code.background?.js;
      else if (file.key === 'options.html') content = code.options?.html;
      
      // Animate character by character (30 chars at a time for speed)
      for (let j = 0; j < content.length; j += 30) {
        setCurrentAnimText(content.substring(0, j + 30));
        await new Promise(resolve => setTimeout(resolve, 2));
      }
      setCurrentAnimText(content);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    setIsAnimating(false);
    setAnimationComplete(true);
  };

  const generateExtension = async () => {
    setIsGenerating(true);
    setError(null);
    setStreamingText('');

    try {
      const prompt = createDetailedPrompt();
      console.log('Sending prompt to API...');
      const response = await callGeminiAPI(prompt);
      console.log('API response received:', response);
      
      if (response && response.code) {
        // Validate that key components exist
        if (!response.code.manifest) {
          throw new Error('Generated code is missing manifest.json');
        }
        setGeneratedCode(response.code);
        setIsGenerating(false);
        
        // Start typewriter animation
        await startCodeAnimation(response.code);
        
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
        
        setActiveStep(4);
      } else {
        throw new Error('Invalid response from API');
      }
    } catch (err) {
      setError({ 
        type: 'error',
        message: err.message || 'Failed to generate extension'
      });
      setIsGenerating(false);
    }
  };

  const createDetailedPrompt = () => {
    return `Create a ${formData.targetBrowser} browser extension (Manifest V3):

Name: ${formData.name}
Description: ${formData.description}
Version: ${formData.version}
Type: ${formData.type}
Permissions: ${formData.permissions.join(', ') || 'none'}

Requirements:
- Complete working code (no TODOs or placeholders)
- Modern, beautiful UI design
- Proper error handling and validation
- Valid Manifest V3 format


Decide which files are needed based on the extension functionality. Return JSON format:
\`\`\`json
{
  "manifest": "{\\"manifest_version\\": 3, ...}",
  "popup": { "html": "...", "css": "...", "js": "..." },
  "background": { "js": "..." },
  "content": { "js": "...", "css": "..." },
  "options": { "html": "...", "js": "...", "css": "..." }
}
\`\`\`

CRITICAL: Every file you reference in manifest.json MUST have its complete code included in the JSON response above. If manifest references "background.js", include "background": { "js": "complete code here" }.`;
  };

  const callGeminiAPI = async (prompt) => {
    const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    
    const maxRetries = 3;
    let retryCount = 0;
    let parsedCode = null;

    while (retryCount <= maxRetries) {
      try {
        console.log(`API attempt ${retryCount + 1}/${maxRetries + 1} with streaming`);
        
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
                content: "You are an expert browser extension developer. CRITICAL: If you reference a file in manifest.json (like background.js, content.js, etc.), you MUST include that file's complete code in your response. Analyze requirements and decide which files are needed. Create production-ready code with beautiful, modern UI. Return complete working code - no placeholders. Always ensure every file referenced in manifest exists in your response."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.6,
            max_tokens: 16000,
            top_p: 0.95,
            frequency_penalty: 0.2,
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

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        
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
                
                // Display reasoning and content as they stream
                const reasoning = delta.reasoning || delta.reasoning_details?.[0]?.text || '';
                const content = delta.content || '';
                
                if (reasoning) {
                  setStreamingText(prev => (prev || '') + reasoning);
                }
                
                if (content && !reasoning) {
                  setStreamingText(prev => (prev || '') + content);
                }
                
                if (content) {
                  fullText += content;
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        console.log('Stream complete, parsing response...');
        const responseText = fullText;
        
        if (!responseText) {
          console.error('No response content received');
          throw new Error('No response content received from AI');
        }

        console.log('Parsing response text...');
        
        // Try multiple extraction methods to find the JSON
        let jsonString = null;
        // Reset parsedCode for this attempt
        parsedCode = null;
        
        // Method 1: Extract from code blocks with ```json markers
        const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonString = codeBlockMatch[1].trim();
          console.log('Extracted JSON from code block');
          
          try {
            parsedCode = JSON.parse(jsonString);
            console.log('Successfully parsed JSON from code block');
            break; // Success - exit the retry loop
          } catch (e) {
            console.error('Failed to parse JSON from code block:', e);
            // Continue to next extraction method
          }
        }
        
        // Method 2: Look for the largest JSON object in the response
        const jsonObjectMatch = responseText.match(/(\{[\s\S]*\})/);
        if (jsonObjectMatch && jsonObjectMatch[1]) {
          // Clean up excessive whitespace that might be causing parsing issues
          let jsonString = jsonObjectMatch[1].trim();
          
          // Remove excessive newlines and whitespace padding in the JSON
          jsonString = jsonString.replace(/\n{3,}/g, '\n\n');
          
          console.log('Extracted JSON object pattern');
          
          try {
            parsedCode = JSON.parse(jsonString);
            console.log('Successfully parsed JSON object');
            break; // Success - exit the retry loop
          } catch (e) {
            console.error('Failed to parse JSON object:', e);
            
            // Additional attempt: Try to fix common JSON parsing issues
            try {
              // Try to fix truncated strings
              const fixedJson = jsonString.replace(/([^\\])(")([^,:}\]]*$)/gm, '$1$2');
              parsedCode = JSON.parse(fixedJson);
              console.log('Successfully parsed JSON after fixing truncated strings');
              break; // Success - exit the retry loop
            } catch (e2) {
              console.error('Failed second parsing attempt:', e2);
            }
          }
        }
        
        // Method 3: Try to extract and construct a partial JSON
        if (!parsedCode) {
          console.log('Attempting to extract partial JSON components...');
          
          // Extract manifest.json section
          const manifestMatch = responseText.match(/"manifest"\s*:\s*"((?:\\"|[^"])*?)"/);
          // Extract popup HTML section
          const popupHtmlMatch = responseText.match(/"html"\s*:\s*"((?:\\"|[^"])*?)"/);
          // Extract popup CSS section
          const popupCssMatch = responseText.match(/"css"\s*:\s*"((?:\\"|[^"])*?)"/);
          // Extract popup JS section
          const popupJsMatch = responseText.match(/"js"\s*:\s*"((?:\\"|[^"])*?)"/);
          
          // If we have at least the manifest, we can try to construct a partial response
          if (manifestMatch && manifestMatch[1]) {
            try {
              const partialObj = {
                manifest: manifestMatch[1].replace(/\\\\n/g, '\\n')
              };
              
              // Add popup components if found
              if (popupHtmlMatch && popupCssMatch && popupJsMatch) {
                partialObj.popup = {
                  html: popupHtmlMatch[1].replace(/\\\\n/g, '\\n'),
                  css: popupCssMatch[1].replace(/\\\\n/g, '\\n'),
                  js: popupJsMatch[1].replace(/\\\\n/g, '\\n')
                };
              }
              
              console.log('Created partial JSON from extracted components');
              parsedCode = partialObj;
              break; // Success - exit the retry loop
            } catch (e) {
              console.error('Failed to create partial JSON:', e);
            }
          }
        }
        
        // If we've tried all methods and still failed
        if (!parsedCode) {
          retryCount++;
          if (retryCount > maxRetries) {
            console.error('All JSON parsing methods failed on final attempt');
            throw new Error('Failed to parse API response - invalid JSON');
          }
          
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`JSON parsing failed. Retrying in ${delay/1000}s...`);
          
          setError({
            type: 'warning',
            message: `Response format issue. Retrying in ${delay/1000}s... (${retryCount}/${maxRetries + 1})`
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } catch (error) {
        retryCount++;
        
        if (retryCount > maxRetries) {
          console.error('Max retries reached:', error);
          throw error;
        }
        
        // Exponential backoff for any error
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Error occurred. Retrying in ${delay/1000}s... (${retryCount}/${maxRetries + 1})`);
        
        // Show retry message in UI
        setError({
          type: 'warning',
          message: `Error: ${error.message}. Retrying in ${delay/1000}s... (${retryCount}/${maxRetries + 1})`
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Check if parsedCode is null
    if (!parsedCode) {
      throw new Error('Unable to generate code. Please try again.');
    }
    
    // Unescape JSON strings function
    const unescapeJsonString = (str) => {
      if (!str) return str;
      try {
        // If it's already valid JSON/HTML/CSS/JS, return as is
        if (!str.includes('\\n') && !str.includes('\\"')) {
          return str;
        }
        // Replace escaped newlines and quotes
        return str
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\');
      } catch (e) {
        return str;
      }
    };
    
    // Unescape all code strings
    if (parsedCode.manifest) {
      parsedCode.manifest = unescapeJsonString(parsedCode.manifest);
    }
    if (parsedCode.popup) {
      if (parsedCode.popup.html) parsedCode.popup.html = unescapeJsonString(parsedCode.popup.html);
      if (parsedCode.popup.css) parsedCode.popup.css = unescapeJsonString(parsedCode.popup.css);
      if (parsedCode.popup.js) parsedCode.popup.js = unescapeJsonString(parsedCode.popup.js);
    }
    if (parsedCode.content) {
      if (parsedCode.content.js) parsedCode.content.js = unescapeJsonString(parsedCode.content.js);
      if (parsedCode.content.css) parsedCode.content.css = unescapeJsonString(parsedCode.content.css);
    }
    if (parsedCode.background?.js) {
      parsedCode.background.js = unescapeJsonString(parsedCode.background.js);
    }
    if (parsedCode.options) {
      if (parsedCode.options.html) parsedCode.options.html = unescapeJsonString(parsedCode.options.html);
      if (parsedCode.options.js) parsedCode.options.js = unescapeJsonString(parsedCode.options.js);
      if (parsedCode.options.css) parsedCode.options.css = unescapeJsonString(parsedCode.options.css);
    }
    
    // Remove icons from manifest if no icon provided
    if (!formData.icon && parsedCode && parsedCode.manifest) {
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
    if (!generatedCode) {
      setError({
        type: 'error',
        message: 'No extension code available for download. Please generate the extension first.'
      });
      return;
    }

    try {
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
    // Show typewriter animation
    if (isAnimating || (generatedCode && !animationComplete)) {
      const filesToShow = animationFiles.filter(file => {
        if (file.key === 'manifest') return generatedCode?.manifest;
        if (file.key === 'popup.html') return generatedCode?.popup?.html;
        if (file.key === 'popup.css') return generatedCode?.popup?.css;
        if (file.key === 'popup.js') return generatedCode?.popup?.js;
        if (file.key === 'content.js') return generatedCode?.content?.js;
        if (file.key === 'background.js') return generatedCode?.background?.js;
        if (file.key === 'options.html') return generatedCode?.options?.html;
        return false;
      });
      
      // Safety check: ensure we have files to show and valid index
      if (filesToShow.length === 0) {
        return (
          <div className="step-content">
            <h3>⚠️ No Files Generated</h3>
            <p>The AI didn't generate any files. Please try again.</p>
          </div>
        );
      }
      
      const safeIndex = Math.min(currentAnimFileIndex, filesToShow.length - 1);
      const currentFile = filesToShow[safeIndex];
      
      // Safety check: ensure currentFile exists
      if (!currentFile) {
        return (
          <div className="step-content">
            <h3>⚠️ Animation Error</h3>
            <p>Could not load file animation. Please try again.</p>
          </div>
        );
      }
      
      return (
        <div className="step-content animation-view">
          <h3>✨ Creating Extension Files</h3>
          
          <div className="animation-container">
            <div className="file-tree">
              <div className="file-tree-header">
                <span>📁 {formData.name || 'extension'}</span>
              </div>
              {filesToShow.map((file, index) => (
                <div 
                  key={file.name}
                  className={`file-tree-item ${index === safeIndex ? 'active' : ''} ${index < safeIndex ? 'completed' : ''}`}
                >
                  <span className="file-icon">{file.icon}</span>
                  <span className="file-name">{file.name}</span>
                  {index < safeIndex && <span className="check-mark">✓</span>}
                  {index === safeIndex && <span className="writing-indicator">...</span>}
                </div>
              ))}
            </div>
            
            <div className="code-editor">
              <div className="editor-header">
                <span className="editor-tab active">
                  {currentFile.icon} {currentFile.name}
                </span>
                <span className="editor-status">
                  {safeIndex + 1} / {filesToShow.length} files
                </span>
              </div>
              <pre className="editor-content">
                {currentAnimText}
                <span className="typing-cursor">▌</span>
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

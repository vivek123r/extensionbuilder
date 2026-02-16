import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import JSZip from 'jszip';
import './CreateExtensionNew.css';
import HyperspeedBackground from './components/HyperspeedBackground';
import StepTransition from './components/StepTransition';
import { useAuth } from './contexts/AuthContext';
import { saveExtension, updateExtension } from './services/extensionService';
import { checkAgentHealth, generateWithAgent, convertAgentFilesToCode, modifyWithAgent } from './services/agentService';

/**
 * ============================================
 * CreateExtensionNew Component
 * Main 4-step wizard for creating browser extensions
 * Flow: Basic Info -> Type & Config -> Permissions -> Generation
 * ============================================
 */
const CreateExtensionNew = () => {
  // === Hooks ===
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  
  // === Form State - User input for extension configuration ===
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

  // === UI State ===
  const [activeStep, setActiveStep] = useState(1); // Current step in wizard (1-4)
  const [generatedCode, setGeneratedCode] = useState(null); // Final generated extension files
  const [isGenerating, setIsGenerating] = useState(false); // API call in progress
  const [error, setError] = useState(null); // Error messages
  const [activeFileIndex, setActiveFileIndex] = useState(0); // Currently viewed file in carousel
  const [isAiLoading, setIsAiLoading] = useState(false); // AI feature suggestions loading
  const iconInputRef = useRef(null);
  
  // === Real-time Streaming & Animation States - for displaying generation progress ===
  const [streamingText, setStreamingText] = useState(''); // Raw API response text
  const [isAnimating, setIsAnimating] = useState(false); // File generation animation playing
  const [currentAnimFileIndex, setCurrentAnimFileIndex] = useState(0); // Current file in animation
  const [currentAnimText, setCurrentAnimText] = useState(''); // Content of current file being displayed
  const [animationComplete, setAnimationComplete] = useState(false); // Generation finished
  const [animationFiles, setAnimationFiles] = useState([]); // All files in animation
  const [reasoningText, setReasoningText] = useState(''); // AI reasoning/thinking process
  
  // === Agent Mode States ===
  const [useAgent, setUseAgent] = useState(false); // Toggle for using LangGraph agent
  const [agentAvailable, setAgentAvailable] = useState(false); // Is agent server running
  const [agentStatus, setAgentStatus] = useState('checking'); // 'checking', 'available', 'unavailable'
  
  // === Modification States ===
  const [projectId, setProjectId] = useState(''); // Project ID for vector DB
  const [modificationInput, setModificationInput] = useState(''); // User's modification request
  const [isModifying, setIsModifying] = useState(false); // Currently modifying
  const [conversationHistory, setConversationHistory] = useState([]); // Chat history for context
  const [loadedExtensionId, setLoadedExtensionId] = useState(null); // Track which extension is loaded

  // Check agent availability on mount
  useEffect(() => {
    const checkAgent = async () => {
      setAgentStatus('checking');
      const isAvailable = await checkAgentHealth();
      setAgentAvailable(isAvailable);
      setAgentStatus(isAvailable ? 'available' : 'unavailable');
    };
    checkAgent();
  }, []);

  // Load existing extension if passed via navigation state
  useEffect(() => {
    const existingExtension = location.state?.existingExtension;
    if (existingExtension) {
      console.log('Loading existing extension for modification:', existingExtension);
      
      // Populate form data
      setFormData({
        name: existingExtension.name || "",
        description: existingExtension.description || "",
        version: existingExtension.version || "1.0.0",
        type: existingExtension.type || "popup",
        permissions: existingExtension.permissions || [],
        author: existingExtension.author || "",
        icon: null,
        targetBrowser: existingExtension.targetBrowser || "chrome"
      });
      
      // Load conversation history if available
      if (existingExtension.conversationHistory) {
        setConversationHistory(existingExtension.conversationHistory);
        console.log('📜 Loaded conversation history:', existingExtension.conversationHistory.length, 'messages');
      }
      
      // Track extension ID for saving updates
      if (existingExtension.id) {
        setLoadedExtensionId(existingExtension.id);
      }
      
      // Populate generated code
      if (existingExtension.generatedCode) {
        setGeneratedCode(existingExtension.generatedCode);
        
        // Convert code to animation files format
        const files = [];
        const code = existingExtension.generatedCode;
        
        console.log('Loading extension with code structure:', Object.keys(code));
        
        // First try to use allFiles if it exists
        if (code.allFiles && Array.isArray(code.allFiles) && code.allFiles.length > 0) {
          console.log('Using allFiles array:', code.allFiles.length, 'files');
          code.allFiles.forEach(file => {
            if (file.name && file.content) {
              files.push({
                name: file.name,
                icon: getFileIcon(file.name),
                content: file.content,
                complete: true
              });
            }
          });
        } else {
          // Fallback to structured format
          console.log('Using structured format');
          
          if (code.manifest) {
            files.push({
              name: 'manifest.json',
              icon: '📄',
              content: typeof code.manifest === 'string' ? code.manifest : JSON.stringify(code.manifest, null, 2),
              complete: true
            });
          }
          
          if (code.popup?.html) {
            files.push({
              name: 'popup/popup.html',
              icon: '🌐',
              content: code.popup.html,
              complete: true
            });
          }
          
          if (code.popup?.css) {
            files.push({
              name: 'popup/popup.css',
              icon: '🎨',
              content: code.popup.css,
              complete: true
            });
          }
          
          if (code.popup?.js) {
            files.push({
              name: 'popup/popup.js',
              icon: '⚡',
              content: code.popup.js,
              complete: true
            });
          }
          
          if (code.content?.js) {
            files.push({
              name: 'scripts/content.js',
              icon: '📜',
              content: code.content.js,
              complete: true
            });
          }
          
          if (code.content?.css) {
            files.push({
              name: 'styles/content.css',
              icon: '🎨',
              content: code.content.css,
              complete: true
            });
          }
          
          if (code.background?.js) {
            files.push({
              name: 'scripts/background.js',
              icon: '⚙️',
              content: code.background.js,
              complete: true
            });
          }
          
          if (code.options?.html) {
            files.push({
              name: 'options/options.html',
              icon: '🌐',
              content: code.options.html,
              complete: true
            });
          }
          
          if (code.options?.js) {
            files.push({
              name: 'options/options.js',
              icon: '⚡',
              content: code.options.js,
              complete: true
            });
          }
          
          if (code.options?.css) {
            files.push({
              name: 'options/options.css',
              icon: '🎨',
              content: code.options.css,
              complete: true
            });
          }
        }
        
        console.log('Loaded', files.length, 'files for modification');
        setAnimationFiles(files);
        setAnimationComplete(true);
        
        // Set first file as active
        if (files.length > 0) {
          setCurrentAnimFileIndex(0);
          setCurrentAnimText(files[0].content);
        }
        
        // Jump to step 4 to show the workspace - also set previousStep to 4 to avoid showing step 1 content
        setActiveStep(4);
        setPreviousStep(4);
        
        // Enable agent mode for modifications
        if (agentAvailable) {
          setUseAgent(true);
        }
        
        setReasoningText('✅ Extension loaded successfully! You can now modify it using the chat below.\n\n💡 Try asking for changes like:\n- "Add dark mode support"\n- "Improve the styling"\n- "Add error handling"\n');
      }
    }
  }, [location.state, agentAvailable]);

  // ============================================
  // CONFIGURATION DATA
  // ============================================
  
  // Extension type options available to users
  const extensionTypes = [
    { value: 'popup', label: 'Browser Action Popup', description: 'Extension with a popup interface' },
    { value: 'content-script', label: 'Content Script', description: 'Modifies web pages directly' },
    { value: 'background', label: 'Background Service', description: 'Runs background tasks' },
    { value: 'devtools', label: 'Developer Tools', description: 'Extends browser dev tools' }
  ];

  // Browser permissions user can request for their extension
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

  // Target browser options for extension compatibility
  const browsers = [
    { value: 'chrome', label: 'Chrome' },
    { value: 'firefox', label: 'Firefox' },
    { value: 'edge', label: 'Edge' },
    { value: 'safari', label: 'Safari' }
  ];

  // ============================================
  // EVENT HANDLERS
  // ============================================

  // Update form data when user types in input/textarea fields
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Toggle permission selection when user clicks permission card
  const handlePermissionToggle = (permissionId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  // Handle editing file content - updates both animationFiles and generatedCode
  const handleFileContentEdit = (fileIndex, newContent) => {
    // Update animation files (used during generation)
    setAnimationFiles(prev => 
      prev.map((f, idx) => 
        idx === fileIndex ? { ...f, content: newContent } : f
      )
    );
    
    // Update current animation text if this is the active file
    if (fileIndex === currentAnimFileIndex) {
      setCurrentAnimText(newContent);
    }
    
    // Update generated code (used after generation is complete)
    if (generatedCode) {
      setGeneratedCode(prev => {
        if (prev.allFiles && prev.allFiles.length > 0) {
          const updatedAllFiles = prev.allFiles.map((f, idx) => 
            idx === fileIndex ? { ...f, content: newContent } : f
          );
          return { ...prev, allFiles: updatedAllFiles };
        }
        return prev;
      });
    }
  };

  // Handle icon file upload with image type validation
  const handleIconUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setFormData(prev => ({ ...prev, icon: file }));
    }
  };

  // ============================================
  // AI ENHANCEMENT - FEATURE SUGGESTIONS
  // ============================================
  
  // Get AI-powered feature suggestions based on extension description
  // Uses Gemini API with retry logic and exponential backoff for resilience
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

    // Configure retry logic with exponential backoff (2s, 4s, 8s waits)
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

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  // Get emoji icon based on file extension for visual identification in UI
  const getFileIcon = (filename) => {
    if (filename.endsWith('.json')) return '📄';
    if (filename.endsWith('.html')) return '🌐';
    if (filename.endsWith('.css')) return '🎨';
    if (filename.endsWith('.js')) return '⚡';
    if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.svg')) return '🖼️';
    if (filename.endsWith('.md')) return '📝';
    return '📁';
  };

  // ============================================
  // EXTENSION GENERATION - MAIN ORCHESTRATION
  // ============================================

  // Main orchestrator for extension generation
  // Coordinates: prompt creation → API call → file storage → Firebase save
  const generateExtension = async () => {
    setIsGenerating(true);
    setError(null);
    setStreamingText('');
    setReasoningText('');
    setAnimationFiles([]);
    setAnimationComplete(false);
    setActiveStep(4); // Move to step 4 immediately to show streaming
    setPreviousStep(4); // Also set previousStep to avoid showing previous step content

    // Use agent mode if enabled and available
    if (useAgent && agentAvailable) {
      await generateWithAgentMode();
      return;
    }

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
        // Keep workspace view visible - files are in animationFiles with complete: true
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
              generatedCode: response.code,
              conversationHistory: [],  // Initialize empty conversation history
              projectId: ''  // Will be set on first modification
            });
            console.log('Extension saved to database with ID:', extensionId);
            setLoadedExtensionId(extensionId);  // Track for future modifications
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
      // Keep animating true if we have files to show
      if (animationFiles.length === 0) {
        setIsAnimating(false);
      }
    }
  };

  // ============================================
  // AGENT-BASED GENERATION
  // ============================================

  // Generate extension using the LangGraph agent with streaming
  const generateWithAgentMode = async () => {
    console.log('🤖 Using LangGraph Agent for generation...');
    setIsAnimating(true);
    setReasoningText('');

    let fileIndex = -1;

    try {
      await generateWithAgent(formData, {
        onStart: (data) => {
          setReasoningText(prev => prev + `🚀 ${data.message}\n`);
        },
        
        onThinking: (text) => {
          setReasoningText(prev => prev + `${text}\n`);
        },
        
        onToolCall: (data) => {
          const argsStr = JSON.stringify(data.args).substring(0, 80);
          setReasoningText(prev => prev + `🔧 ${data.tool}(${argsStr}...)\n`);
        },
        
        onToolResult: (data) => {
          setReasoningText(prev => prev + `   ✓ ${data.result}\n`);
        },
        
        onFileStart: (data) => {
          fileIndex++;
          console.log(`📄 Agent creating: ${data.file}`);
          
          // Add file to animation (initially empty)
          setAnimationFiles(prev => [...prev, {
            name: data.file,
            icon: getFileIcon(data.file),
            content: '',
            complete: false
          }]);
          
          setCurrentAnimFileIndex(fileIndex);
          setCurrentAnimText('');
        },
        
        onFileContent: (data) => {
          // Update file content in real-time
          setCurrentAnimText(data.content);
          setAnimationFiles(prev => 
            prev.map((f, idx) => 
              f.name === data.file ? { ...f, content: data.content } : f
            )
          );
        },
        
        onFileComplete: (data) => {
          console.log(`✅ Agent completed: ${data.file}`);
          
          // Mark file as complete
          setAnimationFiles(prev => 
            prev.map(f => 
              f.name === data.file 
                ? { ...f, content: data.content, complete: true }
                : f
            )
          );
        },
        
        onComplete: async (data) => {
          console.log('✅ Agent generation complete:', data.files?.length, 'files');
          setReasoningText(prev => prev + `\n✅ ${data.summary || 'Generation complete!'}\n`);
          
          // Store project ID for future modifications
          if (data.project_id) {
            setProjectId(data.project_id);
          }
          
          // Convert agent files to extension code format
          const code = convertAgentFilesToCode(data.files || []);
          
          if (!code.manifest && !code.allFiles?.some(f => f.name.includes('manifest'))) {
            throw new Error('Agent did not generate manifest.json');
          }
          
          setGeneratedCode(code);
          setIsGenerating(false);
          // Keep isAnimating true so workspace view stays visible
          // Files are already in animationFiles with complete: true
          setAnimationComplete(true);
          
          // Save to Firebase if logged in
          if (currentUser) {
            try {
              console.log('Saving agent-generated extension for user:', currentUser.uid);
              await saveExtension(currentUser.uid, {
                name: formData.name,
                description: formData.description,
                version: formData.version,
                type: formData.type,
                permissions: formData.permissions,
                author: formData.author,
                targetBrowser: formData.targetBrowser,
                generatedCode: code
              });
              console.log('Extension saved to database');
            } catch (saveError) {
              console.error('Failed to save extension:', saveError);
            }
          }
        },
        
        onError: (error) => {
          console.error('Agent error:', error);
          setReasoningText(prev => prev + `\n❌ Error: ${error.message}\n`);
          setError({
            type: 'error',
            message: `Agent error: ${error.message}`
          });
          setIsGenerating(false);
          setIsAnimating(false);
        }
      });
      
    } catch (err) {
      console.error('Agent generation failed:', err);
      setError({
        type: 'error',
        message: `Agent generation failed: ${err.message}. Try disabling Agent Mode.`
      });
      setIsGenerating(false);
      setIsAnimating(false);
    }
  };

  // Handle extension modification using AI agent
  const handleModifyExtension = async () => {
    if (!modificationInput.trim() || isModifying) return;
    
    console.log('🔧 Modifying extension with request:', modificationInput);
    setIsModifying(true);
    setAnimationComplete(false);  // Reset to show progress
    
    // Add user message to chat and conversation history
    const userMessage = {
      role: 'user',
      content: modificationInput,
      timestamp: new Date().toISOString()
    };
    
    console.log('💬 Adding user message to history:', userMessage);
    setConversationHistory(prev => [...prev, userMessage]);
    setReasoningText(prev => prev + `\n\n💬 You: ${modificationInput}\n\n`);
    
    // Get current files from animationFiles
    const currentFiles = animationFiles.map(f => ({
      name: f.name,
      content: f.content
    }));
    
    console.log('📤 Sending to agent:', {
      files: currentFiles.length,
      conversationHistory: conversationHistory.length,
      browser: formData.targetBrowser,
      permissions: formData.permissions,
      modification: modificationInput
    });
    
    try {
      await modifyWithAgent({
        projectId: projectId,
        name: formData.name,
        description: formData.description,
        modification: modificationInput,
        files: currentFiles,
        conversationHistory: conversationHistory,  // Send full conversation history
        browser: formData.targetBrowser || 'chrome',  // Send browser type
        permissions: formData.permissions || [],  // Send permissions
        host_permissions: formData.hostPermissions || []  // Send host permissions
      }, {
        onStart: (data) => {
          setReasoningText(prev => prev + `🤖 ${data.message}\n`);
        },
        
        onThinking: (text) => {
          setReasoningText(prev => prev + `${text}\n`);
        },
        
        onFileStart: (data) => {
          console.log(`📄 Modifying: ${data.file}`);
          // Mark file as being modified (incomplete)
          setAnimationFiles(prev => 
            prev.map(f => 
              f.name === data.file 
                ? { ...f, complete: false }
                : f
            )
          );
          setCurrentAnimText('');
          // Select the file being modified
          const fileIdx = animationFiles.findIndex(f => f.name === data.file);
          if (fileIdx >= 0) {
            setCurrentAnimFileIndex(fileIdx);
          }
        },
        
        onFileContent: (data) => {
          setCurrentAnimText(data.content);
          setAnimationFiles(prev => 
            prev.map(f => 
              f.name === data.file ? { ...f, content: data.content } : f
            )
          );
        },
        
        onFileComplete: (data) => {
          console.log(`✅ Modified: ${data.file}`);
          setAnimationFiles(prev => 
            prev.map(f => 
              f.name === data.file 
                ? { ...f, content: data.content, complete: true }
                : f
            )
          );
        },
        
        onFileDeleted: (data) => {
          console.log(`🗑️ Deleted: ${data.file}`);
          setAnimationFiles(prev => prev.filter(f => f.name !== data.file));
          setReasoningText(prev => prev + `🗑️ Deleted: ${data.file}\n`);
        },
        
        onComplete: async (data) => {
          console.log('✅ Modification complete:', data.modifiedFiles?.length, 'files modified');
          const completionMessage = `\n✅ ${data.summary || 'Modification complete!'}\n`;
          setReasoningText(prev => prev + completionMessage);
          
          // Add assistant response to conversation history
          const assistantMessage = {
            role: 'assistant',
            content: completionMessage,
            timestamp: new Date().toISOString(),
            filesModified: data.modifiedFiles || []
          };
          
          const updatedHistory = [...conversationHistory, userMessage, assistantMessage];
          console.log('🤖 Adding assistant response to history:', assistantMessage);
          console.log('📊 Total conversation history:', updatedHistory.length, 'messages');
          setConversationHistory(updatedHistory);
          
          // Update project ID for future modifications
          if (data.projectId) {
            setProjectId(data.projectId);
          }
          
          // Update all files with the new content
          if (data.files && data.files.length > 0) {
            setAnimationFiles(data.files.map(f => ({
              name: f.name,
              icon: getFileIcon(f.name),
              content: f.content,
              complete: true
            })));
            
            // Also update generatedCode
            const code = convertAgentFilesToCode(data.files);
            setGeneratedCode(code);
            
            // Save updated extension to Firebase with conversation history
            if (currentUser) {
              try {
                const extensionData = {
                  name: formData.name,
                  description: formData.description,
                  version: formData.version,
                  type: formData.type,
                  permissions: formData.permissions || [],
                  hostPermissions: formData.hostPermissions || [],  // Add host permissions
                  author: formData.author,
                  targetBrowser: formData.targetBrowser || 'chrome',
                  generatedCode: code,
                  conversationHistory: updatedHistory,  // Save conversation history
                  projectId: data.projectId || projectId  // Save project ID for vector DB
                };
                
                console.log('💾 Saving to Firebase:', {
                  extensionId: loadedExtensionId || 'NEW',
                  conversationHistory: updatedHistory.length + ' messages',
                  projectId: data.projectId || projectId,
                  browser: formData.targetBrowser,
                  permissions: formData.permissions?.length || 0,
                  hostPermissions: formData.hostPermissions?.length || 0
                });
                
                if (loadedExtensionId) {
                  // Update existing extension
                  await updateExtension(loadedExtensionId, extensionData);
                  console.log('✅ Modified extension and conversation history saved');
                  console.log('📜 Conversation history:', updatedHistory);
                } else {
                  // Save as new extension
                  const newId = await saveExtension(currentUser.uid, extensionData);
                  setLoadedExtensionId(newId);
                  console.log('✅ Extension saved with conversation history');
                  console.log('📜 Conversation history:', updatedHistory);
                }
              } catch (saveError) {
                console.error('Failed to save modified extension:', saveError);
              }
            }
          }
          
          setIsModifying(false);
          setAnimationComplete(true);
          setModificationInput('');  // Clear input after successful modification
        },
        
        onError: (error) => {
          console.error('Modification error:', error);
          setReasoningText(prev => prev + `\n❌ Error: ${error.message}\n`);
          setIsModifying(false);
          setAnimationComplete(true);  // Re-enable UI
        }
      });
      
    } catch (err) {
      console.error('Modification failed:', err);
      setReasoningText(prev => prev + `\n❌ Modification failed: ${err.message}\n`);
      setIsModifying(false);
      setAnimationComplete(true);
    }
  };

  // Build detailed, comprehensive prompt for AI code generation
  // Includes all user specs, quality requirements, and output format instructions
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

**CRITICAL VALIDATION CHECKLIST (MUST FOLLOW):**

✓ JavaScript Rules:
  - ALWAYS use 'use strict'; at the top of JS files
  - ALL variables MUST be declared with const/let/var (NO implicit globals)
  - ⚠️ CRITICAL: ALL document.getElementById/querySelector calls MUST be INSIDE DOMContentLoaded or after DOM loads
  - NEVER select DOM elements at the top level of the script (they won't exist yet!)
  - ALL getElementById() calls MUST check if element exists before use:
    Example: const btn = document.getElementById('myBtn');
             if (btn) { btn.addEventListener('click', handler); }
  - ALL event listeners MUST verify element exists first
  - ALL functions MUST have try-catch for error handling
  - Math operations MUST handle errors (division by zero, invalid input)
  - Use textContent for output (NOT innerHTML for user input)
  
  🚨 COMMON BUG TO AVOID:
  // WRONG - selectors run before DOM exists!
  const buttons = document.querySelectorAll('.btn');
  document.addEventListener('DOMContentLoaded', () => {
    buttons.forEach(btn => btn.addEventListener('click', handler)); // buttons is EMPTY!
  });
  
  // CORRECT - selectors inside DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.btn'); // Now elements exist!
    buttons.forEach(btn => btn.addEventListener('click', handler));
  });

✓ HTML Rules:
  - ALL element IDs referenced in JavaScript MUST exist in HTML
  - ALL <script src="..."> paths MUST match actual generated file paths exactly
  - ALL <link href="..."> paths MUST match actual generated file paths exactly
  - Example: If JS uses getElementById('calculate'), HTML MUST have <button id="calculate">

✓ Manifest.json Rules:
  - MUST be valid JSON (NO trailing commas)
  - ALL file paths in manifest MUST match actual generated files
  - Test that "action.default_popup", "background.service_worker" paths are correct
  - Validate ALL required Manifest V3 fields exist

✓ Calculator-Specific Rules (if making calculator):
  - Declare state variables: let currentValue = '0'; let previousValue = ''; let operation = null;
  - Each button click handler MUST validate input is valid
  - Division operation MUST check for zero: if (divisor === 0) { display.textContent = 'Error'; return; }
  - Clear button MUST reset ALL state variables
  - Use parseFloat() and check isNaN() before calculations
  - Display updates use textContent (safer than innerHTML)
  - Example button handler:
    const btn = document.getElementById('btn-5');
    if (btn) {
      btn.addEventListener('click', () => {
        currentValue += '5';
        display.textContent = currentValue;
      });
    }

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

  // ============================================
  // API INTEGRATION - STREAMING CODE GENERATION
  // ============================================

  // Call OpenRouter API with streaming to generate extension files
  // Parses FILE_START/FILE_END markers in real-time and displays progress to user
  // Implements retry logic with exponential backoff for reliability
  const callGeminiAPI = async (prompt) => {
    const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    
    // Configure retry logic - will retry up to 3 times on failure
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
            model: "xiaomi/mimo-v2-flash",
            messages: [
              {
                role: "system",
                content: `You are a senior browser extension developer with 10+ years experience. You create professional, production-ready extensions with beautiful modern UIs.

YOUR APPROACH:
1. First, analyze what the extension needs to do
2. Plan the file structure (use folders: popup/, scripts/, styles/)
3. Create comprehensive, fully-functional code
4. Design beautiful UIs with modern CSS (flexbox, grid, variables, animations)
5. VALIDATE your code against the checklist below BEFORE outputting

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
${!formData.icon ? '9. DO NOT create icons or add "icons" to manifest - user has none' : '9. Include icon references'}

🚨 VALIDATION CHECKLIST (TEST YOUR CODE):

✓ JavaScript Validation:
  - Add 'use strict'; at top of all JS files
  - ALL variables declared with const/let (NO undeclared variables)
  - ⚠️ CRITICAL: ALL DOM selectors (getElementById, querySelector, querySelectorAll) MUST be INSIDE DOMContentLoaded
  - NEVER select elements at top level - they don't exist yet!
  - ALL document.getElementById() wrapped with null check
  - Example: const el = document.getElementById('id'); if (el) { /* use el */ }
  - ALL math operations in try-catch blocks
  - Division by zero returns error message
  - NO syntax errors, NO undefined variables
  
  ⛔ NEVER DO THIS (most common bug!):
  const display = document.getElementById('display'); // WRONG - runs immediately!
  document.addEventListener('DOMContentLoaded', () => {
    display.textContent = '0'; // display is NULL because DOM wasn't ready!
  });
  
  ✅ ALWAYS DO THIS:
  document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('display'); // CORRECT - DOM is ready
    if (display) display.textContent = '0';
  });

✓ HTML Validation:
  - Every ID used in JS exists in HTML (getElementById('foo') → <div id="foo">)
  - All <script src> and <link href> paths match generated files exactly
  - No typos in element IDs

✓ Manifest Validation:
  - Valid JSON with NO trailing commas
  - All file paths exist in your generated files
  - All required Manifest V3 fields present

✓ Calculator Apps Must:
  - Declare state: let currentValue='0', previousValue='', operation=null
  - Check division by zero: if(b===0){showError();return;}
  - Validate all inputs with parseFloat() and isNaN() checks
  - Use textContent for display (NOT innerHTML)
  - Clear function resets all state variables`
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

        // Initialize reader for streaming response processing
        // This allows real-time display of file creation progress to user
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // Stream parsing state - accumulate incomplete chunks until markers are found
        let buffer = '';  // Collect JSON chunks until complete
        let currentFileName = null;  // Filename of file currently being parsed
        let currentFileContent = '';  // Accumulated content of current file
        const generatedFiles = [];  // Array of completed files
        const createdFileNames = new Set();  // Prevent duplicate files
        let fileIndex = -1;  // Track file index for animation display
        
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
                
                // Parse FILE_START marker - indicates beginning of new file
                // Requires newline after filename to ensure complete marker detection
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
                
                // Parse FILE_END marker - indicates end of current file content
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
        
        // Organize generated files into structured format for both new and legacy code paths
        const structuredCode = {
          allFiles: generatedFiles  // All files with folder paths preserved
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

  // ============================================
  // FILE DOWNLOAD & PACKAGING
  // ============================================

  // Create ZIP archive with all generated files and trigger download to user
  // Uses animationFiles as source of truth (includes user edits)
  const downloadExtension = async () => {
    // Use animationFiles as source of truth (includes any user edits)
    const filesToDownload = animationFiles.filter(f => f.complete && f.content);
    
    if (filesToDownload.length === 0) {
      setError({
        type: 'error',
        message: 'No extension files available for download. Please generate the extension first.'
      });
      return;
    }

    try {
      const zip = new JSZip();
    
      // Add all files with their full paths (including folders)
      filesToDownload.forEach(file => {
        console.log(`Adding to ZIP: ${file.name}`);
        zip.file(file.name, file.content);
      });

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

  // ============================================
  // STEP RENDERING - UI for each wizard step
  // ============================================

  // Step 1 - Basic Information
  // Collect: name, description, version, author, target browser
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

  // Step 2 - Extension Type & Configuration
  // Collect: extension type, optional icon upload, agent mode toggle
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

      {/* Agent Mode Toggle */}
      <div className="form-group agent-mode-section">
        <div className="agent-toggle-container">
          <label className="agent-toggle-label">
            <span className="agent-icon">🤖</span>
            <span>Agent Mode (Experimental)</span>
            {agentStatus === 'checking' && <span className="agent-status checking">Checking...</span>}
            {agentStatus === 'available' && <span className="agent-status available">Available</span>}
            {agentStatus === 'unavailable' && <span className="agent-status unavailable">Offline</span>}
          </label>
          <div 
            className={`toggle-switch ${useAgent ? 'active' : ''} ${!agentAvailable ? 'disabled' : ''}`}
            onClick={() => agentAvailable && setUseAgent(!useAgent)}
          >
            <div className="toggle-slider"></div>
          </div>
        </div>
        <p className="agent-description">
          {agentAvailable 
            ? "Use LangGraph-powered agent for smarter extension generation with tool use and reasoning."
            : "Agent server is not running. Start with: python src/agent/server.py"}
        </p>
        {useAgent && agentAvailable && (
          <div className="agent-active-indicator">
            ✨ Agent Mode Active - Using LangGraph with tool calling
          </div>
        )}
      </div>
    </div>
  );

  // Step 3 - Permissions Selection
  // Collect: browser permissions extension requires
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

  // Step 4 - Generation & Display
  // Unified interface: same view during generation and after completion
  const renderStep4 = () => {
    // Get files to display - use animationFiles during/after generation
    const displayFiles = animationFiles.length > 0 ? animationFiles : [];
    const safeIndex = Math.max(0, Math.min(currentAnimFileIndex, displayFiles.length - 1));
    const currentFile = displayFiles[safeIndex];
    // Only show "ready" when generation is truly complete (animationComplete flag set by onComplete)
    // AND all files have their complete flag set
    const allFilesComplete = animationComplete && displayFiles.length > 0 && displayFiles.every(f => f.complete);
    
    // Show generation interface (during generation OR after with files)
    if (isAnimating || isGenerating || displayFiles.length > 0) {
      const showThinkingPanel = !allFilesComplete || reasoningText;
      
      return (
        <div className="step-content workspace-view">
          {/* Header with status and download */}
          <div className="workspace-header">
            <h3>
              {isAnimating || isGenerating ? '✨ Creating Extension...' : `📁 ${formData.name || 'Extension'} Workspace`}
            </h3>
            {allFilesComplete && (
              <button className="btn btn-primary download-btn-inline" onClick={downloadExtension}>
                📥 Download ZIP ({displayFiles.length} files)
              </button>
            )}
          </div>
          
          <div className="workspace-container">
            {/* LEFT PANEL - File Tree */}
            <div className="workspace-sidebar">
              <div className="sidebar-header">
                <span className="folder-icon">📁</span>
                <span className="folder-name">{formData.name || 'extension'}</span>
                {!allFilesComplete && <span className="generating-badge">generating...</span>}
              </div>
              
              <div className="file-list">
                {displayFiles.length === 0 ? (
                  <div className="waiting-files">
                    <div className="pulse-dot"></div>
                    <span>Waiting for files...</span>
                  </div>
                ) : (
                  displayFiles.map((file, index) => (
                    <div 
                      key={`${index}-${file.name}`}
                      className={`file-item ${index === safeIndex ? 'active' : ''} ${file.complete ? 'complete' : 'writing'}`}
                      onClick={() => {
                        setCurrentAnimFileIndex(index);
                        setCurrentAnimText(file.content);
                      }}
                    >
                      <span className="file-icon">{file.icon}</span>
                      <span className="file-name">{file.name}</span>
                      {file.complete ? (
                        <span className="status-icon complete">✓</span>
                      ) : (
                        <span className="status-icon writing">
                          <span className="writing-dot"></span>
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
              
              {/* Status info */}
              <div className="sidebar-footer">
                <span className="file-count">{displayFiles.filter(f => f.complete).length}/{displayFiles.length} files ready</span>
              </div>
            </div>
            
            {/* MIDDLE PANEL - Code Editor */}
            <div className={`workspace-editor ${showThinkingPanel ? 'with-thinking' : 'full-width'}`}>
              <div className="editor-header">
                <div className="editor-tabs">
                  <span className="editor-tab active">
                    {currentFile?.icon} {currentFile?.name || 'No file selected'}
                  </span>
                </div>
                <div className="editor-actions">
                  <span className="char-count">{currentAnimText?.length || 0} chars</span>
                  <span className="edit-indicator">✏️ Editable</span>
                </div>
              </div>
              
              <div className="editor-body">
                <textarea
                  className="editor-textarea"
                  value={currentAnimText || '// Select a file from the sidebar or wait for generation...'}
                  onChange={(e) => handleFileContentEdit(safeIndex, e.target.value)}
                  spellCheck={false}
                  placeholder="// Code will appear here..."
                />
                {currentFile && !currentFile.complete && <span className="typing-cursor overlay">▌</span>}
              </div>
            </div>
            
            {/* RIGHT PANEL - AI Thinking/Reasoning */}
            {showThinkingPanel && (
              <div className="workspace-thinking">
                <div className="thinking-header">
                  <span className="thinking-icon">🧠</span>
                  <span className="thinking-title">AI Thinking</span>
                  {(!allFilesComplete || isModifying) && (
                    <div className="thinking-dots">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                  )}
                </div>
                <div className="thinking-body">
                  <pre className="thinking-log">
                    {reasoningText || '🚀 Starting generation...\n🧠 Analyzing requirements...\n'}
                    {(!allFilesComplete || isModifying) && <span className="thinking-cursor">▌</span>}
                  </pre>
                </div>
                
                {/* Chat Input - inside AI panel at bottom */}
                {allFilesComplete && agentAvailable && (
                  <div className="thinking-chat-input">
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="Ask for changes... (e.g., 'Add dark mode')"
                      value={modificationInput}
                      onChange={(e) => setModificationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && modificationInput.trim() && !isModifying) {
                          handleModifyExtension();
                        }
                      }}
                      disabled={isModifying}
                    />
                    <button
                      className="chat-send-btn"
                      onClick={handleModifyExtension}
                      disabled={isModifying || !modificationInput.trim()}
                    >
                      {isModifying ? <span className="spinner-small"></span> : '→'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Bottom status bar */}
          {allFilesComplete && (
            <div className="workspace-statusbar">
              <span className="status-success">✅ Extension ready!</span>
              <span className="status-hint">💡 Edit files above, then download when ready</span>
            </div>
          )}
        </div>
      );
    }
    
    // Initial state - no generation started yet
    if (!generatedCode && !isGenerating) {
      return (
        <div className="step-content">
          <h3>Generate Extension</h3>
          <div className="generation-status">
            <div className="generate-section">
              <h4>Ready to Generate</h4>
              <p>Click the button below to generate your extension files with advanced AI-powered code generation.</p>
              <button className="btn btn-primary" onClick={generateExtension}>
                🚀 Generate Extension
              </button>
            </div>
            
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
    
    return null;
  };

  // ============================================
  // STEP NAVIGATION & TRANSITIONS
  // ============================================

  // Track step transitions with animation direction (forward/backward)
  const [stepTransition, setStepTransition] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState('forward');
  const [previousStep, setPreviousStep] = useState(1);

  // Handle step navigation with visual transition animations
  // Manages direction, triggers animation, and cleanup
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

  // ============================================
  // MAIN COMPONENT RENDER
  // ============================================

  return (
    <div className="create-extension">
      {/* Animated background */}
      <HyperspeedBackground stepTransition={stepTransition} />
      {/* Step transition overlay animation */}
      <StepTransition 
        isActive={stepTransition} 
        direction={transitionDirection}
        currentStep={activeStep}
        previousStep={previousStep}
      />
      
      {/* Progress Bar - shows current position in 4-step wizard */}
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

      {/* Step Content Container - displays form for active step with transitions */}
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

      {/* Navigation Buttons - Previous, Next, Back to Home */}
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

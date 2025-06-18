import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
// CSS is inlined below to prevent resolution issues.

function CreateExtension() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    version: "1.0.0",
    type: "popup",
    permissions: [],
    icon: "",
    author: "",
    // Chatbot-collected details will implicitly be part of chatMessages
    // No longer explicitly defined here as fixed fields for adaptive questioning.
  });

  const [activeStep, setActiveStep] = useState(1);
  const [generatedCode, setGeneratedCode] = useState(null); // Stores the final generated code from Gemini
  const [chatMessages, setChatMessages] = useState([]); // Stores the chat conversation history
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatConversationComplete, setIsChatConversationComplete] = useState(false); // Flag when chat is done

  const chatHistoryRef = useRef(null); // Ref for scrolling chat history

  // Initial prompt sent to Gemini when entering step 4
  useEffect(() => {
    if (activeStep === 4 && chatMessages.length === 0 && !isChatLoading) {
      const initialSystemPrompt = `You are an AI assistant specialized in designing browser extensions. Your goal is to guide the user to provide enough detail to create a simple yet functional extension.
      The user has already provided some basic information:
      Extension Name: "${formData.name}"
      Description: "${formData.description}"
      Version: "${formData.version}"
      Type: "${formData.type}"
      Author: "${formData.author}"
      Permissions selected: ${formData.permissions.length > 0 ? formData.permissions.join(', ') : 'None'}

      Your task is to engage in an adaptive conversation to gather more specific details about the extension's functionality, user interaction, target audience, UI/UX preferences, and any integration needs.
      **CRITICAL RULE:** During this conversational phase, you **MUST ONLY** respond with a single, clear question to the user, or the specific completion signal.
      **DO NOT** provide any actual code snippets, technical breakdowns with code, solutions, design approaches, long explanations, or multiple questions in one response, unless explicitly asked to summarize after signaling completion. Your responses must be solely focused on gathering information through concise, single questions.

      Once you believe you have gathered all necessary and sufficient information for a comprehensive extension (aim for around 5-10 meaningful exchanges, but adapt as needed), you **MUST** conclude by starting your response with the **EXACT phrase "CONVERSATION_COMPLETE:"** followed by a brief summary of the key details gathered or a final instruction for the user (e.g., "You can now click 'Generate Extension'"). This signal is vital for the application to proceed.`;

      const initialUserQuery = `Hello! Based on the initial information, let's refine the concept for my extension. Please ask your first question to understand my needs better.`;

      // Send the initial full context to Gemini
      sendPromptToGemini([{ role: "user", parts: [{ text: initialSystemPrompt + "\n" + initialUserQuery }] }], "initial");
    }

    // Scroll to the bottom of the chat history whenever messages change
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [activeStep, chatMessages.length, formData, isChatLoading]);

  // Handler for basic form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handler for toggling permissions
  const handlePermissionToggle = (permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  /**
   * Sends a prompt to the Gemini API and updates the chat history.
   * This is for the *conversational* part of the chatbot.
   * @param {Array} history The chat history to send to Gemini for context.
   * @param {string} type Optional: 'initial' for the very first prompt.
   */
  const sendPromptToGemini = async (history, type = 'chat') => {
    setIsChatLoading(true);

    const apiKey = "AIzaSyBq23mkvFSmfqecjNgkfq9rA8V34nrE6Ng"; // Canvas will inject the API key at runtime.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = { contents: history };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const botResponseText = result.candidates[0].content.parts[0].text;

        // Check for conversation completion signal
        if (botResponseText.startsWith("CONVERSATION_COMPLETE:")) {
          setIsChatConversationComplete(true);
          setChatMessages(prev => [...prev, { sender: "bot", text: botResponseText.replace("CONVERSATION_COMPLETE:", "").trim() }]);
        } else {
          setChatMessages(prev => [...prev, { sender: "bot", text: botResponseText }]);
        }
      } else {
        setChatMessages(prev => [...prev, { sender: "bot", text: "I couldn't get a meaningful response from Gemini. Please try again." }]);
        console.error("Unexpected Gemini API response structure:", result);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { sender: "bot", text: `Error: ${error.message}. Please check your network and try again.` }]);
      console.error("Error calling Gemini API:", error);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handler for the "Send" button click in the chatbot
  const handleSendButtonClick = () => {
    if (chatInput.trim() && !isChatLoading && !isChatConversationComplete) {
      const userMessage = { role: "user", parts: [{ text: chatInput }] };
      setChatMessages(prev => [...prev, { sender: "user", text: chatInput }]); // Add to local state for display
      setChatInput(""); // Clear input

      // Prepare the history for Gemini (mapping 'user'/'bot' to 'user'/'model')
      const historyToSend = chatMessages.map(msg => ({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.text }]
      }));
      historyToSend.push(userMessage); // Add the current user message

      sendPromptToGemini(historyToSend);
    } else if (isChatConversationComplete) {
      setChatMessages(prev => [...prev, { sender: "bot", text: "The main conversation is complete. You can now generate the extension. If you have another question, please reset the form or generate the extension." }]);
    } else {
      setChatMessages(prev => [...prev, { sender: "bot", text: "Please type something before sending!" }]);
    }
  };

  /**
   * Requests Gemini to generate the full code package (manifest, popup HTML/JS, content script).
   */
  const requestExtensionCodeGeneration = async () => {
    setIsChatLoading(true); // Use loading for code generation as well

    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // Construct a comprehensive prompt for code generation
    // This prompt now includes ALL initial form data AND the full conversation history.
    const generationPrompt = `Based on the following initial extension details and our detailed conversation, please generate the complete code for a Chrome Extension.
    
    Initial Details:
    Name: "${formData.name}"
    Description: "${formData.description}"
    Version: "${formData.version}"
    Type: "${formData.type}"
    Author: "${formData.author}"
    Permissions selected: ${formData.permissions.length > 0 ? formData.permissions.join(', ') : 'None'}

    Full Conversation History (User's input followed by your bot's adaptive questions/responses):
    ${chatMessages.map(msg => `${msg.sender === 'user' ? 'User' : 'Bot'}: ${msg.text}`).join('\n')}

    Please provide the output as a JSON object with the following keys:
    "manifest": (string content of manifest.json)
    "popupHtml": (string content of popup.html)
    "popupJs": (string content of popup.js)
    "contentScript": (string content of content-script.js, or an empty string if no content script is required based on the conversation history).

    Ensure the generated HTML includes basic styling directly within a <style> tag. All JavaScript code should be functional, well-commented, and self-contained within its respective file. For any web interaction indicated in the conversation, infer and include appropriate host permissions in manifest.json and create a basic content-script.js. Adapt the UI/UX in popup.html and popup.js based on any preferences discussed. Provide a functional and runnable extension.`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: generationPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json", // Request JSON output
      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error during code generation: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        // Attempt to parse the JSON response from Gemini
        const jsonString = result.candidates[0].content.parts[0].text;
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(jsonString);
        } catch (parseError) {
            console.error("Failed to parse JSON from Gemini response:", parseError);
            setChatMessages(prev => [...prev, { sender: "bot", text: "Gemini returned code, but it's not in the expected JSON format. Please try refining your last input or generate again." }]);
            return; // Stop execution if parsing fails
        }
        
        // Map the keys from Gemini's response to our state keys
        setGeneratedCode({
          manifest: jsonResponse.manifest,
          popup: jsonResponse.popupHtml,
          script: jsonResponse.popupJs,
          // Only include contentScript if it's provided and not empty
          contentScript: jsonResponse.contentScript && jsonResponse.contentScript.trim() !== '' ? jsonResponse.contentScript : null
        });
        setActiveStep(5); // Move to the final generation step
      } else {
        setChatMessages(prev => [...prev, { sender: "bot", text: "Failed to receive code from Gemini. Response structure unexpected." }]);
        console.error("Unexpected Gemini API response structure for code:", result);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { sender: "bot", text: `Error generating code: ${error.message}. Please try again.` }]);
      console.error("Error calling Gemini API for code generation:", error);
    } finally {
      setIsChatLoading(false);
    }
  };

  /**
   * Main function to trigger extension file generation.
   * This is called after the chatbot conversation is complete.
   */
  const generateExtension = () => {
    // Now this triggers the API call for code generation
    requestExtensionCodeGeneration();
  };

  // Function to trigger file downloads
  const downloadFiles = () => {
    // Create and download manifest.json
    const manifestBlob = new Blob([generatedCode.manifest], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const manifestLink = document.createElement('a');
    manifestLink.href = manifestUrl;
    manifestLink.download = 'manifest.json';
    manifestLink.click();

    // Create and download popup.html
    const popupBlob = new Blob([generatedCode.popup], { type: 'text/html' });
    const popupUrl = URL.createObjectURL(popupBlob);
    const popupLink = document.createElement('a');
    popupLink.href = popupUrl;
    popupLink.download = 'popup.html';
    popupLink.click();

    // Create and download popup.js
    const scriptBlob = new Blob([generatedCode.script], { type: 'text/javascript' });
    const scriptUrl = URL.createObjectURL(scriptBlob);
    const scriptLink = document.createElement('a');
    scriptLink.href = scriptUrl;
    scriptLink.download = 'popup.js';
    scriptLink.click();

    // If content script exists, download it
    if (generatedCode.contentScript) {
      const contentScriptBlob = new Blob([generatedCode.contentScript], { type: 'text/javascript' });
      const contentScriptUrl = URL.createObjectURL(contentScriptBlob);
      const contentScriptLink = document.createElement('a');
      contentScriptLink.href = contentScriptUrl;
      contentScriptLink.download = 'content-script.js';
      contentScriptLink.click();
    }
  };

  // Array of available permissions with descriptions
  const availablePermissions = [
    { id: 'activeTab', label: 'Access Active Tab', desc: 'Read and modify the current tab' },
    { id: 'tabs', label: 'Tab Management', desc: 'Access to all tabs and tab information' },
    { id: 'storage', label: 'Storage Access', desc: 'Store and retrieve data locally' },
    { id: 'cookies', label: 'Cookie Access', desc: 'Read and modify cookies' },
    { id: 'bookmarks', label: 'Bookmark Access', desc: 'Read and modify bookmarks' },
    { id: 'history', label: 'History Access', desc: 'Access browsing history' },
    { id: 'notifications', label: 'Notifications', desc: 'Show desktop notifications' },
    { id: 'scripting', label: 'Scripting API', desc: 'Needed for programmatic injection of content scripts (e.g., modify page behavior).' }
  ];

  return (
    <div className="create-extension-container">
      {/* Inlined CSS styles */}
      <style>{`
        /* CreateExtension.css */

        .create-extension-container {
          padding: 40px;
          background: #f4f7fa;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .create-extension-wrapper {
          max-width: 900px;
          margin: auto;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.1);
          padding: 30px;
        }

        .progress-bar {
          margin-bottom: 30px;
          text-align: center;
        }

        .progress-steps {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .step {
          flex: 1;
          padding: 12px;
          border-radius: 10px;
          background: #e9ecef;
          color: #6c757d;
          transition: all 0.3s ease;
          font-weight: 500;
        }

        .step.active {
          background: #007bff;
          color: white;
          font-weight: 600;
        }

        .step-number {
          display: block;
          font-size: 20px;
          margin-bottom: 5px;
        }

        .step-label {
          font-size: 14px;
          white-space: nowrap;
        }

        .step-content h2 {
          margin-bottom: 10px;
          color: #343a40;
        }

        .step-description {
          color: #6c757d;
          margin-bottom: 20px;
        }

        .form-group, .form-row {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 6px;
          color: #343a40;
        }

        .form-group input,
        .form-group textarea,
        .form-row input,
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ced4da;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-row input:focus,
        select:focus {
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
          outline: none;
        }

        .form-row {
          display: flex;
          gap: 20px;
        }

        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .radio-option {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 10px;
          border: 1px solid #dee2e6;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .radio-option:hover {
          background: #e9f5ff;
          border-color: #007bff;
          box-shadow: 0 2px 5px rgba(0, 123, 255, 0.1);
        }

        .radio-option input {
          margin-top: 5px;
          flex-shrink: 0;
        }

        .radio-content strong {
          display: block;
          font-size: 15px;
          color: #343a40;
        }

        .radio-content span {
          font-size: 12px;
          color: #6c757d;
        }

        .permissions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 15px;
        }

        .permission-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border: 1px solid #dee2e6;
          padding: 12px;
          border-radius: 10px;
          background: #f8f9fa;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .permission-card:hover {
          background: #e9f5ff;
          border-color: #007bff;
          box-shadow: 0 2px 5px rgba(0, 123, 255, 0.1);
        }

        .permission-card.selected {
          background: #dbeeff;
          border-color: #007bff;
          box-shadow: 0 2px 5px rgba(0, 123, 255, 0.2);
        }

        .permission-checkbox {
          flex-shrink: 0;
        }

        .permission-info h4 {
          margin: 0;
          font-size: 14px;
          color: #343a40;
        }

        .permission-info p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #6c757d;
        }

        .generated-preview {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 20px;
        }

        .file-preview {
          flex: 1;
          background: #f1f3f5;
          border-radius: 10px;
          padding: 15px;
          overflow-x: auto;
        }

        .code-preview {
          background: #212529;
          color: #f8f9fa;
          padding: 10px;
          border-radius: 6px;
          font-family: monospace;
          font-size: 13px;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .extension-summary {
          flex: 1;
          background: #fff;
          border: 1px solid #dee2e6;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }

        .extension-summary h3 {
          margin: 0 0 10px;
          color: #007bff;
          font-size: 18px;
        }

        .summary-details {
          margin-top: 10px;
          font-size: 14px;
          color: #6c757d;
        }

        .detail-item {
          display: block;
          margin-bottom: 4px;
        }

        .form-actions {
          margin-top: 30px;
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          border-top: 1px solid #e0e0e0;
          padding-top: 20px;
        }

        .btn {
          padding: 10px 20px;
          font-size: 14px;
          border-radius: 8px;
          cursor: pointer;
          border: none;
          transition: background 0.2s, transform 0.1s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover {
          background: #0056b3;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background: #495057;
        }

        .btn-success {
          background: #28a745;
          color: white;
        }

        .btn-success:hover {
          background: #1e7e34;
        }

        .btn-outline {
          background: transparent;
          color: #343a40;
          border: 1px solid #ced4da;
        }

        .btn-outline:hover {
          background: #e9ecef;
          color: #007bff;
          border-color: #007bff;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        /* Chatbot Specific Styles (refined) */
        .chatbot-section {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 15px;
          background-color: #ffffff;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          height: 500px;
          margin-top: 25px;
        }

        .chat-history {
          flex-grow: 1;
          overflow-y: auto;
          margin-bottom: 15px;
          padding: 10px;
          background-color: #f9f9f9;
          border-radius: 5px;
          border: 1px solid #ececec;
          display: flex;
          flex-direction: column;
        }

        .chat-message {
          margin-bottom: 10px;
          padding: 8px 12px;
          border-radius: 15px;
          max-width: 85%;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.4;
        }

        .chat-message.user {
          align-self: flex-end;
          background-color: #e1ffc7;
          text-align: right;
          margin-left: auto;
          margin-right: 0;
        }

        .chat-message.bot {
          align-self: flex-start;
          background-color: #e9ecef;
          text-align: left;
          margin-left: 0;
          margin-right: auto;
        }

        .chat-input-area {
          display: flex;
          gap: 10px;
        }

        .chat-input-area textarea {
          flex-grow: 1;
          padding: 10px;
          border-radius: 6px;
          border: 1px solid #ced4da;
          resize: vertical;
          min-height: 40px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 15px;
        }

        .chat-input-area button {
          padding: 10px 20px;
          border-radius: 6px;
          border: none;
          background-color: #007bff;
          color: white;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .chat-input-area button:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .chat-input-area button:disabled {
          background-color: #e0e0e0;
          color: #a0a0a0;
          cursor: not-allowed;
          opacity: 0.7;
        }

        @media (max-width: 768px) {
          .create-extension-container {
            padding: 20px;
          }
          .create-extension-wrapper {
            padding: 20px;
          }
          .progress-steps {
            flex-wrap: wrap;
            justify-content: center;
          }
          .step {
            flex: none;
            width: 48%;
            margin-bottom: 10px;
          }
          .step-label {
            margin-top: 5px;
          }
          .form-row {
            flex-direction: column;
          }
          .generated-preview {
            flex-direction: column;
          }
          .form-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .btn {
            width: 100%;
          }
          .chatbot-section {
            height: 450px;
          }
        }
      `}</style>

      <div className="create-extension-wrapper">
        {/* Progress Bar for steps */}
        <div className="progress-bar">
          <div className="progress-steps">
            <div className={`step ${activeStep >= 1 ? 'active' : ''}`}>
              <span className="step-number">1</span>
              <span className="step-label">Basic Info</span>
            </div>
            <div className={`step ${activeStep >= 2 ? 'active' : ''}`}>
              <span className="step-number">2</span>
              <span className="step-label">Configuration</span>
            </div>
            <div className={`step ${activeStep >= 3 ? 'active' : ''}`}>
              <span className="step-number">3</span>
              <span className="step-label">Permissions</span>
            </div>
            <div className={`step ${activeStep >= 4 ? 'active' : ''}`}>
              <span className="step-number">4</span>
              <span className="step-label">Describe</span>
            </div>
            <div className={`step ${activeStep >= 5 ? 'active' : ''}`}>
              <span className="step-number">5</span>
              <span className="step-label">Generate</span>
            </div>
          </div>
        </div>

        {/* Form Content based on active step */}
        <div className="form-content">
          {/* Step 1: Basic Information */}
          {activeStep === 1 && (
            <div className="step-content">
              <h2>Basic Information</h2>
              <p className="step-description">Let's start with the basics of your extension</p>
              
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
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe what your extension does..."
                  rows="3"
                  required
                />
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
                    placeholder="Your Name"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Extension Configuration */}
          {activeStep === 2 && (
            <div className="step-content">
              <h2>Extension Configuration</h2>
              <p className="step-description">Choose the type and behavior of your extension</p>
              
              <div className="form-group">
                <label>Extension Type</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="type"
                      value="popup"
                      checked={formData.type === 'popup'}
                      onChange={handleInputChange}
                    />
                    <div className="radio-content">
                      <strong>Popup Extension</strong>
                      <span>Opens a popup when clicked in toolbar</span>
                    </div>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="type"
                      value="content"
                      checked={formData.type === 'content'}
                      onChange={handleInputChange}
                    />
                    <div className="radio-content">
                      <strong>Content Script</strong>
                      <span>Runs scripts on web pages</span>
                    </div>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="type"
                      value="background"
                      checked={formData.type === 'background'}
                      onChange={handleInputChange}
                    />
                    <div className="radio-content">
                      <strong>Background Service</strong>
                      <span>Runs in the background continuously</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Permissions */}
          {activeStep === 3 && (
            <div className="step-content">
              <h2>Permissions</h2>
              <p className="step-description">Select what your extension needs access to</p>
              
              <div className="permissions-grid">
                {availablePermissions.map(permission => (
                  <div 
                    key={permission.id} 
                    className={`permission-card ${formData.permissions.includes(permission.id) ? 'selected' : ''}`}
                    onClick={() => handlePermissionToggle(permission.id)}
                  >
                    <div className="permission-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(permission.id)}
                        onChange={() => handlePermissionToggle(permission.id)}
                      />
                    </div>
                    <div className="permission-info">
                      <h4>{permission.label}</h4>
                      <p>{permission.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Step 4: Review & Chatbot */}
          {activeStep === 4 && (
            <div className="step-content">
              <h2>Review & Describe Further</h2>
              <p className="step-description">Review your extension details and chat with Gemini to refine the concept!</p>  
              <div className="review-details">
                <h3>Extension Summary</h3>
                <p><strong>Name:</strong> {formData.name}</p>
                <p><strong>Description:</strong> {formData.description}</p>
                <p><strong>Version:</strong> {formData.version}</p>
                <p><strong>Type:</strong> {formData.type}</p>
                <p><strong>Author:</strong> {formData.author}</p>
                <p><strong>Permissions:</strong> {formData.permissions.join(', ') || 'None'}</p>
              </div>
              
              <h2>Gemini Chatbot 🤖</h2>
              <div className="chatbot-section">
                <p className="step-description">Let's chat about your extension. I'll ask questions to gather more details.</p>
                <div className="chat-history" ref={chatHistoryRef}>
                  {chatMessages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.sender}`}>
                      <strong>{msg.sender === "user" ? "You" : "Extension Bot"}:</strong> {msg.text}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="chat-message bot">
                      <strong>Extension Bot:</strong> Thinking...
                    </div>
                  )}
                </div>
                <div className="chat-input-area">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendButtonClick();
                      }
                    }}
                    placeholder={isChatConversationComplete ? "Conversation complete. Click Generate Extension or ask another question!" : "Type your answer here..."}
                    rows="1"
                    disabled={isChatLoading || isChatConversationComplete}
                  ></textarea>
                  <button
                    className="btn btn-primary"
                    onClick={handleSendButtonClick}
                    disabled={isChatLoading || isChatConversationComplete}
                  >
                    {isChatLoading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Generated Files Preview and Download */}
          {activeStep === 5 && generatedCode && (
            <div className="step-content">
              <h2>Extension Generated!</h2>
              <p className="step-description">Your extension files are ready to download</p>
              
              <div className="generated-preview">
                <div className="file-preview">
                  <h4>📄 manifest.json</h4>
                  <pre className="code-preview">{generatedCode.manifest}</pre>
                </div>
                
                <div className="file-preview">
                  <h4>📄 popup.html</h4>
                  <pre className="code-preview">{generatedCode.popup}</pre>
                </div>

                <div className="file-preview">
                  <h4>📄 popup.js</h4>
                  <pre className="code-preview">{generatedCode.script}</pre>
                </div>

                {generatedCode.contentScript && (
                  <div className="file-preview">
                    <h4>📄 content-script.js</h4>
                    <pre className="code-preview">{generatedCode.contentScript}</pre>
                  </div>
                )}
                
                <div className="extension-summary">
                  <h3>📦 {formData.name || "Your Extension"}</h3>
                  <p>{formData.description || "A custom browser extension."}</p>
                  <div className="summary-details">
                    <span className="detail-item">Version: {formData.version}</span>
                    <span className="detail-item">Type: {formData.type}</span>
                    <span className="detail-item">Permissions: {formData.permissions.length}</span>
                  </div>
                  {/* Since details are now dynamically inferred by Gemini,
                      we can't list them explicitly here unless Gemini also
                      provides a summary. For now, rely on generated code. */}
                  <h4 style={{marginTop: '20px', marginBottom: '10px', color: '#007bff'}}>Generated based on your input.</h4>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Actions */}
        <div className="form-actions">
          {activeStep > 1 && activeStep < 5 && (
            <button 
              className="btn btn-secondary"
              onClick={() => {
                setActiveStep(activeStep - 1);
                // Reset chat if going back from step 4
                if (activeStep === 4) {
                  setChatMessages([]);
                  setIsChatConversationComplete(false);
                  // No need to reset formData chatbot fields as they are not explicitly stored
                }
              }}
            >
              Previous
            </button>
          )}
          
          {activeStep < 4 && (
            <button 
              className="btn btn-primary"
              onClick={() => setActiveStep(activeStep + 1)}
              disabled={activeStep === 1 && (!formData.name || !formData.description)}
            >
              Next
            </button>
          )}
          
          {activeStep === 4 && (
            <button 
              className="btn btn-success"
              onClick={generateExtension}
              disabled={!isChatConversationComplete || isChatLoading} // Disable until conversation is complete
            >
              Generate Extension
            </button>
          )}
          
          {activeStep === 5 && (
            <>
              <button 
                className="btn btn-success"
                onClick={downloadFiles}
              >
                Download Files
              </button>
              <button 
                className="btn btn-outline"
                onClick={() => {
                  setActiveStep(1);
                  setGeneratedCode(null);
                  setFormData({
                    name: "",
                    description: "",
                    version: "1.0.0",
                    type: "popup",
                    permissions: [],
                    icon: "",
                    author: ""
                  });
                  setChatMessages([]);
                  setIsChatConversationComplete(false);
                }}
              >
                Create Another
              </button>
            </>
          )}
          
          <button 
            className="btn btn-outline"
            onClick={() => navigate("/")}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
 
export default CreateExtension;

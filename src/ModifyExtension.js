// src/ModifyExtension.js
import React, { useRef, useState } from "react";
import "./ModifyExtension.css";
import EmberBackground from "./components/EmberBackground";

export default function ModifyExtension() {
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleFileChange = () => {
    const files = fileInputRef.current.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const modifyFile = async (event) => {
    event.preventDefault();
    
    if (selectedFiles.length === 0) {
      setError("No files selected.");
      return;
    }
    
    setIsLoading(true);
    setStatusMessage({ type: "info", text: "Processing extension files..." });
    setError(null);
    
    try {
      const textContents = await Promise.all(
        selectedFiles.map(async (file) => {
          const content = await file.text();
          return `📄 ${file.name}\n\n${content}`;
        })
      );
      
      // Combine contents into one prompt
      const combinedText = textContents.join("\n\n---\n\n");
      const instruction = "You are an expert in browser extensions. Improve or optimize the following extension code. Suggest fixes or enhancements with a focus on performance and security.\n\n";
      const selectedBrowser = document.getElementById("browser-select").value;
      const prompt = instruction + `Target Browser: ${selectedBrowser}\n\n` + combinedText;
      
      const result = await geminiApi(prompt);
      setResponse(result);
      setStatusMessage({ type: "success", text: "Extension analysis complete!" });
    } catch (err) {
      setError(`Error processing files: ${err.message}`);
      setStatusMessage({ type: "error", text: "Failed to analyze extension" });
    } finally {
      setIsLoading(false);
    }
  };

  const geminiApi = async (combinedText) => {
    let apiKey = "AIzaSyBq23mkvFSmfqecjNgkfq9rA8V34nrE6Ng";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [{ text: combinedText }]
        }
      ]
    };
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to get analysis from API");
    }
    
    // Extract the text from the response
    if (data.candidates && data.candidates[0]?.content?.parts) {
      return data.candidates[0].content.parts[0].text;
    }
    
    return "No response content available";
  };

  return (
    <div className="modify-extension">
      <EmberBackground />
      <h2>🔧 Forge Existing Extensions</h2>
      
      <p>
        Upload your browser extension files to optimize, enhance, and prepare it for deployment.
        Our AI will analyze your code and suggest improvements to make your extension more powerful.
      </p>
      
      <div className="form-group">
        <label htmlFor="browser-select">Target Browser</label>
        <select id="browser-select">
          <option value="chrome">Chrome</option>
          <option value="firefox">Firefox</option>
          <option value="edge">Edge</option>
          <option value="brave">Brave</option>
          <option value="opera">Opera</option>
          <option value="safari">Safari</option>
        </select>
      </div>
      
      <div className="file-upload-container">
        <div className="file-upload-label" onClick={triggerFileInput}>
          <div className="file-upload-icon">📁</div>
          <div className="file-upload-text">
            {selectedFiles.length > 0 
              ? `${selectedFiles.length} file(s) selected` 
              : "Click to select extension files"}
          </div>
        </div>
        <input 
          type="file"
          webkitdirectory="true"
          directory=""
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="selected-files">
          {selectedFiles.length <= 3 ? (
            selectedFiles.map((file, index) => (
              <div className="selected-file" key={index}>
                <span className="file-icon">📄</span> {file.webkitRelativePath || file.name}
              </div>
            ))
          ) : (
            <div className="selected-file">
              <span className="file-icon">📁</span> {selectedFiles.length} files selected
            </div>
          )}
        </div>
      )}
      
      <button 
        className="upload-button" 
        onClick={modifyFile}
        disabled={isLoading || selectedFiles.length === 0}
      >
        {isLoading ? "Processing..." : "Analyze & Enhance Extension"}
      </button>
      
      {isLoading && <div className="loading-spinner"></div>}
      
      {statusMessage && (
        <div className={`status-message ${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}
      
      {error && (
        <div className="status-message error">
          {error}
        </div>
      )}
      
      {response && (
        <div className="response-container">
          <h3 className="response-heading">📊 Extension Analysis</h3>
          <div className="response-content">
            {response}
          </div>
        </div>
      )}
    </div>
  );
}

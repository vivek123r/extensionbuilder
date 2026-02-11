/**
 * Sequential Agent Service for Extension Builder
 * Handles communication with the true sequential agent server
 * Supports real agent behavior with planning and memory retention
 */

const AGENT_API_URL = process.env.REACT_APP_AGENT_API_URL || 'http://localhost:8001';

/**
 * Check if the sequential agent server is available
 * @returns {Promise<boolean>} - True if agent is healthy
 */
export const checkAgentHealth = async () => {
  try {
    const response = await fetch(`${AGENT_API_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Agent Health Check:', data);
      // Accept deepseek, sequential and dual-model agent types
      return data.status === 'healthy' && (data.agent_type === 'sequential' || data.agent_type === 'dual-model' || data.agent_type === 'deepseek');
    }
    return false;
  } catch (error) {
    console.warn('Agent server not available:', error.message);
    return false;
  }
};

/**
 * Generate extension using the sequential agent with true planning and memory
 * @param {Object} extensionData - Extension configuration
 * @param {Object} callbacks - Event callbacks for streaming updates
 * @returns {Promise<Object>} - Final result with all generated files and plan
 */
export const generateWithAgent = async (extensionData, callbacks = {}) => {
  const {
    onStart,
    onThinking,
    onAgentPlan,    // New: when agent creates implementation plan
    onFileStart,
    onFileContent,
    onFileComplete,
    onFile,  // Legacy callback support
    onProgress,
    onComplete,
    onError
  } = callbacks;

  const requestBody = {
    name: extensionData.name,
    description: extensionData.description,
    version: extensionData.version || '1.0.0',
    type: extensionData.type || 'popup',
    permissions: extensionData.permissions || [],
    author: extensionData.author || '',
    targetBrowser: extensionData.targetBrowser || 'chrome',
    hasIcon: !!extensionData.icon
  };

  try {
    const response = await fetch(`${AGENT_API_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent API Error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    const files = [];
    const fileContents = {};  // Track current content for each file
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'start':
                console.log('🚀 Agent started:', data.message);
                onStart?.(data);
                break;
              
              case 'thinking':
                console.log('🧠 Agent thinking:', data.text);
                onThinking?.(data.text);
                onProgress?.(data);  // Legacy support
                break;
              
              case 'plan':
                console.log('📋 Agent plan created:', data);
                onAgentPlan?.(data);
                break;
              
              case 'file_start':
                console.log('📄 File started:', data.file);
                onFileStart?.(data);
                fileContents[data.file] = '';
                break;
              
              case 'file_content':
                // Streaming file content
                fileContents[data.file] = data.content;
                onFileContent?.(data);
                break;
              
              case 'file_complete':
                console.log('✅ File complete:', data.file);
                fileContents[data.file] = data.content;
                
                // Add to files array
                const existingIndex = files.findIndex(f => f.name === data.file);
                if (existingIndex >= 0) {
                  files[existingIndex].content = data.content;
                } else {
                  files.push({ name: data.file, content: data.content });
                }
                
                onFileComplete?.(data);
                // Legacy callback
                onFile?.({ file: data.file, content: data.content });
                break;
                
              case 'complete':
                console.log('✅ Generation complete:', data.files?.length || files.length, 'files');
                onComplete?.({
                  files: data.files || files,
                  summary: data.message
                });
                break;
                
              case 'error':
                console.error('❌ Agent error:', data.message);
                onError?.(new Error(data.message));
                break;
                
              default:
                console.log('📨 Agent event:', data);
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', line);
          }
        }
      }
    }

    return { files, success: true };

  } catch (error) {
    console.error('Agent generation failed:', error);
    onError?.(error);
    throw error;
  }
};

/**
 * Generate extension synchronously (non-streaming)
 * @param {Object} extensionData - Extension configuration
 * @returns {Promise<Object>} - Generated files
 */
export const generateWithAgentSync = async (extensionData) => {
  const requestBody = {
    name: extensionData.name,
    description: extensionData.description,
    version: extensionData.version || '1.0.0',
    type: extensionData.type || 'popup',
    permissions: extensionData.permissions || [],
    author: extensionData.author || '',
    targetBrowser: extensionData.targetBrowser || 'chrome',
    hasIcon: !!extensionData.icon
  };

  try {
    const response = await fetch(`${AGENT_API_URL}/generate-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Agent sync generation failed:', error);
    throw error;
  }
};

/**
 * Convert agent files to extension service format
 * @param {Array} agentFiles - Files from agent [{name, content}]
 * @returns {Object} - Structured code object
 */
export const convertAgentFilesToCode = (agentFiles) => {
  const code = {
    allFiles: agentFiles.map(f => ({
      name: normalizeFilePath(f.name),
      content: f.content
    }))
  };

  // Also extract common files for backward compatibility
  agentFiles.forEach(file => {
    const normalizedName = normalizeFilePath(file.name);
    const fileName = normalizedName.split('/').pop();
    
    if (fileName === 'manifest.json') {
      code.manifest = file.content;
    } else if (fileName === 'popup.html' || normalizedName.includes('popup')) {
      if (fileName.endsWith('.html')) code.popupHtml = file.content;
      if (fileName.endsWith('.js')) code.popupJs = file.content;
      if (fileName.endsWith('.css')) code.popupCss = file.content;
    } else if (fileName === 'background.js' || normalizedName.includes('background')) {
      code.backgroundJs = file.content;
    } else if (fileName === 'content.js' || normalizedName.includes('content')) {
      code.contentJs = file.content;
    } else if (fileName.endsWith('.css')) {
      code.styles = file.content;
    }
  });

  return code;
};

/**
 * Normalize file path (remove temp directory prefix, use forward slashes)
 * @param {string} path - File path from agent
 * @returns {string} - Normalized path
 */
const normalizeFilePath = (path) => {
  // Replace backslashes with forward slashes
  let normalized = path.replace(/\\/g, '/');
  
  // Remove temp directory patterns
  normalized = normalized.replace(/^.*?[\/\\]extension_[^\/\\]+[\/\\]/, '');
  normalized = normalized.replace(/^.*?[\/\\]tmp[\/\\]/, '');
  
  // Remove leading slash if present
  if (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }
  
  return normalized;
};

/**
 * Modify extension using the agent with context from vector database
 * @param {Object} modifyData - Modification request data
 * @param {Object} callbacks - Event callbacks for streaming updates
 * @returns {Promise<Object>} - Final result with modified files
 */
export const modifyWithAgent = async (modifyData, callbacks = {}) => {
  const {
    onStart,
    onThinking,
    onFileStart,
    onFileContent,
    onFileComplete,
    onFileDeleted,
    onComplete,
    onError
  } = callbacks;

  const requestBody = {
    project_id: modifyData.projectId || '',
    name: modifyData.name,
    description: modifyData.description,
    modification: modifyData.modification,
    files: modifyData.files || []
  };

  try {
    onStart?.({ message: 'Starting modification...' });

    const response = await fetch(`${AGENT_API_URL}/modify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent Modify API Error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    const files = [];
    const fileContents = {};
    let buffer = '';
    let projectId = modifyData.projectId;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'thinking':
                console.log('🔧 Modify thinking:', data.text);
                onThinking?.(data.text);
                break;
              
              case 'file_start':
                console.log('📄 Modifying file:', data.file);
                onFileStart?.(data);
                fileContents[data.file] = '';
                break;
              
              case 'file_content':
                fileContents[data.file] = data.content;
                onFileContent?.(data);
                break;
              
              case 'file_complete':
                console.log('✅ File modified:', data.file);
                fileContents[data.file] = data.content;
                
                const existingIndex = files.findIndex(f => f.name === data.file);
                if (existingIndex >= 0) {
                  files[existingIndex].content = data.content;
                } else {
                  files.push({ name: data.file, content: data.content });
                }
                
                onFileComplete?.(data);
                break;
              
              case 'file_deleted':
                console.log('🗑️ File deleted:', data.file);
                onFileDeleted?.(data);
                break;
                
              case 'complete':
                console.log('✅ Modification complete:', data.modified_files?.length || 0, 'files modified');
                projectId = data.project_id || projectId;
                onComplete?.({
                  files: data.files || files,
                  modifiedFiles: data.modified_files || [],
                  projectId: projectId,
                  summary: data.message
                });
                break;
                
              case 'error':
                console.error('❌ Modify error:', data.message);
                onError?.(new Error(data.message));
                break;
                
              default:
                console.log('📨 Modify event:', data);
            }
          } catch (parseError) {
            console.warn('Failed to parse modify SSE data:', line);
          }
        }
      }
    }

    return { files, projectId, success: true };

  } catch (error) {
    console.error('Agent modification failed:', error);
    onError?.(error);
    throw error;
  }
};

export default {
  checkAgentHealth,
  generateWithAgent,
  generateWithAgentSync,
  convertAgentFilesToCode,
  modifyWithAgent
};

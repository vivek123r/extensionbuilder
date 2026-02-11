# Agent Generation Flow - Complete Walkthrough

## 🎯 High-Level Overview
```
User clicks "Generate" 
    ↓
Frontend calls Agent API (/generate)
    ↓
Backend (FastAPI) streams SSE events
    ↓
Frontend receives streaming events
    ↓
UI updates in real-time with files + thinking
    ↓
User can edit files while generating
    ↓
Download when done
```

---

## 📝 Step 1: User Triggers Generation

**File:** `src/CreateExtensionNew.js` (lines 348-354)

```javascript
const generateExtension = async () => {
  setIsGenerating(true);
  setActiveStep(4); // Move to workspace view
  
  if (useAgent && agentAvailable) {
    await generateWithAgentMode();  // ← Agent Mode!
    return;
  }
  // ... regular mode falls through
};
```

---

## 🚀 Step 2: Frontend Sends Request to Agent

**File:** `src/services/agentService.js` (lines 60-72)

```javascript
// Prepare request with extension specs
const requestBody = {
  name: "calculator",
  description: "A simple calculator extension",
  version: "1.0.0",
  type: "popup",
  permissions: [],
  author: "User",
  targetBrowser: "chrome",
  hasIcon: false
};

// Call agent API
const response = await fetch("http://localhost:8000/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestBody)
});
```

**What happens:**
- Frontend sends POST to `http://localhost:8000/generate`
- This calls the FastAPI backend endpoint

---

## 🧠 Step 3: Backend Processes with SSE Streaming

**File:** `src/agent/server_fast.py` (lines 191-221)

### 3A: LLM Call
```python
# Get the LLM
llm = ChatOpenAI(
    model="xiaomi/mimo-v2-flash",
    openai_api_key=api_key,
    openai_api_base="https://openrouter.ai/api/v1"
)

# Call it with system prompt + user request
response = await asyncio.to_thread(
    llm.invoke,
    [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt)
    ]
)
```

**What the LLM does:**
- Reads the system prompt (tells it to generate extension files)
- Reads the user request (calculator with specific specs)
- Returns **complete JSON** with all files:
```json
{
  "files": [
    {"name": "manifest.json", "content": "...full content..."},
    {"name": "popup/popup.html", "content": "...full content..."},
    {"name": "popup/popup.css", "content": "...full content..."},
    {"name": "popup/popup.js", "content": "...full content..."}
  ]
}
```

### 3B: Stream Each File Character-by-Character
```python
# For each file in the JSON response
for file in files:
    file_name = file.get("name")      # "manifest.json"
    file_content = file.get("content") # Complete content

    # 1. Signal: file is starting
    yield format_sse({"type": "file_start", "file": file_name})
    
    # 2. Stream content in chunks (50 chars at a time)
    chunk_size = 50
    for i in range(0, len(file_content), chunk_size):
        partial_content = file_content[:i + chunk_size]
        yield format_sse({
            "type": "file_content",
            "file": file_name,
            "content": partial_content  # Partial content!
        })
        await asyncio.sleep(0.02)  # Delay for animation
    
    # 3. Signal: file is complete
    yield format_sse({
        "type": "file_complete",
        "file": file_name,
        "content": file_content  # Full content
    })
    
    # 4. Send thinking message
    yield format_sse({"type": "thinking", "text": f"✅ Created {file_name}"})
```

**Result:** Server sends SSE (Server-Sent Events) stream that looks like:
```
data: {"type": "file_start", "file": "manifest.json"}

data: {"type": "file_content", "file": "manifest.json", "content": "{\n  \"manifest_version\""}

data: {"type": "file_content", "file": "manifest.json", "content": "{\n  \"manifest_version\": 3"}

... more chunks ...

data: {"type": "file_complete", "file": "manifest.json", "content": "{...entire file...}"}

data: {"type": "thinking", "text": "✅ Created manifest.json"}
```

---

## 📡 Step 4: Frontend Receives & Parses Streaming Events

**File:** `src/services/agentService.js` (lines 75-145)

```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  // Decode chunk
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  // Parse each SSE line
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      
      // Dispatch to callbacks
      switch (data.type) {
        case 'file_start':
          onFileStart?.(data);  // Called!
          break;
        
        case 'file_content':
          onFileContent?.(data);  // Called! (multiple times)
          break;
        
        case 'file_complete':
          onFileComplete?.(data);  // Called!
          break;
        
        case 'thinking':
          onThinking?.(data.text);  // Called!
          break;
        
        case 'complete':
          onComplete?.(data);  // Called!
          break;
      }
    }
  }
}
```

---

## 🎨 Step 5: Frontend Updates UI in Real-Time

**File:** `src/CreateExtensionNew.js` (lines 391-466)

### When `onFileStart` fires:
```javascript
onFileStart: (data) => {
  fileIndex++;
  // Add file to animation (initially empty)
  setAnimationFiles(prev => [...prev, {
    name: data.file,              // "manifest.json"
    icon: getFileIcon(data.file), // "📄"
    content: '',                  // Empty initially
    complete: false
  }]);
  
  setCurrentAnimFileIndex(fileIndex);
  setCurrentAnimText('');
}
```

**Result in UI:**
- Left sidebar: New file appears with ● (writing indicator)

### When `onFileContent` fires (continuously):
```javascript
onFileContent: (data) => {
  // Update file content in real-time with each chunk
  setCurrentAnimText(data.content);  // Partial content!
  setAnimationFiles(prev => 
    prev.map((f, idx) => 
      f.name === data.file 
        ? { ...f, content: data.content }  // Accumulating!
        : f
    )
  );
}
```

**Result in UI:**
- Right panel: Code appears character by character (typing effect)
- File size grows: "0 chars" → "50 chars" → "100 chars" → ...

### When `onFileComplete` fires:
```javascript
onFileComplete: (data) => {
  // Mark file as complete
  setAnimationFiles(prev => 
    prev.map(f => 
      f.name === data.file 
        ? { ...f, content: data.content, complete: true }
        : f
    )
  );
}
```

**Result in UI:**
- Left sidebar: ● becomes ✓ (complete indicator)

### When `onThinking` fires:
```javascript
onThinking: (text) => {
  setReasoningText(prev => prev + `${text}\n`);
}
```

**Result in UI:**
- Right panel (Thinking): Shows "✅ Created manifest.json"

---

## 🎯 Step 6: Complete & Download

**File:** `src/CreateExtensionNew.js` (lines 469-492)

### When `onComplete` fires:
```javascript
onComplete: async (data) => {
  setReasoningText(prev => prev + `\n✅ Extension ready!\n`);
  
  // Keep workspace view visible
  setIsGenerating(false);
  // isAnimating stays true, so workspace stays visible!
  setAnimationComplete(true);
}
```

### When user clicks Download:
```javascript
const downloadExtension = async () => {
  // Use animationFiles (includes user edits!)
  const filesToDownload = animationFiles.filter(f => f.complete && f.content);
  
  // Create ZIP with all files
  const zip = new JSZip();
  filesToDownload.forEach(file => {
    zip.file(file.name, file.content);  // Your edits included!
  });
  
  // Generate and download
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  // ... trigger download
}
```

---

## 📊 Complete Timeline Example

### For "Calculator" Extension:

```
T=0.0s   User clicks "Generate"
         setIsGenerating(true)
         UI shows "✨ Creating Extension..."

T=0.1s   Frontend calls /generate API
         Backend gets LLM response (complete JSON)
         
T=0.2s   Backend streams:
         data: {"type": "file_start", "file": "manifest.json"}
         ✅ onFileStart() called
         ✅ Left sidebar: "manifest.json" appears

T=0.3s   Backend streams:
         data: {"type": "file_content", ..., "content": "{\n  \"manifest"}
         ✅ onFileContent() called
         ✅ Right panel: Code starts appearing

T=0.4s   data: {"type": "file_content", ..., "content": "{\n  \"manifest_version": 3"}
         ✅ File size: 50 chars

T=0.5s   ... many more file_content events ...
         File size: 500 chars, 1000 chars, etc.

T=2.0s   Backend streams:
         data: {"type": "file_complete", ..., "content": "{...complete...}"}
         ✅ onFileComplete() called
         ✅ Left sidebar: manifest.json ✓ (complete)
         ✅ File size: 2100 chars

T=2.1s   data: {"type": "thinking", "text": "✅ Created manifest.json"}
         ✅ onThinking() called
         ✅ Right panel (Thinking): Shows message

T=2.2s   Backend streams:
         data: {"type": "file_start", "file": "popup/popup.html"}
         ... repeats for next file ...

T=6.0s   All 4 files done (manifest, popup.html, popup.css, popup.js)
         data: {"type": "complete", "files": [...], "message": "..."}
         ✅ onComplete() called
         ✅ Status bar shows "✅ Extension ready!"
         ✅ Download button appears

T=6.1s   User can now:
         - Edit any file in the editor
         - Click on different files in sidebar
         - Click "Download ZIP"
```

---

## 🔄 Key Differences from Regular Mode

| Aspect | Regular Mode | Agent Mode |
|--------|--------------|-----------|
| **LLM** | OpenRouter/Gemini | OpenRouter/Gemini |
| **Output Format** | Streams with FILE_START/FILE_END markers | Streams with SSE JSON events |
| **Streaming** | Waits for complete LLM response, then parses | Streams LLM response + parses + chunks it |
| **Thinking Display** | In reasoning panel | In thinking panel (right side) |
| **Workspace View** | Same | **Same (unified!)** |
| **Editing** | Same | **Same (unified!)** |
| **Download** | Same | **Same (unified!)** |

---

## 🎬 Visual Layout During Generation

```
┌──────────────────────────────────────────────────────────────┐
│ ✨ Creating Extension...          [📥 Download ZIP]         │
├────────────┬──────────────────────────┬─────────────────────┤
│  📁 calc   │  📄 manifest.json        │  🧠 AI Thinking    │
│            │  ▌▌▌▌▌▌▌▌▌▌▌▌▌...      │  ✅ Created...     │
│ ✓ manifest │  {                       │  🧠 Analyzing CSS  │
│ ● popup.h  │    "manifest_version":  │  ...               │
│ ● popup.c  │    3,                    │                    │
│ ● popup.j  │    ...                   │                    │
│            │                          │                    │
│ 1/4 ready  │  [2100 chars]           │  [live thinking]   │
└────────────┴──────────────────────────┴─────────────────────┘
```

---

## ✨ Summary

**The agent now:**
1. ✅ Receives request from frontend
2. ✅ Calls LLM to generate extension
3. ✅ Streams each file character-by-character
4. ✅ Frontend shows typing animation in real-time
5. ✅ User can edit files while still generating
6. ✅ Shows thinking/reasoning on the right
7. ✅ Downloads with all user edits included

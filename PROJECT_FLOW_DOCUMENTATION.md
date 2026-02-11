# 🎯 Extension Builder - Complete Project Flow Documentation

## 📚 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Extension Generation Flow](#extension-generation-flow)
3. [Context Storage & ChromaDB](#context-storage--chromadb)
4. [Agent Working Mechanism](#agent-working-mechanism)
5. [Modification Flow](#modification-flow)
6. [Technical Stack](#technical-stack)

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (React)                    │
│  - CreateExtensionNew.js (Main wizard)                      │
│  - ModifyExtension.js (Extension modification)              │
│  - MyExtensions.js (User's saved extensions)                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              SERVICE LAYER (JavaScript)                      │
│  - agentService.js (Agent communication)                    │
│  - extensionService.js (Firebase operations)                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           BACKEND AGENT (Python FastAPI)                     │
│  - server_agent.py (Main agent server)                      │
│  - Uses: OpenRouter API (Mimo model)                        │
│  - ChromaDB for vector storage                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
Frontend (React) 
    ↓ HTTP POST (SSE Stream)
Agent Server (FastAPI)
    ↓ API Call
LLM (Mimo via OpenRouter)
    ↓ Complete JSON Response
Agent Server (parses, chunks, streams)
    ↓ SSE Events
Frontend (receives, animates, displays)
    ↓ Storage
ChromaDB (Vector embeddings) + Firebase (User data)
```

---

## 🚀 Extension Generation Flow

### Phase 1: User Input Collection

**Location:** [CreateExtensionNew.js](src/CreateExtensionNew.js)

#### Step 1: 4-Step Wizard
```javascript
// User fills out:
- Step 1: Basic Info (name, description, author, version)
- Step 2: Extension Type (popup, content-script, background, devtools)
- Step 3: Permissions (storage, tabs, activeTab, etc.)
- Step 4: Preview & Generate
```

#### Step 2: AI Suggestions (Optional)
```javascript
const generateSmartsuggestions = async () => {
  // Calls Gemini API to analyze description
  // Returns: suggested type, permissions, features
  // Auto-populates form based on AI analysis
}
```

### Phase 2: Extension Generation

#### User Clicks "Generate"
```javascript
const generateExtension = async () => {
  setIsGenerating(true);
  setActiveStep(4); // Show workspace view
  
  // Check if agent mode is enabled
  if (useAgent && agentAvailable) {
    await generateWithAgentMode(); // Agent path
  } else {
    await generateWithRegularMode(); // Direct API path
  }
}
```

### Phase 3: Backend Processing

**Location:** [server_agent.py](src/agent/server_agent.py)

#### Step 1: Receive Request
```python
@app.post("/generate")
async def generate_extension(request: ExtensionRequest):
    # Request contains:
    # - name, description, version
    # - type, permissions
    # - author, targetBrowser
    
    return StreamingResponse(
        generate_extension_files(request),
        media_type="text/event-stream"
    )
```

#### Step 2: Planning Phase
```python
# PHASE 1: ARCHITECTURE PLANNING
yield format_sse({"type": "thinking", "text": "🤔 Planning architecture..."})

# Call LLM with planning prompt
plan_response = llm.invoke([SystemMessage(content=PLANNING_PROMPT)])

# Plan contains:
{
  "analysis": "This extension needs X, Y, Z",
  "architecture": "Popup for UI, content script for...",
  "files": [
    {"name": "manifest.json", "purpose": "Extension manifest"},
    {"name": "popup/popup.html", "purpose": "Main UI"},
    {"name": "popup/popup.css", "purpose": "Styling"},
    {"name": "popup/popup.js", "purpose": "Logic"}
  ],
  "permissions": ["activeTab", "storage"],
  "host_permissions": []
}
```

#### Step 3: File Generation
```python
# PHASE 2: CODE GENERATION
for file_info in plan["files"]:
    file_name = file_info["name"]
    
    # Generate context-aware prompt
    coding_prompt = get_dynamic_file_prompt(
        file_name=file_name,
        file_purpose=file_info["purpose"],
        request=request,
        plan=plan,
        generated_files=generated_files  # Previous files for context
    )
    
    # Call LLM to generate file content
    file_response = llm.invoke([SystemMessage(content=coding_prompt)])
    file_content = clean_ai_response(file_response.content, file_name)
    
    # Validate generated content
    if not validate_content(file_content, file_name):
        raise ValueError(f"Invalid content for {file_name}")
    
    generated_files.append({
        "name": file_name,
        "content": file_content
    })
```

#### Step 4: Streaming to Frontend
```python
# Stream file in chunks for animation effect
yield format_sse({"type": "file_start", "file": file_name})

chunk_size = 80
for i in range(0, len(file_content), chunk_size):
    partial_content = file_content[:i + chunk_size]
    
    # Send partial content
    yield format_sse({
        "type": "file_content",
        "file": file_name,
        "content": partial_content
    })
    
    await asyncio.sleep(0.03)  # Animation delay

# Send complete file
yield format_sse({
    "type": "file_complete",
    "file": file_name,
    "content": file_content
})

yield format_sse({"type": "thinking", "text": f"✅ Created {file_name}"})
```

### Phase 4: Frontend Reception & Display

**Location:** [agentService.js](src/services/agentService.js) + [CreateExtensionNew.js](src/CreateExtensionNew.js)

#### Step 1: SSE Stream Processing
```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      
      // Route to appropriate callback
      switch (data.type) {
        case 'thinking': onThinking(data.text); break;
        case 'file_start': onFileStart(data); break;
        case 'file_content': onFileContent(data); break;
        case 'file_complete': onFileComplete(data); break;
        case 'complete': onComplete(data); break;
      }
    }
  }
}
```

#### Step 2: Real-time UI Updates
```javascript
// When file starts generating
onFileStart: (data) => {
  // Add new file to sidebar with "writing" indicator
  setAnimationFiles(prev => [...prev, {
    name: data.file,              // "manifest.json"
    icon: getFileIcon(data.file), // "📄"
    content: '',                  // Empty initially
    complete: false               // Not done yet
  }]);
  
  setCurrentAnimFileIndex(fileIndex);
  setCurrentAnimText('');
}

// As content streams in (multiple times per file)
onFileContent: (data) => {
  // Update content in real-time (typing effect)
  setCurrentAnimText(data.content);  // Partial content
  
  setAnimationFiles(prev => 
    prev.map(f => 
      f.name === data.file 
        ? { ...f, content: data.content }
        : f
    )
  );
}

// When file is complete
onFileComplete: (data) => {
  // Mark as complete with checkmark
  setAnimationFiles(prev => 
    prev.map(f => 
      f.name === data.file 
        ? { ...f, content: data.content, complete: true }
        : f
    )
  );
}

// Show AI reasoning
onThinking: (text) => {
  setReasoningText(prev => prev + `${text}\n`);
}
```

### Phase 5: Storage & Download

#### Step 1: Store in ChromaDB (Vector Database)
```python
# Generate unique project ID
project_id = get_project_id(request.name, request.description)
# e.g., "abc123def456"

# Store all files in vector database
store_files_in_vector_db(project_id, generated_files, {
    "extension_name": request.name,
    "extension_description": request.description
})

# Return project_id to frontend for future modifications
yield format_sse({
    "type": "complete",
    "files": generated_files,
    "project_id": project_id  # Important for modifications!
})
```

#### Step 2: Save to Firebase (User's Extensions)
```javascript
// Save extension metadata to user's account
if (currentUser) {
  const extensionId = await saveExtension(currentUser.uid, {
    name: formData.name,
    description: formData.description,
    version: formData.version,
    type: formData.type,
    permissions: formData.permissions,
    author: formData.author,
    targetBrowser: formData.targetBrowser,
    generatedCode: code  // All files
  });
}
```

#### Step 3: Download ZIP
```javascript
const downloadExtension = async () => {
  const zip = new JSZip();
  
  // Use animationFiles (includes user edits!)
  const filesToDownload = animationFiles.filter(f => f.complete && f.content);
  
  filesToDownload.forEach(file => {
    zip.file(file.name, file.content);
  });
  
  // Add icon if provided
  if (formData.icon) {
    zip.file('icon.png', formData.icon);
  }
  
  // Generate and trigger download
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `${formData.name.replace(/\s+/g, '-')}.zip`);
}
```

---

## 💾 Context Storage & ChromaDB

### What is ChromaDB?

ChromaDB is a **vector database** that stores text embeddings for semantic search. It allows the agent to:
- Store all generated extension files
- Retrieve relevant files when modifying
- Maintain project context across sessions

### Storage Architecture

**Location:** [server_agent.py](src/agent/server_agent.py) - Lines 70-160

#### Project ID Generation
```python
def get_project_id(name: str, description: str) -> str:
    """Generate unique project ID from name and description."""
    content = f"{name}:{description}"
    return hashlib.md5(content.encode()).hexdigest()[:12]
    # e.g., "Calculator:A simple calc" → "a3b4c5d6e7f8"
```

#### Storing Files
```python
def store_files_in_vector_db(project_id: str, files: List[Dict], metadata: Dict):
    # 1. Delete existing files for this project
    existing = extension_collection.get(where={"project_id": project_id})
    if existing and existing['ids']:
        extension_collection.delete(ids=existing['ids'])
    
    # 2. Prepare documents for storage
    documents = []
    metadatas = []
    ids = []
    
    for file in files:
        file_name = file.get('name', 'unknown')
        content = file.get('content', '')
        
        # Create searchable document
        doc = f"File: {file_name}\n\n{content}"
        documents.append(doc)
        
        # Attach metadata
        file_metadata = {
            "project_id": project_id,
            "file_name": file_name,
            "file_type": file_name.split('.')[-1],
            "char_count": len(content),
            **metadata  # Extension name, description, etc.
        }
        metadatas.append(file_metadata)
        
        # Create unique ID
        ids.append(f"{project_id}_{file_name.replace('/', '_')}")
    
    # 3. Store in ChromaDB (creates embeddings automatically)
    extension_collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
```

### Storage Example

For a Calculator extension:

```
Project ID: "a3b4c5d6e7f8"

Documents stored in ChromaDB:
┌─────────────────────────────────────────────────────────────┐
│ ID: a3b4c5d6e7f8_manifest.json                              │
│ Document: "File: manifest.json\n\n{...manifest content...}" │
│ Embedding: [0.234, -0.432, 0.123, ...] (1536 dimensions)   │
│ Metadata: {                                                 │
│   project_id: "a3b4c5d6e7f8",                              │
│   file_name: "manifest.json",                              │
│   file_type: "json",                                       │
│   extension_name: "Calculator"                             │
│ }                                                           │
├─────────────────────────────────────────────────────────────┤
│ ID: a3b4c5d6e7f8_popup_popup.html                          │
│ Document: "File: popup/popup.html\n\n<!DOCTYPE..."        │
│ Embedding: [0.123, -0.234, 0.345, ...]                    │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Retrieval (For Modifications)

#### Semantic Search
```python
def retrieve_relevant_context(project_id: str, query: str, n_results: int = 5):
    """Retrieve files most relevant to modification request."""
    
    # Query vector database
    results = extension_collection.query(
        query_texts=[query],  # "Add a clear button"
        n_results=n_results,   # Top 5 files
        where={"project_id": project_id}  # Only this project
    )
    
    # Results ranked by relevance (cosine similarity)
    context_files = []
    for i, doc in enumerate(results['documents'][0]):
        metadata = results['metadatas'][0][i]
        distance = results['distances'][0][i]
        
        context_files.append({
            "name": metadata['file_name'],
            "content": doc.split('\n\n', 1)[1],  # Remove "File: ..." prefix
            "relevance": 1 - distance  # Convert distance to similarity
        })
    
    return context_files
    # Returns: [
    #   {name: "popup/popup.js", content: "...", relevance: 0.92},
    #   {name: "popup/popup.html", content: "...", relevance: 0.87},
    #   ...
    # ]
```

#### Get All Files
```python
def get_all_project_files(project_id: str) -> List[Dict]:
    """Get all files for a project (not ranked)."""
    
    results = extension_collection.get(
        where={"project_id": project_id}
    )
    
    files = []
    for i, doc in enumerate(results['documents']):
        metadata = results['metadatas'][i]
        files.append({
            "name": metadata['file_name'],
            "content": doc.split('\n\n', 1)[1]
        })
    
    return files
```

---

## 🤖 Agent Working Mechanism

### Agent Architecture

The agent uses a **sequential architecture** with two main phases:

```
┌─────────────────────────────────────────────────────────────┐
│                    PLANNING PHASE                            │
│  Input: User requirements                                    │
│  Output: Architecture plan + file list                       │
│  Model: Mimo (via OpenRouter)                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  CODE GENERATION PHASE                       │
│  Input: Plan + requirements + previous files (context)      │
│  Output: Complete file content for each file                │
│  Model: Mimo (via OpenRouter)                               │
└─────────────────────────────────────────────────────────────┘
```

### LLM Configuration

**Location:** [server_agent.py](src/agent/server_agent.py) - Line 220

```python
def get_llm():
    """Get Mimo model for coding"""
    return ChatOpenAI(
        model="xiaomi/mimo-v2-flash",  # Fast coding model
        temperature=0.3,                # Low temp for consistent code
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
        max_tokens=8000,                # Large token window
        default_headers={
            "HTTP-Referer": "https://github.com/extensionbuilder",
            "X-Title": "Extension Builder"
        }
    )
```

### Phase 1: Planning

#### Planning Prompt (Simplified)
```python
PLANNING_PROMPT = """
You are an expert Chrome extension architect.

Analyze this extension request and determine ALL files needed.
OUTPUT ONLY JSON. NO TEXT BEFORE OR AFTER.

Decide what files are needed:
- manifest.json (ALWAYS required)
- popup/popup.html, popup.css, popup.js (if popup UI needed)
- content/content.js, content.css (if page manipulation needed)
- background/background.js (if background processing needed)
- options/options.html, options.js (if settings page needed)

Output format:
{
  "analysis": "This extension needs...",
  "architecture": "Popup for UI, content script for...",
  "files": [
    {"name": "manifest.json", "purpose": "Extension manifest"},
    {"name": "popup/popup.html", "purpose": "Main UI"},
    ...
  ],
  "permissions": ["activeTab", "storage"],
  "host_permissions": []
}
"""
```

#### Planning Call
```python
plan_prompt = f"{PLANNING_PROMPT}\n\nExtension: {request.name} - {request.description}"

plan_response = llm.invoke([SystemMessage(content=plan_prompt)])

# Parse JSON response
plan = json.loads(plan_response.content)

# Plan now contains:
# {
#   "analysis": "Calculator needs popup UI, storage for history",
#   "files": [
#     {"name": "manifest.json", "purpose": "Extension configuration"},
#     {"name": "popup/popup.html", "purpose": "Calculator UI"},
#     {"name": "popup/popup.css", "purpose": "Calculator styling"},
#     {"name": "popup/popup.js", "purpose": "Calculator logic"}
#   ],
#   "permissions": ["storage"]
# }
```

### Phase 2: Code Generation

#### Context-Aware File Generation

**Key Innovation:** Each file is generated with context from previously generated files!

```python
def get_dynamic_file_prompt(file_name, file_purpose, request, plan, generated_files):
    """Generate contextual prompt for any file."""
    
    # Build context from previously generated files
    context_section = ""
    if generated_files:
        context_section = "\n=== PREVIOUSLY GENERATED FILES ===\n"
        for gf in generated_files[-3:]:  # Last 3 files
            content_preview = gf['content'][:2000]  # Truncate if too long
            context_section += f"\n--- {gf['name']} ---\n{content_preview}\n"
    
    prompt = f'''
OUTPUT ONLY RAW FILE CONTENT. NO MARKDOWN.

Extension: "{request.name}"
Description: {request.description}
Architecture: {plan['analysis']}

Current task: Generate {file_name}
Purpose: {file_purpose}

{context_section}

IMPORTANT: Reference previously generated files for consistency.
- Use same CSS class names from HTML
- Use same element IDs for JavaScript
- Match file paths from manifest.json

OUTPUT ONLY THE CODE. NO EXPLANATIONS.
'''
    
    return prompt
```

#### Example: Generating popup.js with Context

```python
# When generating popup.js, the prompt includes:

=== PREVIOUSLY GENERATED FILES ===

--- manifest.json ---
{
  "manifest_version": 3,
  "name": "Calculator",
  "action": {
    "default_popup": "popup/popup.html"  ← Agent sees this path
  }
}

--- popup/popup.html ---
<!DOCTYPE html>
<html>
<body>
  <div id="calculator">              ← Agent sees this ID
    <input id="display" />           ← And this ID
    <button class="btn">1</button>   ← And this class
  </div>
  <script src="popup.js"></script>
</body>
</html>

--- popup/popup.css ---
.btn {                               ← Agent sees styling
  background: linear-gradient(...);
  border-radius: 8px;
}
#display { width: 100%; }

Current task: Generate popup/popup.js
Purpose: Calculator logic and event handling

↓ Agent generates:

"use strict";

class Calculator {
  constructor() {
    this.display = document.getElementById('display');  // ← Uses correct ID!
    this.buttons = document.querySelectorAll('.btn');   // ← Uses correct class!
    this.attachEventListeners();
  }
  
  attachEventListeners() {
    this.buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Calculator logic...
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Calculator();
});
```

### Response Cleaning

The agent cleans LLM responses to remove AI suggestions:

```python
def clean_ai_response(content: str, file_name: str) -> str:
    """Remove AI suggestions and markdown from response."""
    
    # Remove markdown code blocks
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```javascript" in content:
        content = content.split("```javascript")[1].split("```")[0]
    
    # Remove AI suggestion patterns
    ai_patterns = [
        "here's", "here is", "this is", "note:",
        "## ", "### ", "features:", "key features"
    ]
    
    lines = content.split("\n")
    clean_lines = []
    for line in lines:
        if any(p in line.lower() for p in ai_patterns):
            continue  # Skip suggestion lines
        clean_lines.append(line)
    
    return "\n".join(clean_lines).strip()
```

### Validation

```python
def validate_content(content: str, file_name: str) -> bool:
    """Check if content is valid."""
    
    # Minimum length check
    if len(content.strip()) < 50:
        return False
    
    # JSON validation
    if file_name.endswith(".json"):
        try:
            data = json.loads(content)
            
            # Extra validation for manifest.json
            if file_name == "manifest.json":
                required = ["manifest_version", "name", "version"]
                for field in required:
                    if field not in data:
                        return False
                
                if data.get("manifest_version") != 3:
                    return False
            
            return True
        except json.JSONDecodeError:
            return False
    
    # Check for AI garbage
    first_lines = "\n".join(content.split("\n")[:3]).lower()
    if any(g in first_lines for g in ["here's", "this is a", "## "]):
        return False
    
    return True
```

---

## 🔧 Modification Flow

### Overview

When user wants to modify an existing extension:

```
User types modification request
    ↓
Frontend sends request with project_id
    ↓
Backend retrieves files from ChromaDB (vector search)
    ↓
Agent analyzes what needs to change
    ↓
Agent modifies specific files
    ↓
Backend streams modified files to frontend
    ↓
Files updated in UI (real-time)
    ↓
ChromaDB updated with new versions
```

### Step 1: User Initiates Modification

**Location:** [CreateExtensionNew.js](src/CreateExtensionNew.js) - Line 574

```javascript
const handleModifyExtension = async () => {
  const userMessage = modificationInput.trim();
  // e.g., "Add a clear button to reset the calculator"
  
  // Get current files from workspace
  const currentFiles = animationFiles.map(f => ({
    name: f.name,
    content: f.content
  }));
  
  await modifyWithAgent({
    projectId: projectId,        // From initial generation
    name: formData.name,
    description: formData.description,
    modification: userMessage,   // User's request
    files: currentFiles          // Current state
  }, {
    onThinking: (text) => { /* Show progress */ },
    onFileStart: (data) => { /* Mark file as modifying */ },
    onFileContent: (data) => { /* Stream new content */ },
    onFileComplete: (data) => { /* Mark complete */ }
  });
}
```

### Step 2: Backend Retrieval & Analysis

**Location:** [server_agent.py](src/agent/server_agent.py) - Line 820

#### 2A: Retrieve Files
```python
# Get files from ChromaDB using project_id
all_files = get_all_project_files(request.project_id)

# If not in DB, use files sent by frontend
if not all_files and request.files:
    all_files = request.files
    # Store them for future
    store_files_in_vector_db(request.project_id, all_files, {...})

# Example: all_files = [
#   {"name": "manifest.json", "content": "..."},
#   {"name": "popup/popup.html", "content": "..."},
#   {"name": "popup/popup.css", "content": "..."},
#   {"name": "popup/popup.js", "content": "..."}
# ]
```

#### 2B: Semantic Search for Relevant Files
```python
# Find files most relevant to the modification
relevant_files = retrieve_relevant_context(
    project_id=request.project_id,
    query=request.modification,  # "Add a clear button"
    n_results=3                  # Top 3 files
)

# ChromaDB returns ranked by relevance:
# [
#   {"name": "popup/popup.js", "content": "...", "relevance": 0.92},
#   {"name": "popup/popup.html", "content": "...", "relevance": 0.87},
#   {"name": "popup/popup.css", "content": "...", "relevance": 0.73}
# ]
```

#### 2C: Analyze What Needs to Change
```python
def get_modification_prompt(modification, relevant_files, all_files):
    return f'''
You are an expert Chrome extension developer.

USER'S REQUEST: "{modification}"

=== MOST RELEVANT FILES ===
{relevant_files}  # Top 3 by relevance

=== ALL PROJECT FILES ===
{all_files}  # Complete project

TASK: Determine which files need to be updated.

OUTPUT ONLY JSON:
{{
  "analysis": "Need to add clear button to HTML, wire it in JS, style in CSS",
  "files_to_modify": [
    {{"name": "popup/popup.html", "action": "modify", "reason": "Add clear button"}},
    {{"name": "popup/popup.js", "action": "modify", "reason": "Add click handler"}},
    {{"name": "popup/popup.css", "action": "modify", "reason": "Style clear button"}}
  ]
}}

Only include files that ACTUALLY need changes.
'''

# Call LLM
analysis_response = llm.invoke([SystemMessage(content=prompt)])
modification_plan = json.loads(analysis_response.content)

# Plan now contains which files to modify and why
```

### Step 3: File Modification

```python
for file_info in modification_plan["files_to_modify"]:
    file_name = file_info["name"]      # "popup/popup.js"
    action = file_info["action"]       # "modify"
    reason = file_info["reason"]       # "Add click handler"
    
    if action == "delete":
        # Remove file
        del file_dict[file_name]
        yield format_sse({"type": "file_deleted", "file": file_name})
        continue
    
    # Get current content
    current_content = file_dict.get(file_name, "")
    
    # Generate modification prompt
    mod_prompt = f'''
OUTPUT ONLY THE COMPLETE UPDATED FILE.

MODIFICATION REQUEST: "{request.modification}"
REASON: {reason}

CURRENT FILE ({file_name}):
{current_content}

RELATED FILES:
{related_files}  # Other files for context

Apply the modification. Keep existing functionality.
OUTPUT ONLY THE RAW FILE CONTENT.
'''
    
    # Get new content from LLM
    file_response = llm.invoke([SystemMessage(content=mod_prompt)])
    new_content = clean_ai_response(file_response.content, file_name)
    
    # Update file
    file_dict[file_name] = new_content
    
    # Stream to frontend (same as generation)
    yield format_sse({"type": "file_start", "file": file_name})
    
    for chunk in chunks(new_content, 80):
        yield format_sse({
            "type": "file_content",
            "file": file_name,
            "content": chunk
        })
    
    yield format_sse({
        "type": "file_complete",
        "file": file_name,
        "content": new_content
    })
```

### Step 4: Update Storage

```python
# Convert back to list
final_files = [
    {"name": name, "content": content}
    for name, content in file_dict.items()
]

# Update ChromaDB with modified files
store_files_in_vector_db(request.project_id, final_files, {
    "extension_name": request.name,
    "extension_description": request.description,
    "last_modification": request.modification  # Track changes
})

# Send completion
yield format_sse({
    "type": "complete",
    "files": final_files,
    "modified_files": modified_files,  # List of changed files
    "message": f"Modified {len(modified_files)} files",
    "project_id": request.project_id
})
```

### Step 5: Frontend Updates UI

```javascript
onFileStart: (data) => {
  // Mark file as being modified
  setAnimationFiles(prev => 
    prev.map(f => 
      f.name === data.file 
        ? { ...f, complete: false }  // Show "modifying" state
        : f
    )
  );
  
  // Switch to that file
  const fileIdx = animationFiles.findIndex(f => f.name === data.file);
  setCurrentAnimFileIndex(fileIdx);
}

onFileContent: (data) => {
  // Stream updated content
  setCurrentAnimText(data.content);
  setAnimationFiles(prev => 
    prev.map(f => 
      f.name === data.file 
        ? { ...f, content: data.content }
        : f
    )
  );
}

onFileComplete: (data) => {
  // Mark as complete
  setAnimationFiles(prev => 
    prev.map(f => 
      f.name === data.file 
        ? { ...f, content: data.content, complete: true }
        : f
    )
  );
  
  // Update generated code for download
  setGeneratedCode(convertAgentFilesToCode(allFiles));
}
```

---

## 🛠️ Technical Stack

### Frontend
- **Framework:** React 18
- **Routing:** React Router DOM
- **State Management:** React Hooks (useState, useContext)
- **Authentication:** Firebase Auth
- **Database:** Firebase Firestore
- **File Handling:** JSZip
- **HTTP:** Fetch API (Server-Sent Events)
- **Styling:** Custom CSS with animations

### Backend
- **Framework:** FastAPI (Python)
- **LLM Integration:** LangChain + OpenRouter API
- **Model:** Xiaomi Mimo-v2-flash
- **Vector Database:** ChromaDB
- **Embeddings:** ChromaDB built-in (sentence-transformers)
- **Streaming:** Server-Sent Events (SSE)
- **Server:** Uvicorn (ASGI)

### Key Dependencies
```python
# Backend (requirements.txt)
fastapi
uvicorn
langchain-openai
langchain-core
chromadb
sentence-transformers
python-dotenv
pydantic
```

```json
// Frontend (package.json)
{
  "react": "^18.x",
  "react-router-dom": "^6.x",
  "firebase": "^10.x",
  "jszip": "^3.x",
  "file-saver": "^2.x"
}
```

### Environment Variables

```bash
# .env file
OPENROUTER_API_KEY=sk-or-...        # OpenRouter API key
REACT_APP_AGENT_API_URL=http://localhost:8001  # Agent server URL
AGENT_PORT=8001                      # Agent server port
```

---

## 📊 Complete Flow Timeline

### Example: "Calculator" Extension

```
T=0.0s   User completes form, clicks "Generate"
         ↓
T=0.1s   Frontend: setIsGenerating(true), setActiveStep(4)
         Frontend: POST /generate to agent server
         ↓
T=0.2s   Backend: Receives request
         Backend: Calls LLM for planning
         ↓
T=2.0s   Backend: Plan received (4 files needed)
         Backend: SSE → {"type": "thinking", "text": "Planning complete!"}
         ↓
T=2.1s   Frontend: onThinking() → Shows "Planning complete!"
         ↓
T=2.2s   Backend: Generates manifest.json (file 1/4)
         Backend: SSE → {"type": "file_start", "file": "manifest.json"}
         ↓
T=2.3s   Frontend: onFileStart() → Adds manifest.json to sidebar (●)
         ↓
T=2.4s   Backend: SSE → {"type": "file_content", "content": "{\n  \"manif"}
T=2.5s   Backend: SSE → {"type": "file_content", "content": "{\n  \"manifest_version"}
T=2.6s   ... (streaming chunks)
         ↓
T=3.0s   Frontend: onFileContent() → Code types out in editor
         ↓
T=4.0s   Backend: SSE → {"type": "file_complete", "content": "{...full...}"}
         ↓
T=4.1s   Frontend: onFileComplete() → manifest.json gets checkmark (✓)
         Backend: Stores in ChromaDB (project_id: "a3b4c5d6")
         ↓
T=4.2s   Backend: Generates popup.html (file 2/4, with manifest context!)
         ... (repeats for popup.html, popup.css, popup.js)
         ↓
T=12.0s  Backend: All 4 files complete
         Backend: SSE → {"type": "complete", "files": [...], "project_id": "..."}
         ↓
T=12.1s  Frontend: onComplete() → Saves to ChromaDB + Firebase
         Frontend: Shows "Download ZIP" button
         ↓
T=15.0s  User requests modification: "Add a clear button"
         Frontend: POST /modify with project_id
         ↓
T=15.2s  Backend: Retrieves files from ChromaDB
         Backend: Vector search → popup.js most relevant (0.92)
         Backend: Analyzes → Need to modify 3 files
         ↓
T=16.0s  Backend: Modifies popup.html, popup.js, popup.css
         Backend: Streams updated files (same as generation)
         ↓
T=18.0s  Frontend: Files update in real-time in editor
         Frontend: Shows which files were modified
         Backend: Updates ChromaDB with new versions
         ↓
T=18.1s  Frontend: "Download ZIP" downloads updated files
```

---

## 🎯 Key Features

### 1. Real-time Streaming
- Files appear character-by-character as they're generated
- User sees AI "thinking" process
- Smooth typing animation effect

### 2. Context Awareness
- Each file generated with knowledge of previous files
- Consistent naming, paths, IDs across files
- No mismatched references

### 3. Semantic Modifications
- Vector search finds relevant files automatically
- Only modifies files that need changes
- Maintains consistency across project

### 4. Persistent Storage
- ChromaDB stores all files with embeddings
- Can modify extension later without re-uploading
- Project ID tracks everything

### 5. User Editing
- Edit files during generation
- Edits preserved in downloads
- Real-time file editing in workspace

### 6. Multi-Model Support
- Mimo for fast code generation
- Can switch models via configuration
- Temperature tuning for consistency

---

## 🔍 Debugging & Monitoring

### Backend Logs
```bash
# Run agent server with logs
python src/agent/server_agent.py

# Output:
✅ ChromaDB initialized at src/agent/chroma_db
🧠 Mimo Agent Server starting on port 8001
🤖 Model: xiaomi/mimo-v2-flash
📦 Stored 4 files in vector DB for project a3b4c5d6
```

### Frontend Console
```javascript
// Check in browser DevTools
🚀 Agent started: Mimo agent starting...
🧠 Agent thinking: 🤔 Planning architecture...
📄 Agent creating: manifest.json
✅ Agent completed: manifest.json
✅ Generation complete: 4 files
```

### ChromaDB Inspection
```python
# Check stored projects
collection = chroma_client.get_collection("extension_files")

# Get all project IDs
all_docs = collection.get()
project_ids = set(m['project_id'] for m in all_docs['metadatas'])
print(f"Stored projects: {project_ids}")

# Get files for specific project
files = get_all_project_files("a3b4c5d6")
print([f['name'] for f in files])
```

---

## 📝 Summary

This Extension Builder uses an **intelligent agent-based architecture** that:

1. **Takes Context:** User describes extension → Agent plans architecture
2. **Generates Code:** Agent generates files sequentially with full context
3. **Stores Embeddings:** ChromaDB stores files as vector embeddings
4. **Enables Modifications:** Vector search retrieves relevant files
5. **Streams Results:** Real-time SSE streaming for live feedback
6. **Maintains Consistency:** Each file references others correctly

The system combines **LLM intelligence**, **vector databases**, and **streaming UX** to create a powerful, context-aware extension builder.

"""
Extension Builder Agent Server - Mimo Model
Generates Chrome extensions with strict code-only output.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator, Dict
import json
import asyncio
import os
import hashlib
from datetime import datetime
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from pathlib import Path

# Vector database imports
try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    print("⚠️ ChromaDB not installed. Run: pip install chromadb sentence-transformers")

# Load environment variables from .env file
project_root = Path(__file__).parent.parent.parent
load_dotenv(project_root / '.env')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ============================================
# VECTOR DATABASE SETUP
# ============================================

# Initialize ChromaDB client (persistent storage)
chroma_client = None
extension_collection = None

if CHROMA_AVAILABLE:
    try:
        chroma_path = Path(__file__).parent / "chroma_db"
        chroma_path.mkdir(exist_ok=True)
        chroma_client = chromadb.PersistentClient(path=str(chroma_path))
        extension_collection = chroma_client.get_or_create_collection(
            name="extension_files",
            metadata={"hnsw:space": "cosine"}
        )
        print(f"✅ ChromaDB initialized at {chroma_path}")
    except Exception as e:
        print(f"⚠️ ChromaDB init failed: {e}")
        CHROMA_AVAILABLE = False


def get_project_id(name: str, description: str) -> str:
    """Generate unique project ID from name and description."""
    content = f"{name}:{description}"
    return hashlib.md5(content.encode()).hexdigest()[:12]


def store_files_in_vector_db(project_id: str, files: List[Dict], metadata: Dict = None):
    """Store generated files in vector database for context retrieval."""
    if not CHROMA_AVAILABLE or not extension_collection:
        return
    
    try:
        # Delete existing files for this project
        existing = extension_collection.get(where={"project_id": project_id})
        if existing and existing['ids']:
            extension_collection.delete(ids=existing['ids'])
        
        # Add new files
        documents = []
        metadatas = []
        ids = []
        
        for file in files:
            file_name = file.get('name', 'unknown')
            content = file.get('content', '')
            
            # Create searchable document with file info
            doc = f"File: {file_name}\n\n{content}"
            documents.append(doc)
            
            file_metadata = {
                "project_id": project_id,
                "file_name": file_name,
                "file_type": file_name.split('.')[-1] if '.' in file_name else "unknown",
                "char_count": len(content),
                **(metadata or {})
            }
            metadatas.append(file_metadata)
            ids.append(f"{project_id}_{file_name.replace('/', '_')}")
        
        if documents:
            extension_collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            print(f"📦 Stored {len(documents)} files in vector DB for project {project_id}")
    
    except Exception as e:
        print(f"⚠️ Vector DB store error: {e}")


def retrieve_relevant_context(project_id: str, query: str, n_results: int = 5) -> List[Dict]:
    """Retrieve relevant files based on modification query."""
    if not CHROMA_AVAILABLE or not extension_collection:
        return []
    
    try:
        # Query for relevant files in this project
        results = extension_collection.query(
            query_texts=[query],
            n_results=n_results,
            where={"project_id": project_id}
        )
        
        context_files = []
        if results and results['documents'] and results['documents'][0]:
            for i, doc in enumerate(results['documents'][0]):
                metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                distance = results['distances'][0][i] if results['distances'] else 0
                
                # Extract file content from document
                lines = doc.split('\n', 2)
                file_name = metadata.get('file_name', lines[0].replace('File: ', '') if lines else 'unknown')
                content = '\n'.join(lines[2:]) if len(lines) > 2 else doc
                
                context_files.append({
                    "name": file_name,
                    "content": content,
                    "relevance": 1 - distance,  # Convert distance to similarity
                    "metadata": metadata
                })
        
        return context_files
    
    except Exception as e:
        print(f"⚠️ Vector DB query error: {e}")
        return []


def get_all_project_files(project_id: str) -> List[Dict]:
    """Get all files for a project from vector DB."""
    if not CHROMA_AVAILABLE or not extension_collection:
        return []
    
    try:
        results = extension_collection.get(
            where={"project_id": project_id}
        )
        
        files = []
        if results and results['documents']:
            for i, doc in enumerate(results['documents']):
                metadata = results['metadatas'][i] if results['metadatas'] else {}
                
                lines = doc.split('\n', 2)
                file_name = metadata.get('file_name', 'unknown')
                content = '\n'.join(lines[2:]) if len(lines) > 2 else doc
                
                files.append({
                    "name": file_name,
                    "content": content
                })
        
        return files
    
    except Exception as e:
        print(f"⚠️ Get project files error: {e}")
        return []


class ExtensionRequest(BaseModel):
    name: str
    description: str
    version: str = "1.0.0"
    author: Optional[str] = None
    type: str = "popup"
    permissions: List[str] = []
    hasIcon: bool = False


class ModifyRequest(BaseModel):
    """Request to modify an existing extension."""
    project_id: str
    name: str
    description: str
    modification: str  # User's modification request
    files: List[Dict] = []  # Current files (fallback if not in vector DB)


def format_sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def get_llm():
    """Get Mimo model for coding"""
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("REACT_APP_OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("No API key found. Set OPENROUTER_API_KEY environment variable")
    
    return ChatOpenAI(
        model="xiaomi/mimo-v2-flash",
        temperature=0.3,
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        max_tokens=8000,
        default_headers={
            "HTTP-Referer": "https://github.com/extensionbuilder",
            "X-Title": "Extension Builder"
        }
    )


# Strict prompts
PLANNING_PROMPT = """You are an expert Chrome extension architect. Analyze this extension request and determine ALL files needed.

OUTPUT ONLY JSON. NO TEXT BEFORE OR AFTER.

Based on the extension requirements, decide what files are needed:
- manifest.json (ALWAYS required)
- popup/popup.html, popup/popup.css, popup/popup.js (if popup UI needed)
- content/content.js, content/content.css (if page manipulation needed)
- background/background.js (if background processing, alarms, or messaging needed)
- options/options.html, options/options.js, options/options.css (if settings page needed)
- styles/inject.css (if injecting styles into pages)
- Any other files the extension needs

Example output format:
{
  "analysis": "This extension needs X, Y, Z functionality",
  "architecture": "Popup for UI, content script for page interaction, background for...",
  "files": [
    {"name": "manifest.json", "purpose": "Extension manifest with permissions"},
    {"name": "popup/popup.html", "purpose": "Main popup interface"},
    {"name": "popup/popup.css", "purpose": "Popup styling"},
    {"name": "popup/popup.js", "purpose": "Popup logic and event handling"},
    {"name": "content/content.js", "purpose": "DOM manipulation on target pages"},
    {"name": "background/background.js", "purpose": "Background event handling"}
  ],
  "permissions": ["activeTab", "storage", "tabs"],
  "host_permissions": []
}

Think carefully about what the extension ACTUALLY needs. Don't add unnecessary files, but include ALL required files.
IMPORTANT: Do NOT include any icon files (.png, .svg, .ico) - no icons are provided.
OUTPUT ONLY THE JSON."""


def get_manifest_prompt(name: str, version: str, description: str, plan: dict) -> str:
    """Generate manifest based on the architecture plan."""
    permissions = plan.get("permissions", ["activeTab"])
    host_permissions = plan.get("host_permissions", [])
    files = [f["name"] for f in plan.get("files", [])]
    
    # Find specific file paths
    popup_html = next((f for f in files if "popup" in f and f.endswith(".html")), None)
    background_js = next((f for f in files if "background" in f and f.endswith(".js")), None)
    content_js = [f for f in files if "content" in f and f.endswith(".js")]
    options_html = next((f for f in files if "options" in f and f.endswith(".html")), None)
    
    prompt = f'''OUTPUT ONLY VALID JSON FOR manifest.json. NO EXPLANATIONS. NO MARKDOWN.

Create manifest.json for Chrome extension "{name}".
Description: {description}
Version: {version}

EXACT FILES TO REFERENCE:
'''
    
    if popup_html:
        prompt += f"- Popup HTML: {popup_html}\n"
    if background_js:
        prompt += f"- Background script: {background_js}\n"
    if content_js:
        prompt += f"- Content scripts: {', '.join(content_js)}\n"
    if options_html:
        prompt += f"- Options page: {options_html}\n"
    
    prompt += f'''\nPermissions: {json.dumps(permissions)}
Host permissions: {json.dumps(host_permissions)}

CRITICAL REQUIREMENTS:
- Manifest V3 format ONLY
- "manifest_version": 3
- "name": "{name}"
- "version": "{version}"
- "description": "{description}"
'''
    
    if popup_html:
        prompt += f'- "action": {{"default_popup": "{popup_html}"}}\n'
    
    if background_js:
        prompt += f'- "background": {{"service_worker": "{background_js}"}}\n'
    
    if content_js:
        prompt += f'- "content_scripts": [{{"matches": ["<all_urls>"], "js": {json.dumps(content_js)}}}]\n'
    
    if options_html:
        prompt += f'- "options_page": "{options_html}"\n'
    
    prompt += f'''- "permissions": {json.dumps(permissions)}
'''
    
    if host_permissions:
        prompt += f'- "host_permissions": {json.dumps(host_permissions)}\n'
    
    prompt += '''\nDO NOT INCLUDE:
- "icons" field
- "default_icon" field
- Any .png, .svg, .ico references

OUTPUT ONLY THE JSON. START WITH { END WITH }. NO MARKDOWN BLOCKS.'''
    
    return prompt


def get_html_prompt(name: str, description: str) -> str:
    return f'''OUTPUT ONLY HTML CODE. NO EXPLANATIONS. NO SUGGESTIONS.

Create popup.html for "{name}": {description}

Requirements: Modern glass morphism design, link popup.css and popup.js

START WITH <!DOCTYPE html>. OUTPUT ONLY HTML CODE.'''


def get_css_prompt(name: str, description: str) -> str:
    return f'''OUTPUT ONLY CSS CODE. NO EXPLANATIONS. NO SUGGESTIONS.

Create popup.css for "{name}": {description}

Requirements: Glass morphism, gradients, animations, 380px width

START WITH CSS SELECTORS. OUTPUT ONLY CSS CODE.'''


def get_js_prompt(name: str, description: str) -> str:
    return f'''OUTPUT ONLY JAVASCRIPT CODE. NO EXPLANATIONS. NO SUGGESTIONS.

Create popup.js for "{name}": {description}

Requirements: ES6 class, event listeners, error handling, use strict

START WITH "use strict";. OUTPUT ONLY JAVASCRIPT CODE.'''


def get_dynamic_file_prompt(file_name: str, file_purpose: str, request, plan: dict, generated_files: list) -> str:
    """Generate a context-aware prompt for any file type."""
    
    # Build context from previously generated files - ACTUAL CONTENT
    context_section = ""
    if generated_files:
        context_section = "\n=== PREVIOUSLY GENERATED FILES (use these for reference) ===\n"
        for gf in generated_files[-3:]:  # Last 3 files for context
            content_preview = gf['content']
            # Truncate very long files but keep enough context
            if len(content_preview) > 2000:
                content_preview = content_preview[:2000] + "\n... (truncated)"
            context_section += f"\n--- {gf['name']} ---\n{content_preview}\n"
        context_section += "=== END OF PREVIOUS FILES ===\n"
    
    base_prompt = f'''OUTPUT ONLY RAW FILE CONTENT. NO EXPLANATIONS. NO MARKDOWN.

Extension: "{request.name}"
Description: {request.description}
Architecture: {plan.get('analysis', 'N/A')}

Current task: Generate {file_name}
Purpose: {file_purpose}
{context_section}
IMPORTANT: Reference the previously generated files above to ensure consistency.
- Use the same CSS class names from the HTML
- Use the same element IDs for JavaScript
- Match the file paths from manifest.json

STRICT RULES:
- Output ONLY the raw file content
- NO explanations or descriptions
- NO markdown code blocks
- NO feature lists
- NO "Here's" or "This is"
- Just the actual code/content

'''

    # File-specific requirements
    if file_name == "manifest.json":
        return get_manifest_prompt(request.name, request.version, request.description, plan)
    
    elif file_name.endswith('.html'):
        base_prompt += f'''Requirements for {file_name}:
- Modern, clean HTML5 structure
- Link appropriate CSS and JS files
- Glass morphism design elements
- Semantic HTML tags

START WITH <!DOCTYPE html>'''
    
    elif file_name.endswith('.css'):
        base_prompt += f'''Requirements for {file_name}:
- Modern CSS with custom properties
- Glass morphism effects (backdrop-filter, rgba backgrounds)
- Smooth transitions and animations
- Responsive design
- Professional color scheme

START WITH CSS RULES (selectors and properties)'''
    
    elif file_name.endswith('.js') and 'background' in file_name:
        base_prompt += f'''Requirements for {file_name}:
- Service worker for Manifest V3
- Event listeners for chrome.runtime
- Message passing handlers
- Any necessary alarms or storage operations
- "use strict" at top

START WITH "use strict";'''
    
    elif file_name.endswith('.js') and 'content' in file_name:
        base_prompt += f'''Requirements for {file_name}:
- Content script that runs on web pages
- DOM manipulation functions
- Message listener for popup/background communication
- Safe DOM queries with null checks
- "use strict" at top

START WITH "use strict";'''
    
    elif file_name.endswith('.js'):
        base_prompt += f'''Requirements for {file_name}:
- Modern ES6+ JavaScript
- Class-based structure if appropriate
- Event listeners and handlers
- Error handling with try/catch
- "use strict" at top

START WITH "use strict";'''
    
    else:
        base_prompt += f'''Generate appropriate content for {file_name} based on its purpose.'''
    
    return base_prompt


def clean_ai_response(content: str, file_name: str) -> str:
    """Remove AI suggestions and markdown from response."""
    
    # Remove markdown code blocks
    if "```" in content:
        if "```json" in content:
            content = content.split("```json")[1]
        elif "```html" in content:
            content = content.split("```html")[1]
        elif "```css" in content:
            content = content.split("```css")[1]
        elif "```javascript" in content or "```js" in content:
            parts = content.split("```")
            if len(parts) >= 2:
                content = parts[1]
                if content.startswith("javascript"):
                    content = content[10:]
                elif content.startswith("js"):
                    content = content[2:]
        else:
            parts = content.split("```")
            if len(parts) >= 2:
                content = parts[1]
        
        if "```" in content:
            content = content.split("```")[0]
        content = content.strip()
    
    # For JSON files, don't do line-by-line cleaning (it breaks valid JSON)
    if file_name.endswith(".json"):
        # Only remove leading/trailing AI fluff, keep JSON intact
        lines = content.split("\n")
        # Find first { and last }
        first_brace = -1
        last_brace = -1
        for i, line in enumerate(lines):
            if "{" in line and first_brace == -1:
                first_brace = i
            if "}" in line:
                last_brace = i
        
        if first_brace >= 0 and last_brace >= 0:
            content = "\n".join(lines[first_brace:last_brace+1])
    else:
        # Remove AI suggestion patterns (for non-JSON files)
        ai_patterns = [
            "here's", "here is", "this is", "note:", "note that",
            "## ", "**", "### ", "overview", "features:",
            "key features", "functionality", "i've", "i have",
            "let me", "this code", "the following"
        ]
        
        lines = content.split("\n")
        clean_lines = []
        for line in lines:
            line_lower = line.lower().strip()
            if any(p in line_lower for p in ai_patterns):
                continue
            if line.strip().startswith("- ") and "<" not in line and "{" not in line:
                continue
            clean_lines.append(line)
        
        content = "\n".join(clean_lines).strip()
    
    # Remove icon references from manifest.json
    if file_name == "manifest.json":
        try:
            data = json.loads(content)
            # Remove icon-related fields
            data.pop("icons", None)
            if "action" in data:
                data["action"].pop("default_icon", None)
            if "browser_action" in data:
                data["browser_action"].pop("default_icon", None)
            
            # Validate critical manifest fields
            if "manifest_version" not in data:
                data["manifest_version"] = 3
            if data.get("manifest_version") != 3:
                data["manifest_version"] = 3
            
            content = json.dumps(data, indent=2)
        except json.JSONDecodeError as e:
            # If JSON is invalid, try to extract just the JSON object
            pass
    
    return content


def validate_content(content: str, file_name: str) -> bool:
    """Check if content is valid and clean."""
    if len(content.strip()) < 50:
        return False
    
    # For JSON files, validate structure
    if file_name.endswith(".json"):
        try:
            data = json.loads(content)
            
            # Extra validation for manifest.json
            if file_name == "manifest.json":
                required_fields = ["manifest_version", "name", "version"]
                for field in required_fields:
                    if field not in data:
                        return False
                
                # Check for valid manifest_version
                if data.get("manifest_version") != 3:
                    return False
                
                # Validate file paths exist
                if "action" in data and "default_popup" in data["action"]:
                    popup = data["action"]["default_popup"]
                    if not popup or not isinstance(popup, str):
                        return False
                
                if "background" in data and "service_worker" in data["background"]:
                    worker = data["background"]["service_worker"]
                    if not worker or not isinstance(worker, str):
                        return False
            
            return True
        except json.JSONDecodeError:
            return False
    
    # Check for AI garbage in non-JSON files
    first_lines = "\n".join(content.split("\n")[:3]).lower()
    garbage = ["here's", "here is", "this is a", "## ", "###"]
    if any(g in first_lines for g in garbage):
        return False
    
    return True


def normalize_file_name(file_name: str) -> str:
    """Fix common file name issues from AI responses."""
    file_name = file_name.strip()
    
    # Fix manifest without extension
    if file_name.lower() in ["manifest", "manifest."]:
        return "manifest.json"
    
    # Fix trailing dots
    if file_name.endswith("."):
        # Try to guess extension based on name
        base = file_name[:-1].lower()
        if "manifest" in base:
            return "manifest.json"
        elif "html" in base or "popup" in base or "options" in base:
            return file_name[:-1] + ".html"
        elif "css" in base or "style" in base:
            return file_name[:-1] + ".css"
        elif "js" in base or "script" in base:
            return file_name[:-1] + ".js"
    
    return file_name


async def generate_extension_files(request: ExtensionRequest) -> AsyncGenerator[str, None]:
    """Generate extension files using Mimo model."""
    
    yield format_sse({"type": "thinking", "text": f"🧠 Mimo agent starting for '{request.name}'..."})
    
    try:
        llm = get_llm()
        
        # PHASE 1: PLANNING
        yield format_sse({"type": "thinking", "text": "🤔 Phase 1: Planning..."})
        
        try:
            plan_prompt = f"{PLANNING_PROMPT}\n\nExtension: {request.name} - {request.description}"
            plan_response = await asyncio.wait_for(
                asyncio.to_thread(llm.invoke, [SystemMessage(content=plan_prompt)]),
                timeout=15.0
            )
            
            plan_content = plan_response.content.strip()
            if "```" in plan_content:
                plan_content = plan_content.split("```")[1].replace("json", "").strip()
                if "```" in plan_content:
                    plan_content = plan_content.split("```")[0]
            
            plan = json.loads(plan_content)
            yield format_sse({"type": "thinking", "text": "✅ Planning complete!"})
            
        except Exception as e:
            yield format_sse({"type": "error", "message": f"Planning failed: {str(e)}"})
            return
        
        yield format_sse({"type": "thinking", "text": f"📁 Files to generate: {len(plan['files'])}"})
        
        # PHASE 2: CODE GENERATION
        yield format_sse({"type": "thinking", "text": "⚡ Phase 2: Generating code..."})
        generated_files = []
        
        for i, file_info in enumerate(plan["files"]):
            file_name = file_info["name"]
            
            # Fix common file name issues from AI
            file_name = normalize_file_name(file_name)
            
            file_purpose = file_info.get("purpose", "Extension file")
            
            yield format_sse({"type": "thinking", "text": f"🔥 Generating {file_name} ({i+1}/{len(plan['files'])})"})
            
            # Use dynamic context-aware prompt
            coding_prompt = get_dynamic_file_prompt(
                file_name=file_name,
                file_purpose=file_purpose,
                request=request,
                plan=plan,
                generated_files=generated_files
            )
            
            try:
                file_response = await asyncio.wait_for(
                    asyncio.to_thread(llm.invoke, [SystemMessage(content=coding_prompt)]),
                    timeout=30.0
                )
                file_content = clean_ai_response(file_response.content.strip(), file_name)
                
                if not validate_content(file_content, file_name):
                    raise ValueError(f"Generated content for {file_name} failed validation")
                
            except asyncio.TimeoutError:
                yield format_sse({"type": "error", "message": f"Timeout generating {file_name}"})
                continue
                    
            except Exception as e:
                yield format_sse({"type": "error", "message": f"Failed to generate {file_name}: {str(e)[:100]}"})
                continue
            
            generated_files.append({"name": file_name, "content": file_content})
            
            # Stream file
            yield format_sse({"type": "file_start", "file": file_name})
            
            chunk_size = 80
            for j in range(0, len(file_content), chunk_size):
                partial_content = file_content[:j + chunk_size]
                yield format_sse({"type": "file_content", "file": file_name, "content": partial_content})
                await asyncio.sleep(0.03)
            
            yield format_sse({"type": "file_complete", "file": file_name, "content": file_content})
        
        # Store files in vector database for future modifications
        project_id = get_project_id(request.name, request.description)
        store_files_in_vector_db(project_id, generated_files, {
            "extension_name": request.name,
            "extension_description": request.description
        })
        
        # ALL FILES COMPLETE - NOW SEND COMPLETION
        yield format_sse({"type": "thinking", "text": "🎉 Extension ready!"})
        yield format_sse({"type": "thinking", "text": f"📁 Generated {len(generated_files)} files successfully"})
        
        yield format_sse({
            "type": "complete",
            "files": generated_files,
            "message": "Mimo agent completed!",
            "plan": plan,
            "project_id": project_id  # Include project ID for modifications
        })
        
    except Exception as e:
        yield format_sse({"type": "error", "message": f"Agent error: {str(e)}"})


@app.get("/")
async def root():
    return {"status": "ok", "message": "Mimo Extension Builder Agent API v1.0"}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent_type": "sequential",
        "model": "xiaomi/mimo-v2-flash"
    }


@app.post("/generate")
async def generate_extension(request: ExtensionRequest):
    """Generate extension with streaming response."""
    return StreamingResponse(
        generate_extension_files(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# ============================================
# MODIFICATION ENDPOINT
# ============================================

def get_modification_prompt(modification: str, relevant_files: List[Dict], all_files: List[Dict]) -> str:
    """Generate prompt for modifying extension files."""
    
    # Build context from relevant files
    relevant_context = ""
    if relevant_files:
        relevant_context = "\n=== MOST RELEVANT FILES FOR THIS CHANGE ===\n"
        for f in relevant_files:
            relevant_context += f"\n--- {f['name']} (relevance: {f.get('relevance', 0):.2f}) ---\n"
            relevant_context += f"{f['content']}\n"
        relevant_context += "=== END RELEVANT FILES ===\n"
    
    # Build full project context
    full_context = "\n=== ALL PROJECT FILES ===\n"
    for f in all_files:
        full_context += f"\n--- {f['name']} ---\n"
        content = f['content']
        if len(content) > 1500:
            content = content[:1500] + "\n... (truncated)"
        full_context += f"{content}\n"
    full_context += "=== END ALL FILES ===\n"
    
    return f'''You are an expert Chrome extension developer. The user wants to modify their extension.

USER'S MODIFICATION REQUEST:
"{modification}"

{relevant_context}

{full_context}

TASK: Analyze the modification request and determine which files need to be updated.

OUTPUT FORMAT - Return ONLY valid JSON with this structure:
{{
  "analysis": "Brief explanation of what needs to change",
  "files_to_modify": [
    {{
      "name": "path/to/file.ext",
      "action": "modify" | "create" | "delete",
      "reason": "Why this file needs to change"
    }}
  ]
}}

Only include files that ACTUALLY need to change. Be conservative - don't modify files unnecessarily.
OUTPUT ONLY THE JSON. NO MARKDOWN BLOCKS.'''


def get_file_modification_prompt(file_name: str, modification: str, current_content: str, analysis: str, all_files: List[Dict]) -> str:
    """Generate prompt for modifying a specific file."""
    
    # Get related files for context
    related_context = ""
    related_extensions = {'.js': ['.html', '.css'], '.html': ['.js', '.css'], '.css': ['.html']}
    ext = '.' + file_name.split('.')[-1] if '.' in file_name else ''
    
    for f in all_files:
        f_ext = '.' + f['name'].split('.')[-1] if '.' in f['name'] else ''
        if f['name'] != file_name and f_ext in related_extensions.get(ext, []):
            related_context += f"\n--- Related: {f['name']} ---\n"
            content = f['content'][:1000] + "..." if len(f['content']) > 1000 else f['content']
            related_context += content + "\n"
    
    return f'''OUTPUT ONLY THE COMPLETE UPDATED FILE CONTENT. NO EXPLANATIONS. NO MARKDOWN.

MODIFICATION REQUEST: "{modification}"
ANALYSIS: {analysis}

CURRENT FILE ({file_name}):
```
{current_content}
```
{related_context}

Apply the requested modification to the file above.
Keep all existing functionality unless the modification explicitly requires removing it.
Maintain consistent style with the existing code.

OUTPUT ONLY THE RAW FILE CONTENT. START DIRECTLY WITH THE CODE.
NO MARKDOWN CODE BLOCKS. NO EXPLANATIONS.'''


async def modify_extension_files(request: ModifyRequest) -> AsyncGenerator[str, None]:
    """Modify extension files based on user request."""
    
    yield format_sse({"type": "thinking", "text": f"🔧 Analyzing modification request..."})
    
    try:
        llm = get_llm()
        
        # Get files from vector DB or use provided files
        all_files = get_all_project_files(request.project_id)
        if not all_files and request.files:
            all_files = request.files
            # Store them in vector DB for future use
            store_files_in_vector_db(request.project_id, all_files, {
                "extension_name": request.name,
                "extension_description": request.description
            })
        
        if not all_files:
            yield format_sse({"type": "error", "message": "No files found for this project"})
            return
        
        yield format_sse({"type": "thinking", "text": f"📂 Found {len(all_files)} project files"})
        
        # Get relevant files using vector search
        relevant_files = retrieve_relevant_context(request.project_id, request.modification, n_results=3)
        
        if relevant_files:
            yield format_sse({"type": "thinking", "text": f"🎯 Found {len(relevant_files)} relevant files"})
        
        # PHASE 1: Analyze what needs to change
        yield format_sse({"type": "thinking", "text": "🤔 Planning modifications..."})
        
        analysis_prompt = get_modification_prompt(request.modification, relevant_files, all_files)
        
        try:
            analysis_response = await asyncio.wait_for(
                asyncio.to_thread(llm.invoke, [SystemMessage(content=analysis_prompt)]),
                timeout=20.0
            )
            
            analysis_content = analysis_response.content.strip()
            # Clean up JSON response
            if "```" in analysis_content:
                analysis_content = analysis_content.split("```")[1]
                if analysis_content.startswith("json"):
                    analysis_content = analysis_content[4:]
                if "```" in analysis_content:
                    analysis_content = analysis_content.split("```")[0]
            analysis_content = analysis_content.strip()
            
            # Find JSON boundaries
            start = analysis_content.find('{')
            end = analysis_content.rfind('}') + 1
            if start >= 0 and end > start:
                analysis_content = analysis_content[start:end]
            
            modification_plan = json.loads(analysis_content)
            
        except Exception as e:
            yield format_sse({"type": "error", "message": f"Analysis failed: {str(e)}"})
            return
        
        analysis_text = modification_plan.get("analysis", "Analyzing changes...")
        files_to_modify = modification_plan.get("files_to_modify", [])
        
        yield format_sse({"type": "thinking", "text": f"📋 {analysis_text}"})
        yield format_sse({"type": "thinking", "text": f"📝 {len(files_to_modify)} file(s) to update"})
        
        if not files_to_modify:
            yield format_sse({"type": "thinking", "text": "✅ No changes needed"})
            yield format_sse({
                "type": "complete",
                "files": all_files,
                "message": "No modifications required",
                "project_id": request.project_id
            })
            return
        
        # PHASE 2: Modify each file
        modified_files = []
        file_dict = {f['name']: f['content'] for f in all_files}
        
        for file_info in files_to_modify:
            file_name = file_info.get("name", "")
            action = file_info.get("action", "modify")
            reason = file_info.get("reason", "")
            
            yield format_sse({"type": "thinking", "text": f"🔄 {action.title()}: {file_name}"})
            
            if action == "delete":
                # Remove file from dict
                if file_name in file_dict:
                    del file_dict[file_name]
                    yield format_sse({"type": "file_deleted", "file": file_name})
                continue
            
            current_content = file_dict.get(file_name, "")
            
            # Generate modified content
            mod_prompt = get_file_modification_prompt(
                file_name=file_name,
                modification=request.modification,
                current_content=current_content,
                analysis=reason or analysis_text,
                all_files=all_files
            )
            
            try:
                file_response = await asyncio.wait_for(
                    asyncio.to_thread(llm.invoke, [SystemMessage(content=mod_prompt)]),
                    timeout=30.0
                )
                new_content = clean_ai_response(file_response.content.strip(), file_name)
                
                if not validate_content(new_content, file_name):
                    yield format_sse({"type": "error", "message": f"Validation failed for {file_name}"})
                    continue
                
            except asyncio.TimeoutError:
                yield format_sse({"type": "error", "message": f"Timeout modifying {file_name}"})
                continue
            except Exception as e:
                yield format_sse({"type": "error", "message": f"Failed to modify {file_name}: {str(e)[:100]}"})
                continue
            
            # Update file dict
            file_dict[file_name] = new_content
            modified_files.append(file_name)
            
            # Stream the modified file
            yield format_sse({"type": "file_start", "file": file_name})
            
            chunk_size = 80
            for j in range(0, len(new_content), chunk_size):
                partial_content = new_content[:j + chunk_size]
                yield format_sse({"type": "file_content", "file": file_name, "content": partial_content})
                await asyncio.sleep(0.02)
            
            yield format_sse({"type": "file_complete", "file": file_name, "content": new_content})
        
        # Convert back to list format
        final_files = [{"name": name, "content": content} for name, content in file_dict.items()]
        
        # Update vector database with modified files
        store_files_in_vector_db(request.project_id, final_files, {
            "extension_name": request.name,
            "extension_description": request.description,
            "last_modification": request.modification
        })
        
        # Complete
        yield format_sse({"type": "thinking", "text": f"✅ Modified {len(modified_files)} file(s)"})
        yield format_sse({"type": "thinking", "text": "🎉 Modifications complete!"})
        
        yield format_sse({
            "type": "complete",
            "files": final_files,
            "modified_files": modified_files,
            "message": f"Modified {len(modified_files)} files",
            "project_id": request.project_id
        })
        
    except Exception as e:
        yield format_sse({"type": "error", "message": f"Modification error: {str(e)}"})


@app.post("/modify")
async def modify_extension(request: ModifyRequest):
    """Modify extension with streaming response."""
    return StreamingResponse(
        modify_extension_files(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AGENT_PORT", 8001))
    print(f"🧠 Mimo Agent Server starting on port {port}")
    print(f"🤖 Model: xiaomi/mimo-v2-flash")
    uvicorn.run(app, host="0.0.0.0", port=port)

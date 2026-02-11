"""
Extension Builder Agent Server - Simplified & Fast
Generates Chrome extensions using a simple LLM call with structured output.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, AsyncGenerator
import asyncio
import json
import os
from dotenv import load_dotenv
from pathlib import Path

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

# Load .env from project root
project_root = Path(__file__).parent.parent.parent
load_dotenv(project_root / '.env')

app = FastAPI(title="Extension Builder Agent API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExtensionRequest(BaseModel):
    name: str
    description: str
    version: str = "1.0.0"
    type: str = "popup"
    permissions: List[str] = []
    author: str = ""
    targetBrowser: str = "chrome"
    hasIcon: bool = False


def format_sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def get_llm():
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("REACT_APP_OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("No API key found. Set OPENROUTER_API_KEY or REACT_APP_OPENROUTER_API_KEY in .env")
    
    return ChatOpenAI(
        model="xiaomi/mimo-v2-flash",
        temperature=0.7,
        openai_api_key=api_key,
        openai_api_base="https://openrouter.ai/api/v1",
        max_tokens=8000
    )


PLANNING_PROMPT = """You are an expert Chrome extension architect. Analyze the user's request and create a detailed implementation plan.

RESPOND ONLY WITH JSON in this format:
{
  "analysis": "Brief analysis of what the extension should do",
  "architecture": "Technical approach and key components needed",
  "files": [
    {"name": "manifest.json", "purpose": "Extension manifest with permissions and metadata"},
    {"name": "popup/popup.html", "purpose": "Main UI structure"},
    {"name": "popup/popup.css", "purpose": "Styling and visual design"},
    {"name": "popup/popup.js", "purpose": "Core functionality and user interactions"}
  ],
  "implementation_notes": "Key technical considerations and dependencies"
}

Focus on:
- What files are needed and why
- How they'll work together
- Key features and functionality
- Technical requirements and constraints

ONLY output the JSON, nothing else."""

FILE_GENERATION_PROMPT = """You are an expert Chrome extension developer. Generate the specific file requested based on the plan and context.

CONTEXT:
- Extension Plan: {plan}
- Previously Generated Files: {previous_files}
- Current Task: Generate {current_file}

RESPOND ONLY with the raw file content - NO JSON, NO markdown, NO explanations.
Just output the exact content that should go in the file.

Requirements:
- Use Manifest V3
- Write complete, working code - no placeholders
- Use modern JavaScript with 'use strict' and DOMContentLoaded
- Create beautiful CSS with gradients, shadows, transitions
- Ensure compatibility with other files in the project
- Follow the implementation plan exactly"""

SYSTEM_PROMPT = """YOU ARE A CODE GENERATOR. OUTPUT RAW CODE ONLY.

STRICT RULES - VIOLATION MEANS FAILURE:
❌ NO explanations
❌ NO suggestions  
❌ NO feature lists
❌ NO markdown (**, ##, -)
❌ NO "Here's", "This is", "Note:"
❌ NO comments describing features
❌ NO architecture descriptions
❌ NO recommendations
❌ NO bullet points
❌ NO headers

✅ ONLY output the JSON with file contents
✅ ONLY raw, working code inside each file
✅ Code comments for functionality ONLY (not descriptions)

You respond with ONLY valid JSON containing file contents. Nothing else. No prose. No explanation. Just JSON with code."""


def build_prompt(request: ExtensionRequest) -> str:
    permissions = ", ".join(request.permissions) if request.permissions else "none"
    
    return f"""OUTPUT ONLY JSON. NO TEXT BEFORE OR AFTER.

Create Chrome extension: {request.name}
Description: {request.description}

RETURN THIS EXACT JSON STRUCTURE:
{{
  "files": [
    {{"name": "manifest.json", "content": "<raw manifest json here>"}},
    {{"name": "popup/popup.html", "content": "<raw html here>"}},
    {{"name": "popup/popup.css", "content": "<raw css here>"}},
    {{"name": "popup/popup.js", "content": "<raw javascript here>"}}
  ]
}}

REQUIREMENTS FOR CODE:
- Manifest V3 format
- Modern CSS: gradients, glass morphism, animations
- Clean JavaScript with event handlers
- Professional UI design

OUTPUT ONLY THE JSON. START WITH {{ END WITH }}. NO OTHER TEXT."""


async def generate_extension_files(request: ExtensionRequest) -> AsyncGenerator[str, None]:
    """Generate extension files using Mimo with aggressive AI suggestion removal."""
    
    yield format_sse({"type": "thinking", "text": f"🚀 Mimo generating {request.name}..."})
    
    try:
        llm = get_llm()
        prompt = build_prompt(request)
        
        yield format_sse({"type": "thinking", "text": "🧠 Creating extension files..."})
        
        # Get response from Mimo
        response = await asyncio.to_thread(
            llm.invoke,
            [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=prompt)
            ]
        )
        
        content = response.content.strip()
        
        # Aggressive cleanup of AI responses
        # Remove markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1]
            if "```" in content:
                content = content.split("```")[0]
        elif "```" in content:
            parts = content.split("```")
            for part in parts:
                if "{" in part and "files" in part:
                    content = part
                    break
        
        content = content.strip()
        
        # Find JSON boundaries
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        
        if json_start >= 0 and json_end > json_start:
            content = content[json_start:json_end]
        
        # Remove any text before the first {
        if not content.startswith("{"):
            idx = content.find("{")
            if idx > 0:
                content = content[idx:]
        
        # Try to parse JSON response
        try:
            result = json.loads(content)
            files = result.get("files", [])
        except json.JSONDecodeError:
            # If JSON parsing fails, create fallback files
            yield format_sse({"type": "thinking", "text": "⚠️ JSON parse failed, creating clean fallback files"})
            files = create_fallback_files(request)
        
        # Clean each file content to remove AI suggestions
        cleaned_files = []
        for file in files:
            file_name = file.get("name", "unknown")
            file_content = file.get("content", "")
            
            # Clean the content
            cleaned_content = clean_file_content(file_content, file_name, request)
            cleaned_files.append({"name": file_name, "content": cleaned_content})
        
        # Stream each file with character-by-character animation
        for file in cleaned_files:
            file_name = file["name"]
            file_content = file["content"]
            
            yield format_sse({"type": "file_start", "file": file_name})
            
            # Stream content in chunks for typing animation
            chunk_size = 50
            for i in range(0, len(file_content), chunk_size):
                partial_content = file_content[:i + chunk_size]
                yield format_sse({"type": "file_content", "file": file_name, "content": partial_content})
                await asyncio.sleep(0.02)
            
            yield format_sse({"type": "file_complete", "file": file_name, "content": file_content})
            yield format_sse({"type": "thinking", "text": f"✅ Created {file_name}"})
        
        yield format_sse({
            "type": "complete",
            "files": cleaned_files,
            "message": "Extension generated successfully!"
        })
        
    except Exception as e:
        yield format_sse({"type": "error", "message": f"Generation error: {str(e)}"})


def clean_file_content(content: str, file_name: str, request: ExtensionRequest) -> str:
    """Aggressively clean file content - remove ALL AI suggestions."""
    
    # List of AI suggestion patterns to remove
    ai_patterns = [
        "## ", "### ", "**", "``", "here's", "here is", "this extension",
        "features:", "note:", "explanation:", "key features", "requirements:",
        "implementation", "design pattern", "architecture", "functionality",
        "you can", "you should", "make sure", "don't forget", "remember to",
        "this code", "this file", "the following", "below is", "above is",
        "i've", "i have", "we have", "we can", "let me", "let's",
        "in this", "for this", "with this", "using this",
        "demonstrates", "provides", "includes", "contains",
        "main features", "key components", "core functionality",
        "step 1", "step 2", "step 3", "first,", "second,", "finally,",
        "overview", "summary", "description:", "purpose:"
    ]
    
    lines = content.split("\n")
    cleaned_lines = []
    
    for line in lines:
        line_lower = line.lower().strip()
        
        # Skip empty lines at start
        if not cleaned_lines and not line.strip():
            continue
        
        # Skip lines with AI patterns
        if any(pattern in line_lower for pattern in ai_patterns):
            continue
        
        # Skip markdown-style lists (but keep HTML lists)
        if line.strip().startswith("- ") and "<" not in line:
            continue
        
        # Skip numbered lists that look like explanations
        if line.strip() and line.strip()[0].isdigit() and ". " in line[:4] and "<" not in line:
            if not any(c in line for c in ["{", "}", "(", ")", ";", ":"]):
                continue
        
        # Skip comment blocks with AI explanations
        if line.strip().startswith("//"):
            comment_lower = line.lower()
            if any(word in comment_lower for word in [
                "feature", "functionality", "component", "explanation",
                "implement", "this will", "this is", "used for", "provides"
            ]):
                continue
        
        # Skip CSS/JS comments with explanations
        if "/*" in line or "*/" in line:
            comment_lower = line.lower()
            if any(word in comment_lower for word in [
                "feature", "functionality", "explanation", "overview"
            ]):
                continue
        
        cleaned_lines.append(line)
    
    cleaned_content = "\n".join(cleaned_lines).strip()
    
    # Final cleanup - remove any remaining markdown
    cleaned_content = cleaned_content.replace("**", "")
    cleaned_content = cleaned_content.replace("##", "")
    cleaned_content = cleaned_content.replace("###", "")
    
    # Remove lines that are just headers/titles
    final_lines = []
    for line in cleaned_content.split("\n"):
        # Skip lines that look like markdown headers
        if line.strip() and not line.strip().startswith("#") or "<" in line or "{" in line:
            final_lines.append(line)
    
    cleaned_content = "\n".join(final_lines).strip()
    
    # Validate content quality
    if not validate_content_quality(cleaned_content, file_name):
        print(f"Content validation failed for {file_name}, using fallback")
        return create_fallback_file_content(file_name, request)
    
    return cleaned_content


def validate_content_quality(content: str, file_name: str) -> bool:
    """Strictly validate if generated content is clean code only."""
    
    # Basic length check
    if len(content.strip()) < 50:
        return False
    
    # STRICT: Check for ANY AI suggestion remnants
    ai_garbage = [
        "here's", "here is", "this is", "note that", "make sure to", 
        "don't forget", "## ", "**", "### ", "overview", "summary",
        "key features", "main features", "functionality:", "provides",
        "demonstrates", "the following", "below is", "i've created",
        "let me", "i'll", "we can", "you can", "you should"
    ]
    
    content_lower = content.lower()
    for pattern in ai_garbage:
        if pattern in content_lower:
            return False
    
    # File-specific validation
    if file_name.endswith(".json"):
        try:
            import json
            parsed = json.loads(content)
            # Check for required manifest fields
            required_fields = ["manifest_version", "name", "version"]
            if not all(field in parsed for field in required_fields):
                return False
        except json.JSONDecodeError:
            return False
    
    elif file_name.endswith(".html"):
        # Must have basic HTML structure
        if not all(tag in content.lower() for tag in ["<!doctype", "<html", "<head>", "<body>"]):
            return False
        # Must link CSS and JS
        if "<link" not in content or "<script" not in content:
            return False
        # Should NOT have markdown in HTML
        if "## " in content or "**" in content:
            return False
    
    elif file_name.endswith(".css"):
        # Check for basic CSS structure (actual braces, not escaped)
        if content.count("{") < 3 or content.count("}") < 3:
            return False
        # Must have some styling
        if ":" not in content or ";" not in content:
            return False
        # Should NOT have markdown in CSS
        if "## " in content or "**" in content or "- " in content.split("\\n")[0]:
            return False
    
    elif file_name.endswith(".js"):
        # Check for basic JS structure
        has_function = "function" in content or "=>" in content or "class " in content
        if not has_function:
            return False
        # Should have event listeners for popup
        if "addEventListener" not in content and "onclick" not in content.lower():
            return False
        # Basic syntax check
        if abs(content.count("{") - content.count("}")) > 2:
            return False
        if abs(content.count("(") - content.count(")")) > 2:
            return False
        # Should NOT have markdown in JS
        if "## " in content or "**" in content:
            return False
    
    return True


def create_fallback_files(request: ExtensionRequest) -> list:
    """Create clean fallback files when AI response is unusable."""
    return [
        {"name": "manifest.json", "content": create_fallback_file_content("manifest.json", request)},
        {"name": "popup/popup.html", "content": create_fallback_file_content("popup/popup.html", request)},
        {"name": "popup/popup.css", "content": create_fallback_file_content("popup/popup.css", request)},
        {"name": "popup/popup.js", "content": create_fallback_file_content("popup/popup.js", request)}
    ]


def create_fallback_file_content(file_name: str, request: ExtensionRequest) -> str:
    """Create premium, modern fallback content."""
    
    if file_name == "manifest.json":
        return f'''{{
  "manifest_version": 3,
  "name": "{request.name}",
  "version": "{request.version}",
  "description": "{request.description}",
  "action": {{
    "default_popup": "popup/popup.html"
  }},
  "permissions": ["activeTab"]
}}'''
    
    elif file_name.endswith(".html"):
        return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{request.name}</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="glass-container">
    <div class="header">
      <h1 class="title">{request.name}</h1>
      <p class="subtitle">{request.description}</p>
    </div>
    
    <div class="content">
      <div class="feature-card">
        <div class="icon">⚡</div>
        <h3>Quick Action</h3>
        <p>Primary functionality</p>
        <button class="modern-btn primary" id="primaryBtn">
          <span>Get Started</span>
        </button>
      </div>
      
      <div class="feature-card">
        <div class="icon">⚙️</div>
        <h3>Settings</h3>
        <p>Customize your experience</p>
        <button class="modern-btn secondary" id="settingsBtn">
          <span>Configure</span>
        </button>
      </div>
    </div>
    
    <div class="footer">
      <div class="status" id="status">
        <div class="status-dot"></div>
        <span>Ready</span>
      </div>
    </div>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>'''
    
    elif file_name.endswith(".css"):
        return f'''/* Modern Glass Morphism Extension */
:root {{
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  --glass-bg: rgba(255, 255, 255, 0.1);
  --glass-border: rgba(255, 255, 255, 0.2);
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.8);
  --shadow-soft: 0 8px 32px rgba(0, 0, 0, 0.1);
  --shadow-hover: 0 12px 40px rgba(0, 0, 0, 0.15);
}}

* {{
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}}

body {{
  width: 380px;
  min-height: 500px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--primary-gradient);
  overflow: hidden;
  position: relative;
}}

body::before {{
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(from 0deg, transparent, rgba(255,255,255,0.1), transparent);
  animation: rotate 20s linear infinite;
  pointer-events: none;
}}

@keyframes rotate {{
  to {{ transform: rotate(360deg); }}
}}

.glass-container {{
  padding: 24px;
  height: 100%;
  backdrop-filter: blur(20px);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  position: relative;
  z-index: 1;
}}

.header {{
  text-align: center;
  margin-bottom: 32px;
}}

.title {{
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}}

.subtitle {{
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.4;
}}

.content {{
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}}

.feature-card {{
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;
}}

.feature-card:hover {{
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
  background: rgba(255, 255, 255, 0.15);
}}

.icon {{
  font-size: 28px;
  margin-bottom: 12px;
  display: inline-block;
  animation: float 3s ease-in-out infinite;
}}

@keyframes float {{
  0%, 100% {{ transform: translateY(0); }}
  50% {{ transform: translateY(-6px); }}
}}

.feature-card h3 {{
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}}

.feature-card p {{
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.4;
}}

.modern-btn {{
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 12px 24px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
  width: 100%;
}}

.modern-btn::before {{
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.5s;
}}

.modern-btn:hover::before {{
  left: 100%;
}}

.modern-btn:hover {{
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
  background: rgba(255, 255, 255, 0.15);
}}

.modern-btn:active {{
  transform: translateY(0);
  transition: transform 0.1s;
}}

.modern-btn.primary {{
  background: var(--secondary-gradient);
  border: none;
}}

.modern-btn span {{
  position: relative;
  z-index: 1;
}}

.footer {{
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
}}

.status {{
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}}

.status-dot {{
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4ade80;
  animation: pulse 2s infinite;
}}

@keyframes pulse {{
  0%, 100% {{ opacity: 1; }}
  50% {{ opacity: 0.5; }}
}}

.loading {{
  opacity: 0.6;
  pointer-events: none;
}}

.success {{
  background: rgba(74, 222, 128, 0.2);
  border-color: rgba(74, 222, 128, 0.3);
}}

/* Responsive design */
@media (max-width: 400px) {{
  body {{
    width: 320px;
  }}
  
  .glass-container {{
    padding: 20px;
  }}
  
  .title {{
    font-size: 20px;
  }}
}}'''
    
    elif file_name.endswith(".js"):
        return f'''"use strict";

// {request.name} - Modern Extension JavaScript

class ExtensionUI {{
  constructor() {{
    this.state = {{
      isLoading: false,
      isReady: true
    }};
    
    this.init();
  }}
  
  init() {{
    this.bindEvents();
    this.updateStatus('Ready', 'success');
    this.animateEntry();
  }}
  
  bindEvents() {{
    const primaryBtn = document.getElementById('primaryBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    
    if (primaryBtn) {{
      primaryBtn.addEventListener('click', (e) => this.handlePrimaryAction(e));
    }}
    
    if (settingsBtn) {{
      settingsBtn.addEventListener('click', (e) => this.handleSettings(e));
    }}
    
    // Add keyboard support
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }}
  
  async handlePrimaryAction(event) {{
    const btn = event.currentTarget;
    
    try {{
      this.setLoading(btn, true);
      this.updateStatus('Processing...', 'loading');
      
      // Simulate async operation
      await this.sleep(1500);
      
      // Your main functionality here
      await this.performMainAction();
      
      this.updateStatus('Completed!', 'success');
      this.showFeedback(btn, 'Success!');
      
    }} catch (error) {{
      console.error('Primary action failed:', error);
      this.updateStatus('Error occurred', 'error');
      this.showFeedback(btn, 'Error', 'error');
    }} finally {{
      this.setLoading(btn, false);
    }}
  }}
  
  async handleSettings(event) {{
    const btn = event.currentTarget;
    
    try {{
      this.setLoading(btn, true);
      this.updateStatus('Opening settings...', 'loading');
      
      await this.sleep(800);
      
      // Open options page or show settings
      if (chrome.runtime.openOptionsPage) {{
        chrome.runtime.openOptionsPage();
      }} else {{
        // Fallback for inline settings
        this.showInlineSettings();
      }}
      
      this.updateStatus('Settings opened', 'success');
      
    }} catch (error) {{
      console.error('Settings failed:', error);
      this.updateStatus('Settings error', 'error');
    }} finally {{
      this.setLoading(btn, false);
    }}
  }}
  
  async performMainAction() {{
    // Get current tab info
    try {{
      const [tab] = await chrome.tabs.query({{ active: true, currentWindow: true }});
      
      if (tab) {{
        console.log('Current tab:', tab.title);
        
        // Example: Execute content script
        await chrome.tabs.sendMessage(tab.id, {{
          action: 'performAction',
          data: {{
            timestamp: Date.now(),
            tabId: tab.id
          }}
        }});
      }}
    }} catch (error) {{
      // Fallback if tabs API not available
      console.log('Tabs API not available, running local action');
    }}
  }}
  
  setLoading(button, isLoading) {{
    const span = button.querySelector('span');
    
    if (isLoading) {{
      button.classList.add('loading');
      button.disabled = true;
      if (span) span.textContent = 'Loading...';
    }} else {{
      button.classList.remove('loading');
      button.disabled = false;
      if (span) {{
        const originalText = button.id === 'primaryBtn' ? 'Get Started' : 'Configure';
        span.textContent = originalText;
      }}
    }}
  }}
  
  updateStatus(message, type = 'info') {{
    const statusElement = document.getElementById('status');
    const statusText = statusElement?.querySelector('span');
    const statusDot = statusElement?.querySelector('.status-dot');
    
    if (statusText) statusText.textContent = message;
    
    if (statusDot) {{
      statusDot.className = 'status-dot';
      if (type === 'error') {{
        statusDot.style.background = '#ef4444';
      }} else if (type === 'loading') {{
        statusDot.style.background = '#f59e0b';
      }} else {{
        statusDot.style.background = '#4ade80';
      }}
    }}
  }}
  
  showFeedback(button, message, type = 'success') {{
    const span = button.querySelector('span');
    const originalText = span.textContent;
    
    span.textContent = message;
    button.classList.add(type);
    
    setTimeout(() => {{
      span.textContent = originalText;
      button.classList.remove(type);
    }}, 2000);
  }}
  
  showInlineSettings() {{
    // Create a simple settings overlay
    const overlay = document.createElement('div');
    overlay.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
        <div style="background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; backdrop-filter: blur(20px); max-width: 300px;">
          <h3 style="color: var(--text-primary); margin-bottom: 16px;">Settings</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px;">Settings panel coming soon!</p>
          <button onclick="this.parentElement.parentElement.remove()" style="background: var(--secondary-gradient); border: none; border-radius: 8px; padding: 8px 16px; color: white; cursor: pointer;">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }}
  
  animateEntry() {{
    const cards = document.querySelectorAll('.feature-card');
    cards.forEach((card, index) => {{
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      
      setTimeout(() => {{
        card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }}, index * 100);
    }});
  }}
  
  handleKeyboard(event) {{
    if (event.key === 'Enter' && event.target.tagName === 'BUTTON') {{
      event.target.click();
    }}
  }}
  
  sleep(ms) {{
    return new Promise(resolve => setTimeout(resolve, ms));
  }}
}}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {{
  try {{
    new ExtensionUI();
    console.log('{request.name} initialized successfully');
  }} catch (error) {{
    console.error('Extension initialization failed:', error);
  }}
}});

// Handle chrome extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {{
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {{
    console.log('Message received:', request);
    sendResponse({{ status: 'received' }});
  }});
}}'''
    
    return f"// {file_name} for {request.name}"


@app.get("/")
async def root():
    return {"status": "ok", "message": "Extension Builder Agent API v3.0 - Fast Mode"}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model": "xiaomi/mimo-v2-flash"
    }


@app.post("/generate")
async def generate_extension(request: ExtensionRequest):
    """Generate extension with SSE streaming."""
    return StreamingResponse(
        generate_extension_files(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AGENT_PORT", 8000))
    print(f"🚀 Fast Agent Server on port {port}")
    print(f"🤖 Model: {os.getenv('AGENT_MODEL', 'qwen/qwen3-coder:free')}")
    uvicorn.run(app, host="0.0.0.0", port=port)

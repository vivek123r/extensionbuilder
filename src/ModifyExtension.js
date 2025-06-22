// src/ModifyExtension.js
import React, {useRef} from "react";

export default function ModifyExtension() {

  const fileInputRef = useRef(null);


  const modifyFile = async  (event) => {
    const file = fileInputRef.current.files;
    event.preventDefault();
    if (!file) {
      console.error("No file selected.");
      return;
    }
    Array.from(file).forEach(file => {
    console.log("Selected file:", file.webkitRelativePath || file.name);
    });
    // Logic to handle file upload and modification goes here
    console.log("File uploaded and modification started.");
    const selectedOption = document.getElementById("browser-select").value;
    console.log("Selected browser:", selectedOption);

    const textContents = await Promise.all(
    Array.from(file).map(async (file) => {
      const content = await file.text(); // gets inner words
      return `📄 ${file.name}\n\n${content}`;
      })
    );

      // Combine contents into one prompt
      const combinedText = textContents.join("\n\n---\n\n");
      const instruction = "You are an expert in browser extensions. Improve or optimize the following extension code. Suggest fixes or enhancements.\n\n";
      const prompt = instruction + combinedText;
      await geminiApi(prompt);
  };


  const geminiApi = async (combinedText ) => {
    let apiKey = "AIzaSyBq23mkvFSmfqecjNgkfq9rA8V34nrE6Ng";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: combinedText }]
      }
    ]
  };
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    const data = await response.json();
    if (response.ok) {
      console.log("Response from Gemini API:", data);
    } else {
      console.error("Error from Gemini API:", data);
    }


  } catch (error) {
    
  }
};


  return (
    <div>
      <h2>Modify Extension</h2>
      <p>Here you can upload and modify an existing browser extension.</p>
      <select id="browser-select">
        <option id="chromium-based" >brave</option>
        <option id="chromium-based" >chrome</option>
        <option id="chromium-based" >edge</option>
        <option id="chromium-based" >vivaldi</option>
        <option id="chromium-based" >opera</option>
        <option id="Gecko Engine" >firefox</option>
        <option id="Gecko Engine" >Firefox Developer Edition</option>
        <option id="chromium-based" >safari</option>
      </select>
      <p>
        Select the browser for which you want to modify the extension. You can
        upload a ZIP file containing the extension files.
      </p>
      <input type="file"
        webkitdirectory="true"
        directory=""
        multiple
        ref={fileInputRef}/>
      <button type="submit" onClick={modifyFile}>Upload and Modify</button>
    </div>
  );
}

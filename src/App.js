import React from "react";
import { BrowserRouter } from "react-router-dom";
import { Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import CreateExtensionNew from "./CreateExtensionNew";
import ModifyExtension from "./ModifyExtension";

function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<CreateExtensionNew />} />
      <Route path="/modify" element={<ModifyExtension />} />
    </Routes>
    </BrowserRouter>
  );
}
export default App;

import React from "react";
import { BrowserRouter } from "react-router-dom";
import { Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import CreateExtension from "./CreateExtension";
import ModifyExtension from "./ModifyExtension";

function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<CreateExtension />} />
      <Route path="/modify" element={<ModifyExtension />} />
    </Routes>
    </BrowserRouter>
  );
}
export default App;

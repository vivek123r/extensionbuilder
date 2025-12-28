import React from "react";
import { BrowserRouter } from "react-router-dom";
import { Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import CreateExtensionNew from "./CreateExtensionNew";
import ModifyExtension from "./ModifyExtension";
import Login from "./Login";
import Signup from "./Signup";
import MyExtensions from "./MyExtensions";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route 
            path="/create-extension" 
            element={
              <ProtectedRoute>
                <CreateExtensionNew />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/my-extensions" 
            element={
              <ProtectedRoute>
                <MyExtensions />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/modify" 
            element={
              <ProtectedRoute>
                <ModifyExtension />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
export default App;

import React from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="homepage-container">
      <div className="homepage-card">
        <h1 className="homepage-title">Extension Toolkit</h1>
        <p className="homepage-description">
          Choose what you'd like to do:
        </p>
        <div className="homepage-buttons">
          <button
            className="homepage-button create"
            onClick={() => navigate("/create")}
          >
            Create Extension
          </button>
          <button
            className="homepage-button modify"
            onClick={() => navigate("/modify")}
          >
            Modify Extension
          </button>
        </div>
      </div>
    </div>
  );
}

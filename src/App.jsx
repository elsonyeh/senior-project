import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import SwiftTastePage from "./pages/SwiftTastePage";
import BottomNav from "./components/BottomNav";

import "./App.css";

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Navigate to="/swift" />} />
          <Route path="/swift" element={<SwiftTastePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

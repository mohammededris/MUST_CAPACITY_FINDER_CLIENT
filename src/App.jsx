import "./App.css";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Support from "./pages/Support";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/support" element={<Support />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;

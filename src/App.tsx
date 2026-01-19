import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import JDScreener from "./pages/jdScreener";
import { auth, logout } from "./firebase";

function App() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <nav
          style={{
            padding: "10px",
            background: "#f0f0f0",
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <strong>UTILS</strong>
          <Link to="/">Home</Link>
          <Link to="/jd-screener">JD Screener</Link>
          <button onClick={logout} style={{ marginLeft: "auto" }}>
            Logout
          </button>
        </nav>

        <Routes>
          <Route
            path="/"
            element={
              <div>
                <h1>Dashboard</h1>
                <p>Select a tool from the menu.</p>
              </div>
            }
          />
          <Route path="/jd-screener" element={<JDScreener />} />
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  );
}

export default App;

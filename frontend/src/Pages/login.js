import { useState } from "react";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Welcome ${data.name}!`);
      } else {
        setError("Invalid username or password");
      }
    } catch (err) {
      setError("Cannot connect to server");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>OSC StudentNET</h1>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Student ID"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="error">{error}</p>}

          <button type="submit">
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
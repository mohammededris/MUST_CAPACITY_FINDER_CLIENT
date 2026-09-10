import "./Landing.css";
import { SignInButton, SignUpButton, Show } from "@clerk/react";
import { Navbar } from "../components/Navbar";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <>
      <Navbar />
      <div className="hero-section">
        <h1>Welcome to MUST Capacity Alerter</h1>
        <p>
          Finding a seat in a closed course shouldn't be a struggle. We
          automated the process for you.
        </p>
      </div>
      <div className="main-section">
        <div>
          <h2>Sign up</h2>
          <p>Create an account to get started.</p>
        </div>

        <div>
          <h2>Submit a request</h2>
          <p>
            Enter the Subject Code (e.g., CSE3) and Course Number (e.g., 03) you
            need.
          </p>
          <p className="note">* Note: Each user can only monitor one course.</p>
        </div>

        <div>
          <h2>Get Notified</h2>
          <p>
            We check the system 24/7. When a seat opens, you'll get an instant
            WhatsApp message.
          </p>
        </div>
      </div>

      <Show when="signed-out">
        <div className="cta-section">
          <h2>Ready to get started?</h2>
          <SignInButton />
          <SignUpButton />
        </div>
      </Show>
      <Show when="signed-in">
        <div className="cta-section">
          <h2>What are you doing here?</h2>
          <h2>Go to your alerts</h2>
          <button
            className="go-to-alerts-button"
            onClick={() => navigate("/home")}
          >
            ALERTS
          </button>
        </div>
      </Show>
    </>
  );
}

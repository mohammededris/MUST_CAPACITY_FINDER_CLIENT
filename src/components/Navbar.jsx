import "./navbar.css";
import { Show, UserButton } from "@clerk/react";

import { Link } from "react-router-dom";

export function Navbar() {
  return (
    <nav>
      <div className="nav-logo">MUST Capacity Alerter</div>
      <div className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/home">Alerts</Link>
        <Link to="/support">Support us</Link>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </nav>
  );
}

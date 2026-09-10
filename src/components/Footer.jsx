import { Link } from "react-router-dom";

import "./Footer.css";

export function Footer() {
  return (
    <>
      <div className="footer-container">
        <div className="footer-social">
          <Link to="https://github.com/mohammededris" target="_blank">
            GitHub
          </Link>
          <Link
            to="https://www.linkedin.com/in/mohammed-nasser-4752bb24b/"
            target="_blank"
          >
            LinkedIn
          </Link>
        </div>

        <div className="footer-copyright">
          <p>© 2026 MUST Capacity Alerter. All rights reserved.</p>
        </div>
      </div>
    </>
  );
}

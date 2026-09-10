import "./Support.css";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { useState } from "react";

const donationLinks = [
  {
    name: "Donation link (InstaPay)",
    url: import.meta.env.VITE_DONATION_LINK_1,
  },
  {
    name: "Donation link 2",
    url: import.meta.env.VITE_DONATION_LINK_2,
  },
];

export default function Support() {
  const [shareMessage, setShareMessage] = useState("");

  const handleShare = async () => {
    const shareData = {
      title: "MUST Capacity Finder",
      text: "Use MUST Capacity Finder to track course capacity requests.",
      url: window.location.origin,
    };

    try {
      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.origin);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = window.location.origin;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }

      setShareMessage("Website link copied.");
    } catch {
      setShareMessage("Unable to share the website link.");
    }
  };

  return (
    <main className="support-page">
      <Navbar />

      <section className="support-content">
        <p className="panel-kicker">Keep it running</p>
        <h1>Support us</h1>
        <p className="support-description">
          Your support helps us keep MUST Capacity Alerter available and
          reliable for students.
        </p>

        <div className="donation-links">
          {donationLinks.map((link) =>
            link.url ? (
              <a
                className="donation-link"
                href={link.url}
                key={link.name}
                target="_blank"
                rel="noreferrer"
              >
                {link.name}
                <span aria-hidden="true">↗</span>
              </a>
            ) : null,
          )}
        </div>

        {!donationLinks.some((link) => link.url) && (
          <p className="support-note">Donation links will be available soon.</p>
        )}

        <div className="support-actions">
          <button
            className="share-support-button"
            type="button"
            onClick={handleShare}
          >
            Share website
          </button>
          {shareMessage && <p className="support-note">{shareMessage}</p>}
        </div>
      </section>

      <Footer />
    </main>
  );
}

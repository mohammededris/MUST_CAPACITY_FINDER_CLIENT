import { Navbar } from "../components/Navbar";
import { useUser, useAuth } from "@clerk/react";
import { useState, useEffect, useRef } from "react";
import "./Home.css";
import { Footer } from "../components/Footer";

export default function Home() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const activityRef = useRef(null);
  const shouldScrollToActivity = useRef(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [courseData, setCourseData] = useState(null);
  const [toggledId, setToggledId] = useState(null);
  const [showSharePopup, setShowSharePopup] = useState(false);

  const [formData, setFormData] = useState({
    subject: "",
    courseCode: "",
    crn: "",
    whatsAppNumber: "",
    userName: user.fullName,
    userId: user.id,
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    subject: "",
    courseCode: "",
    crn: "",
    whatsAppNumber: "",
    userName: "",
  });

  const id = courseData?.notifications?.[0]?._id;

  console.log("Course Data:", courseData);
  console.log("Course IDs:", id);

  const alertLimit = courseData?.alertLimit ?? 1;
  const alertCount =
    courseData?.alertCount ?? courseData?.notifications?.length ?? 0;
  const limitReached = alertCount >= alertLimit;

  const ensureUserMetadata = async () => {
    const alreadyChecked = sessionStorage.getItem("metadataChecked");
    if (alreadyChecked) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await Clerk.session.getToken()}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to initialize user metadata: ${response.status}`,
        );
      }

      sessionStorage.setItem("metadataChecked", "true");
    } catch (err) {
      console.error("Error ensuring user metadata:", err);
      // not fatal — don't block the rest of the page
    }
  };

  const toggleAlert = async (id, isCurrentlyStopped) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/courses/${isCurrentlyStopped ? "start" : "stop"}/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await Clerk.session.getToken()}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to toggle alert for course with ID ${id}. Status: ${response.status}`,
        );
      }

      await submitted();
      setToggledId(id);
    } catch (error) {
      console.error("Error toggling alert:", error);
    }
  };

  const editCourse = async (id, updatedData) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/courses/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await Clerk.session.getToken()}`,
          },
          body: JSON.stringify({
            ...updatedData,
            subject: updatedData.subject.trim().toUpperCase(),
            courseCode: updatedData.courseCode.trim().toUpperCase(),
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to edit course with ID ${id}. Status: ${response.status}`,
        );
      }
      await submitted();
    } catch (error) {
      console.error("Error editing course:", error);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        ...formData,
        subject: formData.subject.trim().toUpperCase(),
        courseCode: formData.courseCode.trim().toUpperCase(),
      };
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/courses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await Clerk.session.getToken()}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to submit registration");
      }

      await response.json();
      shouldScrollToActivity.current = true;
      setShowSuccess(true);
      setShowSharePopup(true);
    } catch (err) {
      setSubmitError(err.message);
      console.error("Error submitting registration:", err);
    } finally {
      setIsSubmitting(false);
    }

    console.log(formData);
  };

  const submitted = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/v1/courses`, {
        method: "get",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await Clerk.session.getToken()}`,
          userId: user.id,
        },
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch course data");
        }
        return setCourseData(await response.json());
      });
    } catch (err) {
      console.error("Cannot GET the course data:", err);
    }
  };

  const startEditing = (notification) => {
    setEditingId(notification._id);
    setEditForm({
      subject: notification.subject ?? "",
      courseCode: notification.courseCode ?? "",
      crn: notification.crn ?? "",
      whatsAppNumber: notification.whatsAppNumber ?? "",
      userName: notification.userName ?? user.fullName,
    });
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  };

  const saveEdit = async (id) => {
    await editCourse(id, editForm);
    setEditingId(null);
  };

  const handleShare = async () => {
    const shareData = {
      title: "MUST Capacity Finder",
      text: "Use MUST Capacity Finder to track course capacity requests.",
      url: window.location.origin,
    };

    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(window.location.origin);
      alert("Website link copied.");
    }
  };

  useEffect(() => {
    if (!showSuccess) return;

    const timer = setTimeout(() => {
      setShowSuccess(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showSuccess]);

  useEffect(() => {
    submitted();
  }, [showSuccess]);

  useEffect(() => {
    if (!toggledId) return;

    const timer = setTimeout(() => {
      setToggledId(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [toggledId]);

  useEffect(() => {
    if (!courseData || !shouldScrollToActivity.current) return;

    if (window.matchMedia("(max-width: 700px)").matches) {
      activityRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    shouldScrollToActivity.current = false;
  }, [courseData]);

  useEffect(() => {
    if (user) {
      ensureUserMetadata();
    }
  }, [user]);

  return (
    <main className="home-page">
      <Navbar />

      <div className="home-shell">
        <section className="home-hero">
          <div>
            <h1 className="home-title">Hello, {user.fullName}.</h1>
            <p className="home-subtitle">
              Register a course and keep track of your submitted capacity
              requests in one place.
            </p>
          </div>
        </section>

        <div className="home-layout">
          <section className="home-panel registration-panel">
            <p className="panel-kicker">New request</p>
            <h2 className="panel-title">Register a course</h2>
            <p className="panel-description">
              Add the course details below to submit a capacity request.
            </p>

            <form className="registration-form" onSubmit={handleSubmit}>
              <div className="form-field">
                <label htmlFor="subject">Subject</label>
                <input
                  type="text"
                  placeholder="CSE5"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-field">
                <label htmlFor="courseCode">Course code</label>
                <input
                  type="text"
                  placeholder="56"
                  id="courseCode"
                  name="courseCode"
                  value={formData.courseCode}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-field">
                <label htmlFor="crn">CRN</label>
                <input
                  type="text"
                  placeholder="4565"
                  id="crn"
                  name="crn"
                  value={formData.crn}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-field">
                <label htmlFor="whatsAppNumber">WhatsApp number</label>
                <input
                  type="tel"
                  placeholder="201145889968"
                  id="whatsAppNumber"
                  name="whatsAppNumber"
                  value={formData.whatsAppNumber}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>

              {submitError && <p className="form-error">{submitError}</p>}

              <button
                className="submit-button"
                type="submit"
                disabled={isSubmitting || limitReached}
              >
                {isSubmitting ? (
                  <span className="button-loading">
                    <span className="spinner" />
                    Submitting...
                  </span>
                ) : limitReached ? (
                  "Limit reached"
                ) : (
                  "Submit request"
                )}
              </button>
              {limitReached && (
                <p className="form-error">
                  You've reached your limit of {alertLimit} alert
                  {alertLimit === 1 ? "" : "s"}. Stop or delete an existing one
                  to add another.
                </p>
              )}

              {showSuccess && (
                <p className="success-message">
                  Course submitted successfully.
                </p>
              )}
            </form>
          </section>

          <section ref={activityRef} className="home-panel course-panel">
            <div className="course-panel-header">
              <div>
                <p className="panel-kicker">Your activity</p>
                <h2 className="panel-title">Course data</h2>
              </div>

              <span className="course-count">
                {courseData?.notifications?.length ?? 0} requests
              </span>
            </div>

            {courseData?.notifications?.length ? (
              <div className="course-list">
                {courseData.notifications.map((notification, index) => (
                  <article
                    className="course-card"
                    key={notification._id ?? index}
                  >
                    {editingId === notification._id ? (
                      <>
                        <label>
                          Subject
                          <input
                            name="subject"
                            value={editForm.subject}
                            onChange={handleEditChange}
                            required
                          />
                        </label>

                        <label>
                          Course code
                          <input
                            name="courseCode"
                            value={editForm.courseCode}
                            onChange={handleEditChange}
                            required
                          />
                        </label>

                        <label>
                          CRN
                          <input
                            name="crn"
                            value={editForm.crn}
                            onChange={handleEditChange}
                            required
                          />
                        </label>

                        <label>
                          WhatsApp number
                          <input
                            type="tel"
                            name="whatsAppNumber"
                            value={editForm.whatsAppNumber}
                            onChange={handleEditChange}
                            required
                          />
                        </label>

                        <button
                          className="edit-course-button"
                          type="button"
                          onClick={() => saveEdit(notification._id)}
                        >
                          Save changes
                        </button>

                        <button
                          className="toggle-alert-button"
                          type="button"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <p>
                          <strong>Subject</strong>
                          <span>{notification.subject}</span>
                        </p>

                        <p>
                          <strong>Course code</strong>
                          <span>{notification.courseCode}</span>
                        </p>

                        <p>
                          <strong>CRN</strong>
                          <span>{notification.crn}</span>
                        </p>

                        <p>
                          <strong>WhatsApp Number</strong>
                          <span>{notification.whatsAppNumber}</span>
                        </p>

                        <button
                          className="edit-course-button"
                          type="button"
                          onClick={() => startEditing(notification)}
                          disabled={isSubmitting}
                        >
                          Edit Course
                        </button>
                      </>
                    )}

                    <button
                      className="toggle-alert-button"
                      onClick={() =>
                        toggleAlert(notification._id, notification.stopAlert)
                      }
                      disabled={isSubmitting}
                    >
                      {notification.stopAlert ? "Start Alert" : "Stop Alert"}
                    </button>

                    {toggledId === notification._id && (
                      <p className="success-message">
                        {notification.stopAlert
                          ? "Alert stopped."
                          : "Alert started."}
                      </p>
                    )}
                    {showSharePopup && (
                      <div
                        className="share-overlay"
                        role="dialog"
                        aria-modal="true"
                      >
                        <div className="share-popup">
                          <button
                            className="share-close"
                            type="button"
                            onClick={() => setShowSharePopup(false)}
                            aria-label="Close popup"
                          >
                            ×
                          </button>

                          <p className="panel-kicker">Thank you</p>
                          <h2>Help us spread the word</h2>
                          <p>
                            Your course request was submitted successfully.
                            Share MUST Capacity Finder with a friend and help
                            support the project.
                          </p>

                          <div className="share-actions">
                            <button
                              className="share-button"
                              type="button"
                              onClick={handleShare}
                            >
                              Share website
                            </button>
                            <button
                              className="share-later-button"
                              type="button"
                              onClick={() => setShowSharePopup(false)}
                            >
                              Maybe later
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No course requests have been submitted yet.
              </div>
            )}
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}

/*
<main className="home-page">
      <Navbar />
      <h1>Hello, {user.fullName}!</h1>
      <div></div>
      <div>
        <form className="registration-form" onSubmit={handleSubmit}>
          <h1>Register</h1>
          <label htmlFor="subject">Subject:</label>
          <input
            type="text"
            placeholder="CSE5"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />

          <label htmlFor="courseCode">Course Code:</label>
          <input
            type="text"
            placeholder="56"
            id="courseCode"
            name="courseCode"
            value={formData.courseCode}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />

          <label htmlFor="crn">CRN:</label>
          <input
            type="text"
            placeholder="4565"
            id="crn"
            name="crn"
            value={formData.crn}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />

          <label htmlFor="whatsAppNumber">WhatsApp Number:</label>
          <input
            type="number"
            placeholder="Enter your WhatsApp number"
            id="whatsAppNumber"
            name="whatsAppNumber"
            value={formData.whatsAppNumber}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />

          {submitError && <p className="form-error">{submitError}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="button-loading">
                <span className="spinner" />
                Submitting...
              </span>
            ) : (
              "Submit"
            )}
          </button>
        </form>
      </div>

      <div>
        {courseData && (
          <div>
            {courseData.notifications.map((notification, index) => (
              <div key={index}>
                <p>Subject: {notification.subject}</p>
                <p>Course Code: {notification.courseCode}</p>
                <p>CRN: {notification.crn}</p>
                <p>WhatsApp Number: {notification.whatsAppNumber}</p>
              </div>
            ))}
          </div>
        )}
        {showSuccess}
        {console.log("Course Data:", courseData)}
      </div>
    </main>
 */

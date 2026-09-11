import { Navbar } from "../components/Navbar";
import { useUser, useAuth } from "@clerk/react";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import "./Home.css";
import { Footer } from "../components/Footer";

const countryDisplayNames = new Intl.DisplayNames(["en"], {
  type: "region",
});

const countries = getCountries()
  .map((country) => ({
    code: country,
    name: countryDisplayNames.of(country) ?? country,
    callingCode: getCountryCallingCode(country),
  }))
  .sort((first, second) => first.name.localeCompare(second.name));

const searchCachePrefix = "must-capacity-search";

const readSearchCache = (key) => {
  try {
    const cachedValue = sessionStorage.getItem(key);
    const parsedValue = cachedValue ? JSON.parse(cachedValue) : null;
    return Array.isArray(parsedValue) ? parsedValue : null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
};

const writeSearchCache = (key, value) => {
  sessionStorage.setItem(key, JSON.stringify(value));
};

const normalizePhoneForApi = (value, country) => {
  const phoneNumber = parsePhoneNumberFromString(value, country);

  if (!phoneNumber || !phoneNumber.isValid()) {
    throw new Error(
      "Please enter a valid phone number for the selected country.",
    );
  }

  return phoneNumber.number.replace(/\D/g, "");
};

function SearchableSelect({
  id,
  name = id,
  value,
  options,
  placeholder,
  onChange,
  disabled,
}) {
  const listId = `${id}-options`;

  return (
    <>
      <input
        className="search-select"
        type="search"
        id={id}
        name={name}
        list={listId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        required
        disabled={disabled}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}

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
  const [phoneCountry, setPhoneCountry] = useState("EG");
  const [subjects, setSubjects] = useState([]);
  const [courseNumbers, setCourseNumbers] = useState([]);
  const [crns, setCrns] = useState([]);
  const [editCourseNumbers, setEditCourseNumbers] = useState([]);
  const [editCrns, setEditCrns] = useState([]);
  const [isLoadingSearchOptions, setIsLoadingSearchOptions] = useState(false);
  const [searchOptionsError, setSearchOptionsError] = useState(null);

  const [formData, setFormData] = useState({
    subject: "",
    courseCode: "",
    crn: "",
    whatsAppNumber: "",
    userName: user.fullName,
    userId: user.id,
  });

  const [editingId, setEditingId] = useState(null);
  const [editError, setEditError] = useState(null);
  const [editPhoneCountry, setEditPhoneCountry] = useState("EG");
  const [editForm, setEditForm] = useState({
    subject: "",
    courseCode: "",
    crn: "",
    whatsAppNumber: "",
    userName: "",
  });

  const alertLimit = courseData?.alertLimit ?? 1;
  const alertCount =
    courseData?.alertCount ?? courseData?.notifications?.length ?? 0;
  const limitReached = alertCount >= alertLimit;

  const ensureUserMetadata = useCallback(async () => {
    const alreadyChecked = sessionStorage.getItem("metadataChecked");
    if (alreadyChecked) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getToken()}`,
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
  }, [getToken]);

  const toggleAlert = async (id, isCurrentlyStopped) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/courses/${isCurrentlyStopped ? "start" : "stop"}/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getToken()}`,
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
      if (!subjects.includes(updatedData.subject)) {
        throw new Error("Please select a subject from the list.");
      }

      if (!editCourseNumbers.includes(updatedData.courseCode)) {
        throw new Error("Please select a course code from the list.");
      }

      if (!editCrns.includes(updatedData.crn)) {
        throw new Error("Please select a CRN from the list.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/courses/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getToken()}`,
          },
          body: JSON.stringify({
            ...updatedData,
            subject: updatedData.subject.trim().toUpperCase(),
            courseCode: updatedData.courseCode.trim().toUpperCase(),
            whatsAppNumber: normalizePhoneForApi(
              updatedData.whatsAppNumber,
              editPhoneCountry,
            ),
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to edit course with ID ${id}. Status: ${response.status}`,
        );
      }
      await submitted();
      return true;
    } catch (error) {
      console.error("Error editing course:", error);
      setEditError(error.message);
      return false;
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubjectChange = (event) => {
    setFormData((previousData) => ({
      ...previousData,
      subject: event.target.value,
      courseCode: "",
      crn: "",
    }));
    setCourseNumbers([]);
    setCrns([]);
    setSearchOptionsError(null);
  };

  const handleCourseNumberChange = (event) => {
    setFormData((previousData) => ({
      ...previousData,
      courseCode: event.target.value,
      crn: "",
    }));
    setCrns([]);
    setSearchOptionsError(null);
  };

  const handleEditSubjectChange = (event) => {
    setEditForm((previousForm) => ({
      ...previousForm,
      subject: event.target.value,
      courseCode: "",
      crn: "",
    }));
    setEditCourseNumbers([]);
    setEditCrns([]);
  };

  const handleEditCourseNumberChange = (event) => {
    setEditForm((previousForm) => ({
      ...previousForm,
      courseCode: event.target.value,
      crn: "",
    }));
    setEditCrns([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!subjects.includes(formData.subject)) {
        throw new Error("Please select a subject from the list.");
      }

      if (!courseNumbers.includes(formData.courseCode)) {
        throw new Error("Please select a course code from the list.");
      }

      if (!crns.includes(formData.crn)) {
        throw new Error("Please select a CRN from the list.");
      }

      const payload = {
        ...formData,
        subject: formData.subject.trim().toUpperCase(),
        courseCode: formData.courseCode.trim().toUpperCase(),
        whatsAppNumber: normalizePhoneForApi(
          formData.whatsAppNumber,
          phoneCountry,
        ),
      };
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/courses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getToken()}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to submit registration");
      }

      await response.json();
      await submitted();
      shouldScrollToActivity.current = true;
      setShowSuccess(true);
      setShowSharePopup(true);
    } catch (err) {
      setSubmitError(err.message);
      console.error("Error submitting registration:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitted = useCallback(async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/v1/courses`, {
        method: "get",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
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
  }, [getToken, user.id]);

  const startEditing = (notification) => {
    const savedPhone = notification.whatsAppNumber ?? "";
    const phoneNumber = parsePhoneNumberFromString(
      savedPhone.startsWith("+") ? savedPhone : `+${savedPhone}`,
    );

    setEditingId(notification._id);
    setEditError(null);
    setEditPhoneCountry(phoneNumber?.country ?? "EG");
    setEditCourseNumbers([]);
    setEditCrns([]);
    setEditForm({
      subject: notification.subject ?? "",
      courseCode: notification.courseCode ?? "",
      crn: notification.crn ?? "",
      whatsAppNumber: phoneNumber?.nationalNumber ?? savedPhone,
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
    setEditError(null);
    const wasSaved = await editCourse(id, editForm);
    if (wasSaved) setEditingId(null);
  };

  const handleShare = async () => {
    const shareData = {
      title: "MUST Capacity Alerter",
      text: "Use MUST Capacity Alerter to track course capacity requests.",
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
  }, [submitted]);

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
    if (user) ensureUserMetadata();
  }, [ensureUserMetadata, user]);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    const loadSubjects = async () => {
      const cachedSubjects = readSearchCache(`${searchCachePrefix}:subjects`);

      if (cachedSubjects?.length) {
        setSubjects(cachedSubjects);
        return;
      }

      setIsLoadingSearchOptions(true);
      setSearchOptionsError(null);

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/search`,
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${await getToken()}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error("Unable to load subjects");
        }

        const data = await response.json();
        if (!isCancelled) {
          setSubjects(data);
          writeSearchCache(`${searchCachePrefix}:subjects`, data);
        }
      } catch (error) {
        if (!isCancelled && error.name !== "AbortError") {
          setSearchOptionsError(error.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSearchOptions(false);
        }
      }
    };

    loadSubjects();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [getToken]);

  useEffect(() => {
    if (!subjects.includes(formData.subject)) return undefined;

    let isCancelled = false;
    const controller = new AbortController();

    const loadCourseNumbers = async () => {
      const cacheKey = `${searchCachePrefix}:courses:${formData.subject}`;
      const cachedCourseNumbers = readSearchCache(cacheKey);

      if (cachedCourseNumbers) {
        setCourseNumbers(cachedCourseNumbers);
        return;
      }

      setIsLoadingSearchOptions(true);
      setSearchOptionsError(null);

      try {
        const params = new URLSearchParams({
          searchSubject: formData.subject,
        });
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/search?${params}`,
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${await getToken()}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error("Unable to load course numbers");
        }

        const data = await response.json();
        if (!isCancelled) {
          setCourseNumbers(data);
          writeSearchCache(cacheKey, data);
        }
      } catch (error) {
        if (!isCancelled && error.name !== "AbortError") {
          setSearchOptionsError(error.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSearchOptions(false);
        }
      }
    };

    loadCourseNumbers();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [getToken, formData.subject, subjects]);

  useEffect(() => {
    if (
      !subjects.includes(formData.subject) ||
      !courseNumbers.includes(formData.courseCode)
    ) {
      return undefined;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const loadCrns = async () => {
      const cacheKey = `${searchCachePrefix}:crns:${formData.subject}:${formData.courseCode}`;
      const cachedCrns = readSearchCache(cacheKey);

      if (cachedCrns) {
        setCrns(cachedCrns);
        return;
      }

      setIsLoadingSearchOptions(true);
      setSearchOptionsError(null);

      try {
        const params = new URLSearchParams({
          searchSubject: formData.subject,
          searchcourseNumber: formData.courseCode,
        });
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/search?${params}`,
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${await getToken()}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error("Unable to load CRNs");
        }

        const data = await response.json();
        if (!isCancelled) {
          setCrns(data);
          writeSearchCache(cacheKey, data);
        }
      } catch (error) {
        if (!isCancelled && error.name !== "AbortError") {
          setSearchOptionsError(error.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSearchOptions(false);
        }
      }
    };

    loadCrns();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [
    getToken,
    formData.subject,
    formData.courseCode,
    subjects,
    courseNumbers,
  ]);

  useEffect(() => {
    if (!editingId || !subjects.includes(editForm.subject)) {
      return undefined;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const loadEditCourseNumbers = async () => {
      const cacheKey = `${searchCachePrefix}:courses:${editForm.subject}`;
      const cachedCourseNumbers = readSearchCache(cacheKey);

      if (cachedCourseNumbers) {
        setEditCourseNumbers(cachedCourseNumbers);
        return;
      }

      try {
        const params = new URLSearchParams({
          searchSubject: editForm.subject,
        });
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/search?${params}`,
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${await getToken()}`,
            },
          },
        );

        if (!response.ok) throw new Error("Unable to load course numbers");

        const data = await response.json();
        if (!isCancelled) {
          setEditCourseNumbers(data);
          writeSearchCache(cacheKey, data);
        }
      } catch (error) {
        if (!isCancelled && error.name !== "AbortError") {
          setSearchOptionsError(error.message);
        }
      }
    };

    loadEditCourseNumbers();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [editForm.subject, editingId, getToken, subjects]);

  useEffect(() => {
    if (
      !editingId ||
      !subjects.includes(editForm.subject) ||
      !editCourseNumbers.includes(editForm.courseCode)
    ) {
      return undefined;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const loadEditCrns = async () => {
      const cacheKey = `${searchCachePrefix}:crns:${editForm.subject}:${editForm.courseCode}`;
      const cachedCrns = readSearchCache(cacheKey);

      if (cachedCrns) {
        setEditCrns(cachedCrns);
        return;
      }

      try {
        const params = new URLSearchParams({
          searchSubject: editForm.subject,
          searchcourseNumber: editForm.courseCode,
        });
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/search?${params}`,
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${await getToken()}`,
            },
          },
        );

        if (!response.ok) throw new Error("Unable to load CRNs");

        const data = await response.json();
        if (!isCancelled) {
          setEditCrns(data);
          writeSearchCache(cacheKey, data);
        }
      } catch (error) {
        if (!isCancelled && error.name !== "AbortError") {
          setSearchOptionsError(error.message);
        }
      }
    };

    loadEditCrns();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [
    editForm.courseCode,
    editForm.subject,
    editingId,
    getToken,
    subjects,
    editCourseNumbers,
  ]);

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
            <figure className="registration-guide">
              <img
                src="/guide.png"
                alt="Example showing where to find the subject, course code, and CRN"
              />
              <figcaption>
                Match these three values with your course listing before you
                submit.
              </figcaption>
            </figure>
            <p className="panel-kicker">New request</p>
            <h2 className="panel-title">Register a course</h2>
            <p className="panel-description">
              Add the course details below to submit a capacity request.
            </p>

            <form className="registration-form" onSubmit={handleSubmit}>
              <div className="form-field">
                <label htmlFor="subject">Subject</label>
                <SearchableSelect
                  id="subject"
                  value={formData.subject}
                  options={subjects}
                  placeholder="Search subjects"
                  onChange={handleSubjectChange}
                  disabled={
                    isSubmitting ||
                    (subjects.length === 0 && isLoadingSearchOptions)
                  }
                />
              </div>

              <div className="form-field">
                <label htmlFor="courseCode">Course code</label>
                <SearchableSelect
                  id="courseCode"
                  value={formData.courseCode}
                  options={courseNumbers}
                  placeholder={
                    formData.subject
                      ? "Search course codes"
                      : "Select a subject first"
                  }
                  onChange={handleCourseNumberChange}
                  disabled={isSubmitting || !formData.subject}
                />
              </div>

              <div className="form-field">
                <label htmlFor="crn">CRN</label>
                <SearchableSelect
                  id="crn"
                  value={formData.crn}
                  options={crns}
                  placeholder={
                    formData.courseCode
                      ? "Search CRNs"
                      : "Select a course first"
                  }
                  onChange={handleChange}
                  disabled={isSubmitting || !formData.courseCode}
                />
              </div>

              {searchOptionsError && (
                <p className="form-error">{searchOptionsError}</p>
              )}

              <div className="form-field">
                <label htmlFor="whatsAppNumber">WhatsApp number</label>
                <p className="field-hint">
                  Select your country, then enter your number without the
                  country code.
                </p>
                <div className="phone-input-row">
                  <select
                    className="country-select"
                    aria-label="Phone country"
                    value={phoneCountry}
                    onChange={(event) => setPhoneCountry(event.target.value)}
                    disabled={isSubmitting}
                  >
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name} (+{country.callingCode})
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="01012345678"
                    id="whatsAppNumber"
                    name="whatsAppNumber"
                    value={formData.whatsAppNumber}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                  />
                </div>
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

            <div className="alert-limit-notice">
              <p>Want to increase your alert limit? Contact us on WhatsApp.</p>
              <a
                className="whatsapp-button"
                href="https://wa.me/201145889968?text=Hi%2C%20I%20would%20like%20to%20increase%20my%20alert%20limit."
                target="_blank"
                rel="noreferrer"
              >
                Chat on WhatsApp
              </a>
            </div>

            {courseData?.notifications?.length ? (
              <div className="course-list">
                {courseData.notifications.map((notification, index) => (
                  <article
                    className="course-card"
                    key={notification._id ?? index}
                  >
                    {editingId === notification._id ? (
                      <div className="edit-form">
                        <label>
                          Subject
                          <SearchableSelect
                            id={`edit-subject-${notification._id}`}
                            value={editForm.subject}
                            options={subjects}
                            placeholder="Search subjects"
                            onChange={handleEditSubjectChange}
                          />
                        </label>

                        <label>
                          Course code
                          <SearchableSelect
                            id={`edit-courseCode-${notification._id}`}
                            value={editForm.courseCode}
                            options={editCourseNumbers}
                            placeholder={
                              editForm.subject
                                ? "Search course codes"
                                : "Select a subject first"
                            }
                            onChange={handleEditCourseNumberChange}
                            disabled={!editForm.subject}
                          />
                        </label>

                        <label>
                          CRN
                          <SearchableSelect
                            id={`edit-crn-${notification._id}`}
                            name="crn"
                            value={editForm.crn}
                            options={editCrns}
                            placeholder={
                              editForm.courseCode
                                ? "Search CRNs"
                                : "Select a course first"
                            }
                            onChange={handleEditChange}
                            disabled={!editForm.courseCode}
                          />
                        </label>

                        <label>
                          WhatsApp number
                          <div className="phone-input-row">
                            <select
                              className="country-select"
                              aria-label="Phone country"
                              value={editPhoneCountry}
                              onChange={(event) =>
                                setEditPhoneCountry(event.target.value)
                              }
                            >
                              {countries.map((country) => (
                                <option key={country.code} value={country.code}>
                                  {country.name} (+{country.callingCode})
                                </option>
                              ))}
                            </select>
                            <input
                              type="tel"
                              inputMode="tel"
                              name="whatsAppNumber"
                              value={editForm.whatsAppNumber}
                              onChange={handleEditChange}
                              required
                            />
                          </div>
                        </label>

                        {editError && <p className="form-error">{editError}</p>}

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
                      </div>
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
                            Share MUST Capacity Alerter with a friend and help
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

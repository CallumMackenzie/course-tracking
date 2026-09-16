import { useEffect, useMemo, useState } from "react";
import type { CourseContent, Deliverable, DeliverableType } from "./types";

type AuthState = "checking" | "locked" | "unlocked";

const TYPE_ORDER: DeliverableType[] = [
  "assignment",
  "lab",
  "quiz",
  "test",
  "final",
  "participation"
];

const TYPE_LABELS: Record<DeliverableType, string> = {
  assignment: "Assignments",
  lab: "Labs",
  quiz: "Quizzes",
  test: "Tests",
  final: "Finals",
  participation: "Participation"
};

const COURSE_COLORS: Record<string, string> = {
  "CPSC 340": "#635bff",
  "CPSC 425": "#0f8b8d",
  "STAT 305": "#e07a36",
  "STAT 406": "#3b82f6",
  "NURS 180": "#aa4b8f"
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function effectiveDate(item: Deliverable) {
  return item.due_date ?? item.date ?? item.sort_date ?? item.start_date;
}

function officialDate(item: Deliverable) {
  return item.due_date ?? item.date;
}

function formatDate(value: string | null) {
  if (!value) return "Date to be announced";
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function daysBetween(date: string, referenceDate: string) {
  const toUtcDay = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };

  return Math.round((toUtcDay(date) - toUtcDay(referenceDate)) / 86_400_000);
}

function daysAwayLabel(daysAway: number) {
  return daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`;
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(value);
}

function formatResourceLabel(value: string) {
  try {
    const url = new URL(value);
    const fileName = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
    return fileName || url.hostname.replace(/^www\./, "");
  } catch {
    return "Course resource";
  }
}

function sortDeliverables(items: Deliverable[]) {
  return [...items].sort((left, right) => {
    if (left.type === "final" && right.type !== "final") return 1;
    if (left.type !== "final" && right.type === "final") return -1;

    const leftDate = effectiveDate(left);
    const rightDate = effectiveDate(right);
    if (leftDate && rightDate && leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }
    if (leftDate && !rightDate) return -1;
    if (!leftDate && rightDate) return 1;
    return left.course_code.localeCompare(right.course_code) || left.name.localeCompare(right.name);
  });
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [accessToken, setAccessToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [courseContent, setCourseContent] = useState<CourseContent[]>([]);
  const [typeFilter, setTypeFilter] = useState<DeliverableType | "all">("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [error, setError] = useState("");
  const [contentError, setContentError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const today = localDateKey();

  useEffect(() => {
    const savedToken = window.sessionStorage.getItem("courseTrackerAccessToken");

    if (!savedToken) {
      setAuthState("locked");
      return;
    }

    verifyAccess(savedToken)
      .then((valid) => {
        if (!valid) {
          window.sessionStorage.removeItem("courseTrackerAccessToken");
          setAuthState("locked");
          return;
        }

        setAccessToken(savedToken);
        setAuthState("unlocked");
      })
      .catch(() => {
        setAuthError("Could not verify access. Please try again.");
        setAuthState("locked");
      });
  }, []);

  useEffect(() => {
    if (authState !== "unlocked") return;

    setLoading(true);
    fetch("/api/deliverables", {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
      .then(async (response) => {
        if (response.status === 401) lockApp();
        if (!response.ok) throw new Error("Could not load your coursework.");
        return response.json() as Promise<Deliverable[]>;
      })
      .then(setDeliverables)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [accessToken, authState]);

  useEffect(() => {
    if (authState !== "unlocked") return;

    setContentLoading(true);
    fetch(`/api/course-content?date=${encodeURIComponent(today)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
      .then(async (response) => {
        if (response.status === 401) lockApp();
        if (!response.ok) throw new Error("Could not load today's lecture content.");
        return response.json() as Promise<CourseContent[]>;
      })
      .then(setCourseContent)
      .catch((reason: Error) => setContentError(reason.message))
      .finally(() => setContentLoading(false));
  }, [accessToken, authState, today]);

  async function verifyAccess(token: string) {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) return false;
    if (!response.ok) throw new Error("Unable to verify access.");
    return true;
  }

  async function unlockApp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setAuthState("checking");
    setAuthError("");

    try {
      if (!(await verifyAccess(token))) {
        setAuthError("That access token is not valid.");
        setAuthState("locked");
        return;
      }

      window.sessionStorage.setItem("courseTrackerAccessToken", token);
      setAccessToken(token);
      setTokenInput("");
      setAuthState("unlocked");
    } catch {
      setAuthError("Could not verify access. Please try again.");
      setAuthState("locked");
    }
  }

  function lockApp() {
    window.sessionStorage.removeItem("courseTrackerAccessToken");
    setAccessToken("");
    setDeliverables([]);
    setCourseContent([]);
    setAuthState("locked");
  }

  const courses = useMemo(
    () => [...new Set(deliverables.map((item) => item.course_code))].sort(),
    [deliverables]
  );

  const visible = useMemo(() => {
    const filtered = deliverables.filter(
      (item) =>
        (typeFilter === "all" || item.type === typeFilter) &&
        (courseFilter === "all" || item.course_code === courseFilter)
    );
    return sortDeliverables(filtered);
  }, [deliverables, typeFilter, courseFilter]);

  const timelineItems = visible.filter(
    (item) => item.type !== "participation" && !item.completed
  );
  const courseLongItems = visible.filter((item) => item.type === "participation");
  const completedItems = visible.filter(
    (item) => item.type !== "participation" && item.completed
  );

  const todayIndex = timelineItems.findIndex((item) => {
    if (item.type === "final") return true;
    const itemDate = effectiveDate(item);
    return !itemDate || itemDate >= today;
  });
  const dividerIndex = todayIndex === -1 ? timelineItems.length : todayIndex;

  async function toggleCompletion(item: Deliverable) {
    if (item.type === "participation" || updatingId !== null) return;
    const completed = !item.completed;
    setUpdatingId(item.id);
    setError("");

    try {
      const response = await fetch(`/api/deliverables/${encodeURIComponent(item.id)}/completion`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ completed })
      });
      if (response.status === 401) lockApp();
      if (!response.ok) throw new Error("Could not save that change.");
      setDeliverables((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, completed } : entry))
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save that change.");
    } finally {
      setUpdatingId(null);
    }
  }

  function renderDeliverable(item: Deliverable, courseLong = false) {
    const countdownDate = officialDate(item) ?? item.sort_date;
    const daysAway = countdownDate ? daysBetween(countdownDate, today) : null;
    const isUpcoming = daysAway !== null && daysAway > 0;
    const hasUrgencyColor = isUpcoming && daysAway <= 14 && item.type !== "lab";
    const urgencyHue = hasUrgencyColor ? ((daysAway - 1) / 13) * 112 : undefined;

    return (
      <article
        className={`deliverable ${courseLong ? "deliverable--course-long" : ""} ${item.completed ? "deliverable--completed" : ""} ${hasUrgencyColor ? "deliverable--soon" : ""}`}
        style={{
          "--course-color": COURSE_COLORS[item.course_code] ?? "#64748b",
          ...(hasUrgencyColor ? { "--urgency-hue": urgencyHue } : {})
        } as React.CSSProperties}
      >
        <div className="date-column">
          {courseLong ? (
            <>
              <span>Entire term</span>
              <small>Course-long</small>
            </>
          ) : officialDate(item) ? (
            <span>{formatDate(officialDate(item))}</span>
          ) : item.sort_date ? (
            <span className="estimated-date">TBD · est. {formatDate(item.sort_date)}</span>
          ) : (
            <span>Date to be announced</span>
          )}
          {!courseLong && item.start_date && (
            <small>Opens {formatDate(item.start_date)}</small>
          )}
          {!courseLong && isUpcoming && (
            <small
              className={`days-away ${hasUrgencyColor ? "days-away--soon" : ""}`}
            >
              {daysAwayLabel(daysAway)}
            </small>
          )}
        </div>

        <div className="deliverable__body">
          <div className="meta-row">
            <span className="course-badge">{item.course_code}</span>
            <span className={`type-badge type-badge--${item.type}`}>{item.type}</span>
          </div>
          <h3>{item.name}</h3>
          <p>
            {item.type === "lab" && item.worth_pct === 0 ? (
              "Scheduled lab"
            ) : (
              <>
                {item.worth_pct_estimated && "~"}{formatPercent(item.worth_pct)}% of course grade
                {item.points != null && ` · ${item.points} pts`}
                {item.grading_group && ` · ${item.grading_group}`}
              </>
            )}
          </p>
        </div>

        <div className="completion-column">
          {item.type === "participation" ? (
            <span className="auto-label">Tracked in class</span>
          ) : (
            <label className="check-control">
              <input
                type="checkbox"
                checked={item.completed}
                disabled={updatingId !== null}
                onChange={() => toggleCompletion(item)}
              />
              <span aria-hidden="true">✓</span>
              <em>{item.completed ? "Done" : "Mark done"}</em>
            </label>
          )}
        </div>
      </article>
    );
  }

  if (authState !== "unlocked") {
    return (
      <main className="auth-shell">
        <section className="auth-card" aria-labelledby="auth-title">
          <p className="eyebrow">Private course tracker</p>
          <h1 id="auth-title">Callum Mackenzie&apos;s Course Deliverables</h1>
          <p>Enter the access token to continue.</p>
          <form onSubmit={unlockApp}>
            <label htmlFor="access-token">Access token</label>
            <input
              id="access-token"
              type="password"
              autoComplete="current-password"
              spellCheck={false}
              value={tokenInput}
              disabled={authState === "checking"}
              onChange={(event) => setTokenInput(event.target.value)}
              autoFocus
            />
            {authError && <div className="auth-error" role="alert">{authError}</div>}
            <button type="submit" disabled={authState === "checking" || !tokenInput.trim()}>
              {authState === "checking" ? "Checking…" : "Unlock tracker"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__inner">
          <div className="hero__heading-row">
            <div>
              <p className="eyebrow">2026 · Winter Term 1</p>
              <h1>Callum Mackenzie&apos;s Course Deliverables</h1>
            </div>
            <div className="hero__actions">
              <div className="date-card">
                <span>Today</span>
                <strong>{formatLongDate(today)}</strong>
              </div>
              <button className="lock-button" type="button" onClick={lockApp}>Lock</button>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="lecture-panel" aria-labelledby="lecture-panel-title">
          <div className="lecture-panel__header">
            <div>
              <span className="lecture-panel__eyebrow">Today</span>
              <h2 id="lecture-panel-title">Lecture content for today</h2>
            </div>
            <span>{formatDate(today)}</span>
          </div>

          {contentLoading ? (
            <div className="lecture-panel__state">Loading today&apos;s lectures…</div>
          ) : contentError ? (
            <div className="lecture-panel__state lecture-panel__state--error" role="alert">
              {contentError}
            </div>
          ) : courseContent.length === 0 ? (
            <div className="lecture-panel__state">No lecture content scheduled for today.</div>
          ) : (
            <div className="lecture-grid">
              {courseContent.map((item) => (
                <article
                  key={`${item.course_code}-${item.date}-${item.title}`}
                  className="lecture-card"
                  style={{ "--course-color": COURSE_COLORS[item.course_code] ?? "#64748b" } as React.CSSProperties}
                >
                  <span className="course-badge">{item.course_code}</span>
                  <h3>{item.title}</h3>

                  {item.readings.length > 0 && (
                    <div className="lecture-card__section">
                      <span>Readings</span>
                      <ul>
                        {item.readings.map((reading) => <li key={reading}>{reading}</li>)}
                      </ul>
                    </div>
                  )}

                  {item.links.length > 0 && (
                    <div className="lecture-card__section">
                      <span>Resources</span>
                      <div className="lecture-card__links">
                        {item.links.map((link) => (
                          <a key={link} href={link} target="_blank" rel="noreferrer">
                            {formatResourceLabel(link)} <span aria-hidden="true">↗</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="controls" aria-label="Deliverable filters">
          <div className="filter-block">
            <span className="filter-label">Type</span>
            <div className="filter-pills">
              <button
                className={typeFilter === "all" ? "active" : ""}
                onClick={() => setTypeFilter("all")}
              >
                All <span>{deliverables.length}</span>
              </button>
              {TYPE_ORDER.map((type) => {
                const count = deliverables.filter((item) => item.type === type).length;
                return (
                  <button
                    key={type}
                    className={typeFilter === type ? "active" : ""}
                    onClick={() => setTypeFilter(type)}
                  >
                    {TYPE_LABELS[type]} <span>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="course-select">
            <span className="filter-label">Course</span>
            <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
              <option value="all">All courses</option>
              {courses.map((course) => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </label>
        </section>

        {error && <div className="error-banner" role="alert">{error}</div>}

        <section className="timeline" aria-live="polite">
          <div className="list-heading">
            <h2>Timeline</h2>
            <span>{timelineItems.length} items</span>
          </div>

          {loading ? (
            <div className="empty-state">Loading your courses…</div>
          ) : visible.length === 0 ? (
            <div className="empty-state">No deliverables match these filters.</div>
          ) : timelineItems.length > 0 ? (
            <div className="deliverable-list">
              {timelineItems.map((item, index) => (
                <div key={item.id}>
                  {index === dividerIndex && (
                    <div className="today-line">
                      <span>Today</span>
                    </div>
                  )}
                  {renderDeliverable(item)}
                </div>
              ))}
              {dividerIndex === timelineItems.length && (
                <div className="today-line today-line--end">
                  <span>Today</span>
                </div>
              )}
            </div>
          ) : null}

          {!loading && courseLongItems.length > 0 && (
            <div className="course-long">
              <div className="course-long__heading">
                <div>
                  <span className="course-long__eyebrow">Ongoing</span>
                  <h2>Course-long</h2>
                </div>
                <span>{courseLongItems.length} items</span>
              </div>
              <div className="deliverable-list deliverable-list--course-long">
                {courseLongItems.map((item) => (
                  <div key={item.id}>{renderDeliverable(item, true)}</div>
                ))}
              </div>
            </div>
          )}

          {!loading && completedItems.length > 0 && (
            <div className="completed-section">
              <div className="completed-section__heading">
                <div>
                  <span className="completed-section__eyebrow">Finished</span>
                  <h2>Completed</h2>
                </div>
                <span>{completedItems.length} items</span>
              </div>
              <div className="deliverable-list deliverable-list--completed">
                {completedItems.map((item) => (
                  <div key={item.id}>{renderDeliverable(item)}</div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { Deliverable, DeliverableType } from "./types";

const TYPE_ORDER: DeliverableType[] = [
  "assignment",
  "quiz",
  "test",
  "final",
  "participation"
];

const TYPE_LABELS: Record<DeliverableType, string> = {
  assignment: "Assignments",
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
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [typeFilter, setTypeFilter] = useState<DeliverableType | "all">("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const today = localDateKey();

  useEffect(() => {
    fetch("/api/deliverables")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your coursework.");
        return response.json() as Promise<Deliverable[]>;
      })
      .then(setDeliverables)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

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

  const timelineItems = visible.filter((item) => item.type !== "participation");
  const courseLongItems = visible.filter((item) => item.type === "participation");

  const todayIndex = timelineItems.findIndex((item) => {
    if (item.type === "final") return true;
    const itemDate = effectiveDate(item);
    return !itemDate || itemDate >= today;
  });
  const dividerIndex = todayIndex === -1 ? timelineItems.length : todayIndex;

  const completedCount = deliverables.filter(
    (item) => item.type !== "participation" && item.completed
  ).length;
  const trackableCount = deliverables.filter((item) => item.type !== "participation").length;
  const upcomingCount = deliverables.filter((item) => {
    const itemDate = effectiveDate(item);
    return item.type !== "final" && Boolean(itemDate && itemDate >= today && !item.completed);
  }).length;

  async function toggleCompletion(item: Deliverable) {
    if (item.type === "participation" || updatingId !== null) return;
    const completed = !item.completed;
    setUpdatingId(item.id);
    setError("");

    try {
      const response = await fetch(`/api/deliverables/${item.id}/completion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed })
      });
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
    return (
      <article
        className={`deliverable ${courseLong ? "deliverable--course-long" : ""} ${item.completed ? "deliverable--completed" : ""}`}
        style={{ "--course-color": COURSE_COLORS[item.course_code] ?? "#64748b" } as React.CSSProperties}
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
        </div>

        <div className="deliverable__body">
          <div className="meta-row">
            <span className="course-badge">{item.course_code}</span>
            <span className={`type-badge type-badge--${item.type}`}>{item.type}</span>
          </div>
          <h3>{item.name}</h3>
          <p>
            {item.worth_pct_estimated && "~"}{formatPercent(item.worth_pct)}% of course grade
            {item.points != null && ` · ${item.points} pts`}
            {item.grading_group && ` · ${item.grading_group}`}
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

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__inner">
          <p className="eyebrow">2026 · Winter Term 1</p>
          <div className="hero__heading-row">
            <div>
              <h1>Course deliverables</h1>
              <p className="hero__subtitle">Everything due, in one clean timeline.</p>
            </div>
            <div className="date-card">
              <span>Today</span>
              <strong>{formatLongDate(today)}</strong>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="stats" aria-label="Coursework summary">
          <div className="stat-card">
            <span>Upcoming</span>
            <strong>{upcomingCount}</strong>
            <small>dated + estimated</small>
          </div>
          <div className="stat-card">
            <span>Completed</span>
            <strong>{completedCount}</strong>
            <small>of {trackableCount} trackable</small>
          </div>
          <div className="stat-card">
            <span>Courses</span>
            <strong>{courses.length}</strong>
            <small>this term</small>
          </div>
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
        </section>
      </main>
    </div>
  );
}

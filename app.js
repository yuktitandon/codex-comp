const STORAGE_KEY = "day-debug-history";
const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sampleLogs = [
  {
    label: "Overloaded Student",
    text:
      "I woke up late, checked my phone for an hour, skipped breakfast, rushed to class, tried to study between lectures, kept reopening my notes and YouTube, forgot a quiz was due, and by 4 PM I felt wired and useless.",
    wake: "07:20",
    end: "22:45",
    schedule: "Class 10 AM to 12 PM, library from 2 PM, gym at 6 PM",
    priorities: "Finish quiz review, submit lab draft, read chapter notes",
  },
  {
    label: "Context-Switch Spiral",
    text:
      "I started three tasks before finishing one, kept replying to Slack right away, had six tabs open for one assignment, skipped lunch because I thought I was behind, and spent the evening staring at work without getting traction.",
    wake: "06:50",
    end: "23:00",
    schedule: "Work block before 9, team sync at 11, client edits due by 5",
    priorities: "Complete client revision, send invoice, draft presentation outline",
  },
  {
    label: "Silent Burnout",
    text:
      "I got through the whole day technically working, but everything felt heavy. I procrastinated starting hard work, drank too much coffee, had no real break, made tiny mistakes in things I normally do well, and crashed after dinner.",
    wake: "07:45",
    end: "22:00",
    schedule: "Morning meetings, project block 1 to 4, dinner at 7",
    priorities: "Finish proposal deck, review hiring notes, clear inbox backlog",
  },
];

const analyzer = {
  keywordSets: {
    lateStart: ["woke up late", "slept in", "overslept", "late start", "woke up at", "got up late"],
    phoneDrift: ["phone", "instagram", "tiktok", "scroll", "social media", "youtube", "reels", "doomscroll", "checked my phone"],
    nutritionDebt: ["skipped breakfast", "skipped lunch", "didn't eat", "forgot to eat", "no lunch", "missed breakfast", "missed lunch"],
    contextSwitching: ["bounced between", "reopened", "tabs", "slack", "multitask", "switched", "three tasks", "kept changing", "jumped between"],
    stress: ["fried", "wired", "overwhelmed", "burned out", "heavy", "useless", "crashed", "drained", "anxious", "stressed", "panicked"],
    urgency: ["rushed", "behind", "forgot", "missed", "due", "late", "deadline", "catch up"],
    fatigue: ["tired", "exhausted", "no break", "too much coffee", "staring", "mistakes", "brain fog", "sleepy"],
    planningDebt: ["forgot", "missed", "behind", "bounced between", "rushed", "started three tasks", "no plan", "unplanned", "figuring out what to do"],
    avoidance: ["avoided", "procrastinated", "put off", "delayed starting", "couldn't start"],
  },

  splitList(value = "") {
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  },

  timeToMinutes(value = "07:30") {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  },

  minutesToClock(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
  },

  detectFeatures(text) {
    const flags = {};
    for (const [key, phrases] of Object.entries(this.keywordSets)) {
      flags[key] = phrases.filter((phrase) => text.includes(phrase)).length;
    }

    return {
      ...flags,
      longLog: text.split(/\s+/).length > 45,
      intenseDay:
        (flags.phoneDrift > 0 ? 1 : 0) +
          (flags.contextSwitching > 0 ? 1 : 0) +
          (flags.stress > 0 ? 1 : 0) +
          (flags.urgency > 0 ? 1 : 0) >=
        3,
    };
  },

  parseTimeToken(raw, meridiemHint = null) {
    if (!raw) return null;
    const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const suffix = (match[3] || meridiemHint || "").toLowerCase();
    if (suffix === "pm" && hour !== 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    if (!suffix && hour < 7) hour += 12;
    return hour * 60 + minute;
  },

  parseCommitments(scheduleText, wakeMinutes, endMinutes) {
    const items = this.splitList(scheduleText).map((label) => {
      const range =
        label.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i) ||
        label.match(/from\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

      if (range) {
        const hint = /pm/i.test(range[1]) || /pm/i.test(range[2]) ? "pm" : /am/i.test(range[1]) || /am/i.test(range[2]) ? "am" : null;
        const start = this.parseTimeToken(range[1], hint);
        const end = this.parseTimeToken(range[2], hint);
        if (start !== null && end !== null && end > start) {
          return { label, start, end };
        }
      }

      const single = label.match(/(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (single) {
        const start = this.parseTimeToken(single[1]);
        if (start !== null) {
          return { label, start, end: Math.min(start + 60, endMinutes) };
        }
      }

      return null;
    }).filter(Boolean);

    const filtered = items
      .map((item) => ({
        ...item,
        start: Math.max(wakeMinutes + 30, item.start),
        end: Math.min(endMinutes - 30, item.end),
      }))
      .filter((item) => item.end > item.start)
      .sort((a, b) => a.start - b.start);

    return filtered;
  },

  buildOpenWindows(commitments, wakeMinutes, endMinutes) {
    const windows = [];
    let cursor = wakeMinutes + 30;
    for (const item of commitments) {
      if (item.start - cursor >= 40) {
        windows.push({ start: cursor, end: item.start });
      }
      cursor = Math.max(cursor, item.end);
    }
    if (endMinutes - cursor >= 40) {
      windows.push({ start: cursor, end: endMinutes - 30 });
    }
    return windows;
  },

  buildTrend(rootCauses, history, type) {
    const sameType = history.filter((item) => item.type === type);
    if (!sameType.length) {
      return {
        title: "No trend yet",
        body:
          type === "planner"
            ? "Planner history starts once you generate a few tomorrow schedules."
            : "One report is enough for diagnosis, but not enough to confirm a repeating failure mode.",
      };
    }

    if (type === "planner") {
      return {
        title: "Planner history active",
        body: `You now have ${sameType.length + 1} planning runs including this one. Reuse the planner to compare better structures over time.`,
      };
    }

    const currentPrimary = rootCauses[0]?.title;
    const repeatCount = sameType.filter(
      (item) => item.rootCauses?.[0]?.title === currentPrimary
    ).length;

    if (repeatCount >= 2) {
      return {
        title: "Repeat pattern detected",
        body: `The top failure mode has appeared ${repeatCount + 1} times including today. This is behaving like a system issue, not a one-off miss.`,
      };
    }

    return {
      title: "Pattern still forming",
      body: "The app sees some consistency, but not enough history yet to call it a dominant pattern.",
    };
  },

  analyzeDay(log, history, planInput) {
    const normalized = log.toLowerCase();
    const features = this.detectFeatures(normalized);
    const wakeMinutes = this.timeToMinutes(planInput.wakeTime || "07:30");
    const endMinutes = this.timeToMinutes(planInput.dayEndTime || "22:30");
    const scrollCost = (features.phoneDrift > 0 ? 18 + features.phoneDrift * 8 : 8) + (features.lateStart > 0 ? 10 : 0);
    const planningDebt =
      (features.planningDebt > 0 ? 16 + features.planningDebt * 5 : 10) +
      (!planInput.schedule ? 14 : 0) +
      (!planInput.priorities ? 12 : 0);
    const energyStrain =
      (features.nutritionDebt > 0 ? 20 + features.nutritionDebt * 4 : 8) +
      (features.stress > 0 ? 16 + features.stress * 3 : 6) +
      (features.fatigue > 0 ? 14 + features.fatigue * 2 : 4);
    const severity = Math.min(97, 28 + scrollCost * 0.7 + planningDebt * 0.55 + energyStrain * 0.62);
    const confidence = Math.min(
      0.95,
      0.63 +
        (features.longLog ? 0.08 : 0) +
        (features.phoneDrift > 0 ? 0.07 : 0) +
        (features.contextSwitching > 0 ? 0.08 : 0) +
        (features.stress > 0 ? 0.06 : 0) +
        (normalized.includes("felt") ? 0.04 : 0)
    );
    const firstFailureMinute = features.phoneDrift > 0
      ? wakeMinutes + 40
      : features.lateStart > 0
        ? wakeMinutes + 20
        : features.contextSwitching > 0 || features.avoidance > 0
          ? wakeMinutes + 150
          : wakeMinutes + 90;

    const rootCauses = [
      {
        title: features.phoneDrift > 0 || features.lateStart > 0 ? "Unprotected start-of-day ramp" : "Weak early structure",
        detail:
          "The first hour was too easy to hijack, so the rest of the day inherited weaker focus and pacing.",
      },
      {
        title: features.contextSwitching > 0 || features.urgency > 0 ? "No stable execution lane" : "Over-flexible task switching",
        detail: "Without a visible lane, each interruption or open tab became a new candidate for attention.",
      },
      {
        title: "Physical depletion amplified mental noise",
        detail: "Low fuel and rising strain made normal friction more expensive than it should have been.",
      },
    ];

    return {
      id: createId(),
      type: "autopsy",
      createdAt: new Date().toISOString(),
      rawLog: log.trim(),
      planner: planInput,
      severity,
      confidence,
      summary:
        features.phoneDrift > 0 && features.contextSwitching > 0
          ? `The day likely failed at the transition from intention to execution: the first hour drifted, then the rest of the day fractured. Severity ${Math.round(severity)}/100.`
          : features.lateStart > 0 && features.planningDebt > 0
            ? `The day appears to have started behind and stayed reactive: a compressed start plus weak planning kept forcing catch-up decisions. Severity ${Math.round(severity)}/100.`
            : features.avoidance > 0
              ? `The day seems to have broken at the moment hard work was delayed, which let stress build faster than progress. Severity ${Math.round(severity)}/100.`
          : `The main pattern was unstable focus under rising strain, which turned normal work into a cascade of friction by mid to late day. Severity ${Math.round(severity)}/100.`,
      failurePoint: {
        moment: features.phoneDrift > 0
          ? `${this.minutesToClock(firstFailureMinute)}: screen drift displaced day setup`
          : features.lateStart > 0
            ? `${this.minutesToClock(firstFailureMinute)}: late wake-up compressed the day`
            : features.avoidance > 0
              ? `${this.minutesToClock(firstFailureMinute)}: task avoidance created drag early`
            : `${this.minutesToClock(firstFailureMinute)}: planning debt started to show`,
        why: features.phoneDrift > 0
          ? "The first high-leverage decision window was lost to passive scrolling, which made the rest of the day reactive instead of directed."
          : features.avoidance > 0
            ? "The day likely got heavier when the hardest task was delayed, which let smaller tasks and stress take over the schedule."
          : "The day appears to have drifted once tasks stopped being pre-decided and attention had to keep renegotiating priorities.",
      },
      metrics: { scrollCost, planningDebt, energyStrain },
      timeLeaks: [
        {
          title: `Reactive screen drift (+${scrollCost} drag points)`,
          detail: "The first usable minutes of the day were spent consuming input instead of stabilizing direction.",
        },
        {
          title: `Planning debt (+${planningDebt} friction points)`,
          detail: "A weak or missing day shape forced the next task to be re-decided too often.",
        },
        {
          title: features.contextSwitching > 0 ? "Task-fragmented work blocks" : "Diffuse attention leakage",
          detail: features.contextSwitching > 0
            ? "Repeated reopening and switching created restart costs that made the workload feel larger."
            : "The day spread effort too thinly, which quietly drained attention.",
        },
      ],
      burnoutSignals: [
        {
          title: features.nutritionDebt > 0 ? "Energy support broke early" : "Energy support looks unstable",
          detail: "Skipping meals or delaying recovery tends to make late-day focus problems feel like a character issue instead of a fuel issue.",
        },
        {
          title: features.stress > 0 ? "Language of overload" : "Stress is compounding friction",
          detail: "Words like fried, useless, or overwhelmed usually signal strain accumulation rather than a single bad task.",
        },
        {
          title: `Accumulated energy strain (${energyStrain}/50)`,
          detail: "The app sees mounting pressure from low fuel, urgency, and declining control by late day.",
        },
      ],
      rootCauses,
      behaviorPatches: [
        {
          title: "Lock the first 30 minutes",
          detail: "Keep your phone out of reach until you have water, food, and one written first task.",
        },
        {
          title: "Run one visible work lane",
          detail: "Pick a single 45-minute priority block and avoid switching tasks mid-block.",
        },
        {
          title: `Pre-load tomorrow by ${planInput.wakeTime || "07:30"}`,
          detail: "Define the wake time, your first work block, and one energy checkpoint tonight.",
        },
      ],
      timeline: [
        {
          title: `${this.minutesToClock(wakeMinutes)} | Day setup window`,
          detail: features.lateStart
            ? "The day began behind schedule, which shrank the margin for calm setup immediately."
            : "This was the best window to set direction before the day got noisy.",
        },
        {
          title: `${this.minutesToClock(firstFailureMinute)} | Likely first break point`,
          detail: features.phoneDrift > 0
            ? `Phone drift likely consumed the first planning block and cost about ${scrollCost} focus points.`
            : "Early structure appears to have broken here, which made later choices more reactive.",
        },
        {
          title: `${this.minutesToClock(firstFailureMinute + 180)} | Compounding phase`,
          detail: "Planning debt and task switching appear to interact here, which made recovery more expensive than prevention.",
        },
        {
          title: `${this.minutesToClock(endMinutes - 120)} | Fatigue zone`,
          detail: "Late-day executive control likely weakened here, raising the odds of strain-based mistakes.",
        },
      ],
      tomorrowPlan: [
        {
          title: `${planInput.wakeTime || "07:30"} | Wake and protect the first 30 minutes`,
          detail: "No scrolling until food, water, and a written first move are done.",
        },
        {
          title: `${this.minutesToClock(wakeMinutes + 45)} | First deep block`,
          detail: `Start with the single task that matters most tomorrow${planInput.priorities ? `: ${this.splitList(planInput.priorities)[0]}` : ""}.`,
        },
        {
          title: `${this.minutesToClock(wakeMinutes + 300)} | Midday reset`,
          detail: "Break, eat, and choose the next one or two tasks deliberately before the afternoon compounds.",
        },
        {
          title: `${this.minutesToClock(endMinutes - 45)} | Close the loop`,
          detail: "Write the next day’s first task before stopping so tomorrow does not begin in friction.",
        },
      ],
      trend: this.buildTrend(rootCauses, history, "autopsy"),
    };
  },

  analyzeTomorrow(planInput, history) {
    const wakeMinutes = this.timeToMinutes(planInput.wakeTime || "07:30");
    const endMinutes = this.timeToMinutes(planInput.dayEndTime || "22:30");
    const usableMinutes = Math.max(540, endMinutes - wakeMinutes);
    const commitments = this.parseCommitments(planInput.schedule, wakeMinutes, endMinutes);
    const openWindows = this.buildOpenWindows(commitments, wakeMinutes, endMinutes);
    const bestWindow = openWindows.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0] || {
      start: wakeMinutes + 45,
      end: wakeMinutes + 135,
    };
    const deepWorkStart = bestWindow.start;
    const middayReset = Math.min(endMinutes - 180, wakeMinutes + 300);
    const shutdown = Math.max(wakeMinutes + 720, endMinutes - 45);
    const focusHours = Math.max(2.5, Math.min(7.5, (usableMinutes - 240) / 60));
    const priorities = this.splitList(planInput.priorities);
    const scheduleItems = commitments.length ? commitments.map((item) => item.label) : this.splitList(planInput.schedule);
    const planQuality = Math.min(
      96,
      44 + priorities.length * 9 + scheduleItems.length * 7 + (focusHours - 2) * 4 + (openWindows.length > 1 ? 6 : 0)
    );

    const allocatedPriorityPlan = priorities.length
      ? priorities.slice(0, 4).map((priority, index) => {
          const window = openWindows[Math.min(index, Math.max(0, openWindows.length - 1))] || bestWindow;
          return {
            title: `Priority ${index + 1} | ${priority}`,
            detail:
              index === 0
                ? `Place this in ${this.minutesToClock(window.start)} to ${this.minutesToClock(Math.min(window.start + 90, window.end))}, your strongest open block.`
                : index === 1
                  ? `Move this into ${this.minutesToClock(window.start)} to ${this.minutesToClock(Math.min(window.start + 75, window.end))} after the main block or after a reset.`
                  : `Batch this into a later lighter window such as ${this.minutesToClock(window.start)} onward so it does not contaminate the first deep block.`,
          };
        })
      : null;

    return {
      id: createId(),
      type: "planner",
      createdAt: new Date().toISOString(),
      planner: planInput,
      summary:
        priorities.length > 0
          ? `Tomorrow should start earlier in intention than in effort: lock the first hour, start with ${priorities[0]}, and avoid letting fixed commitments scatter your attention.`
          : "Tomorrow needs stronger structure first: set 2 to 4 priorities, protect the first hour, and use commitments as anchors instead of letting them fragment the day.",
      planQuality,
      focusHours,
      bestStartWindow: this.minutesToClock(deepWorkStart),
      bestStartWhy:
        commitments.length
          ? "This is the largest open window after accounting for your fixed commitments, so it is the best place to protect serious work."
          : "This is the earliest clean slot after waking where cognitive energy is still high and the day has not yet been fragmented.",
      shutdownTime: this.minutesToClock(shutdown),
      suggestedSchedule: [
        {
          title: `${planInput.wakeTime || "07:30"} | Wake, fuel, and orient`,
          detail: "Use the first 30 minutes for water, food, and deciding the first priority. Do not let messages or scrolling occupy this slot.",
        },
        {
          title: `${this.minutesToClock(deepWorkStart)} | Primary deep-work block`,
          detail: priorities.length
            ? `Start with ${priorities[0]}. This should be the cleanest cognitive block of the day.`
            : "Reserve this block for the hardest task before lower-value noise enters the day.",
        },
        ...commitments.slice(0, 3).map((item) => ({
          title: `${this.minutesToClock(item.start)}-${this.minutesToClock(item.end)} | Fixed commitment`,
          detail: item.label,
        })),
        {
          title: `${this.minutesToClock(middayReset)} | Midday reset`,
          detail: "Break, eat, and decide the next work lane deliberately. This prevents the afternoon from becoming reactive.",
        },
        {
          title: `${this.minutesToClock(shutdown)} | Shutdown window`,
          detail: "Close loops, list carryover tasks, and decide tomorrow’s first move before ending the day.",
        },
      ],
      priorityPlan: priorities.length
        ? allocatedPriorityPlan
        : [
            {
              title: "No priorities entered",
              detail: "Add 2 to 4 concrete priorities so the planner can schedule a tighter day.",
            },
          ],
      efficiencyRules: [
        {
          title: "Rule 1 | Protect the first hour",
          detail: "No phone drift before your first planned block starts.",
        },
        {
          title: "Rule 2 | One lane at a time",
          detail: "Use one clear work lane per block instead of mixing assignments or tasks.",
        },
        {
          title: "Rule 3 | Schedule the reset before you need it",
          detail: "The midday break should exist in the plan before energy drops.",
        },
      ],
      notes: [
        {
          title: `Focus capacity | ${focusHours.toFixed(1)} hours`,
          detail: "This is the estimated amount of realistic focused work your schedule can hold without turning the whole day into strain.",
        },
        {
          title: `Commitment load | ${scheduleItems.length} fixed item${scheduleItems.length === 1 ? "" : "s"}`,
          detail:
            scheduleItems.length > 0
              ? "Your fixed commitments reduce flexibility, so the planner is actively routing priorities into the clean windows around them."
              : "Your day is flexible, which means structure matters even more because nothing external will impose it.",
        },
        {
          title: "Planning logic",
          detail: "The planner front-loads hard work, inserts a reset before the afternoon, and uses a shutdown window so tomorrow does not begin in friction.",
        },
      ],
      trend: this.buildTrend([], history, "planner"),
    };
  },
};

const elements = {
  landingView: document.getElementById("landingView"),
  resultsPage: document.getElementById("resultsPage"),
  jumpToInputBtn: document.getElementById("jumpToInputBtn"),
  heroAnalyzeBtn: document.getElementById("heroAnalyzeBtn"),
  heroPlannerBtn: document.getElementById("heroPlannerBtn"),
  backBtn: document.getElementById("backBtn"),
  dayLog: document.getElementById("dayLog"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  clearBtn: document.getElementById("clearBtn"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  sampleList: document.getElementById("sampleList"),
  historyList: document.getElementById("historyList"),
  historyChart: document.getElementById("historyChart"),
  historyCountMetric: document.getElementById("historyCountMetric"),
  avgSeverityMetric: document.getElementById("avgSeverityMetric"),
  plannerCountMetric: document.getElementById("plannerCountMetric"),
  trendMetric: document.getElementById("trendMetric"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  workspaceHeading: document.getElementById("workspaceHeading"),
  autopsyModeBtn: document.getElementById("autopsyModeBtn"),
  plannerModeBtn: document.getElementById("plannerModeBtn"),
  autopsyInputSection: document.getElementById("autopsyInputSection"),
  plannerInputSection: document.getElementById("plannerInputSection"),
  wakeTime: document.getElementById("wakeTime"),
  dayEndTime: document.getElementById("dayEndTime"),
  fixedSchedule: document.getElementById("fixedSchedule"),
  priorities: document.getElementById("priorities"),
  resultsHeading: document.getElementById("resultsHeading"),
  analysisStamp: document.getElementById("analysisStamp"),
  autopsyControls: document.getElementById("autopsyControls"),
  shortReportBtn: document.getElementById("shortReportBtn"),
  deepReportBtn: document.getElementById("deepReportBtn"),
  autopsyResultsSection: document.getElementById("autopsyResultsSection"),
  plannerResultsSection: document.getElementById("plannerResultsSection"),
  deepSection: document.getElementById("deepSection"),
  autopsySummary: document.getElementById("autopsySummary"),
  severityScore: document.getElementById("severityScore"),
  confidenceScore: document.getElementById("confidenceScore"),
  failureMoment: document.getElementById("failureMoment"),
  failureWhy: document.getElementById("failureWhy"),
  scrollCost: document.getElementById("scrollCost"),
  planningDebt: document.getElementById("planningDebt"),
  energyStrain: document.getElementById("energyStrain"),
  timeLeakCount: document.getElementById("timeLeakCount"),
  burnoutCount: document.getElementById("burnoutCount"),
  timeLeaks: document.getElementById("timeLeaks"),
  burnoutSignals: document.getElementById("burnoutSignals"),
  rootCauses: document.getElementById("rootCauses"),
  behaviorPatches: document.getElementById("behaviorPatches"),
  failureTimeline: document.getElementById("failureTimeline"),
  tomorrowPlan: document.getElementById("tomorrowPlan"),
  plannerSummary: document.getElementById("plannerSummary"),
  planQualityScore: document.getElementById("planQualityScore"),
  focusHoursScore: document.getElementById("focusHoursScore"),
  bestStartWindow: document.getElementById("bestStartWindow"),
  bestStartWhy: document.getElementById("bestStartWhy"),
  plannerWake: document.getElementById("plannerWake"),
  plannerDeepWork: document.getElementById("plannerDeepWork"),
  plannerShutdown: document.getElementById("plannerShutdown"),
  schedulePlan: document.getElementById("schedulePlan"),
  priorityPlan: document.getElementById("priorityPlan"),
  efficiencyRules: document.getElementById("efficiencyRules"),
  plannerNotes: document.getElementById("plannerNotes"),
  trendTitle: document.getElementById("trendTitle"),
  trendBody: document.getElementById("trendBody"),
};

let activeMode = "autopsy";
let reportDepth = "short";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function plannerInput() {
  return {
    wakeTime: elements.wakeTime.value,
    dayEndTime: elements.dayEndTime.value,
    schedule: elements.fixedSchedule.value.trim(),
    priorities: elements.priorities.value.trim(),
  };
}

function renderInsightList(container, items) {
  container.innerHTML = items
    .map(
      (item) => `
        <div class="insight-item">
          <strong>${item.title}</strong>
          <p>${item.detail}</p>
        </div>
      `
    )
    .join("");
}

function setMode(mode) {
  activeMode = mode;
  const planner = mode === "planner";
  elements.autopsyModeBtn.classList.toggle("active", !planner);
  elements.plannerModeBtn.classList.toggle("active", planner);
  elements.autopsyInputSection.classList.toggle("hidden", planner);
  elements.plannerInputSection.classList.toggle("hidden", !planner);
  elements.workspaceHeading.textContent = planner ? "Plan Tomorrow" : "Choose Your Mode";
  elements.analyzeBtn.textContent = planner ? "Plan Tomorrow" : "Show Analysis";
}

function showResultsPage() {
  elements.landingView.classList.add("hidden");
  elements.resultsPage.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showLandingPage() {
  elements.resultsPage.classList.add("hidden");
  elements.landingView.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setReportDepth(depth) {
  reportDepth = depth;
  elements.shortReportBtn.classList.toggle("active", depth === "short");
  elements.deepReportBtn.classList.toggle("active", depth === "deep");
  elements.deepSection.classList.toggle("hidden", depth !== "deep");
}

function renderAutopsy(report) {
  elements.resultsHeading.textContent = "Autopsy Report";
  elements.autopsyControls.classList.remove("hidden");
  elements.autopsyResultsSection.classList.remove("hidden");
  elements.plannerResultsSection.classList.add("hidden");
  elements.autopsySummary.textContent = report.summary;
  elements.severityScore.textContent = Math.round(report.severity);
  elements.confidenceScore.textContent = `${Math.round(report.confidence * 100)}%`;
  elements.failureMoment.textContent = report.failurePoint.moment;
  elements.failureWhy.textContent = report.failurePoint.why;
  elements.scrollCost.textContent = Math.round(report.metrics.scrollCost);
  elements.planningDebt.textContent = Math.round(report.metrics.planningDebt);
  elements.energyStrain.textContent = Math.round(report.metrics.energyStrain);
  elements.timeLeakCount.textContent = report.timeLeaks.length;
  elements.burnoutCount.textContent = report.burnoutSignals.length;
  renderInsightList(elements.timeLeaks, report.timeLeaks);
  renderInsightList(elements.burnoutSignals, report.burnoutSignals);
  renderInsightList(elements.rootCauses, report.rootCauses);
  renderInsightList(elements.behaviorPatches, report.behaviorPatches);
  renderInsightList(elements.failureTimeline, report.timeline);
  renderInsightList(elements.tomorrowPlan, report.tomorrowPlan);
  setReportDepth(reportDepth);
}

function renderPlanner(report) {
  elements.resultsHeading.textContent = "Tomorrow Plan";
  elements.autopsyControls.classList.add("hidden");
  elements.autopsyResultsSection.classList.add("hidden");
  elements.plannerResultsSection.classList.remove("hidden");
  elements.plannerSummary.textContent = report.summary;
  elements.planQualityScore.textContent = Math.round(report.planQuality);
  elements.focusHoursScore.textContent = `${report.focusHours.toFixed(1)}h`;
  elements.bestStartWindow.textContent = report.bestStartWindow;
  elements.bestStartWhy.textContent = report.bestStartWhy;
  elements.plannerWake.textContent = report.planner.wakeTime || "--";
  elements.plannerDeepWork.textContent = report.bestStartWindow;
  elements.plannerShutdown.textContent = report.shutdownTime;
  renderInsightList(elements.schedulePlan, report.suggestedSchedule);
  renderInsightList(elements.priorityPlan, report.priorityPlan);
  renderInsightList(elements.efficiencyRules, report.efficiencyRules);
  renderInsightList(elements.plannerNotes, report.notes);
}

function renderReport(report) {
  elements.analysisStamp.textContent = `Analyzed ${formatDate(report.createdAt)}`;
  elements.trendTitle.textContent = report.trend.title;
  elements.trendBody.textContent = report.trend.body;
  if (report.type === "planner") renderPlanner(report);
  else renderAutopsy(report);
}

function renderHistory(history) {
  if (!history.length) {
    elements.historyList.innerHTML = `<div class="empty-history">Run an autopsy or planner analysis to start your visible history.</div>`;
    return;
  }

  elements.historyList.innerHTML = history
    .slice()
    .reverse()
    .map(
      (item) => `
        <article class="history-item" data-id="${item.id}">
          <div class="history-meta">
            <span>${formatDate(item.createdAt)}</span>
            <span>${item.type === "planner" ? "Planner" : "Autopsy"}</span>
          </div>
          <h3>${item.summary}</h3>
          <p class="history-excerpt">${
            item.type === "planner"
              ? item.planner.priorities || "No priorities entered"
              : `${item.rawLog.slice(0, 140)}${item.rawLog.length > 140 ? "..." : ""}`
          }</p>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".history-item").forEach((node) => {
    node.addEventListener("click", () => {
      const report = loadHistory().find((item) => item.id === node.dataset.id);
      if (!report) return;
      if (report.planner) {
        elements.wakeTime.value = report.planner.wakeTime || "07:30";
        elements.dayEndTime.value = report.planner.dayEndTime || "22:30";
        elements.fixedSchedule.value = report.planner.schedule || "";
        elements.priorities.value = report.planner.priorities || "";
      }
      if (report.rawLog) elements.dayLog.value = report.rawLog;
      setMode(report.type);
      renderReport(report);
      showResultsPage();
    });
  });
}

function renderHistoryChart(history) {
  if (!history.length) {
    elements.historyChart.innerHTML = `<div class="chart-empty">No chart yet. Run a few analyses to build a 2-week view.</div>`;
    elements.historyCountMetric.textContent = "0";
    elements.avgSeverityMetric.textContent = "0";
    elements.plannerCountMetric.textContent = "0";
    elements.trendMetric.textContent = "Stable";
    return;
  }

  const now = new Date();
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (13 - index));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: 0,
    };
  });

  history.forEach((item) => {
    const key = item.createdAt.slice(0, 10);
    const day = days.find((entry) => entry.key === key);
    if (!day) return;
    day.value = Math.max(day.value, item.type === "planner" ? item.planQuality : Math.round(item.severity));
  });

  const maxValue = Math.max(...days.map((day) => day.value), 100);
  const svgBars = days
    .map((day, index) => {
      const height = Math.max(6, (day.value / maxValue) * 150);
      const x = 20 + index * 36;
      const y = 190 - height;
      const fill = day.value > 0 ? "url(#barGradient)" : "rgba(17,17,17,0.08)";
      return `
        <rect x="${x}" y="${y}" width="22" height="${height}" rx="11" fill="${fill}"></rect>
        <text x="${x + 11}" y="214" text-anchor="middle" font-size="10" fill="#77778d">${day.label.slice(0, 3)}</text>
      `;
    })
    .join("");

  elements.historyChart.innerHTML = `
    <svg viewBox="0 0 560 230" width="100%" height="240" role="img" aria-label="Two week analysis chart">
      <defs>
        <linearGradient id="barGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#a468ff"></stop>
          <stop offset="100%" stop-color="#6b35dd"></stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="560" height="230" rx="26" fill="rgba(255,255,255,0.6)"></rect>
      <line x1="18" y1="190" x2="540" y2="190" stroke="rgba(17,17,17,0.08)" stroke-width="1"></line>
      ${svgBars}
    </svg>
  `;

  const autopsies = history.filter((item) => item.type === "autopsy");
  const planners = history.filter((item) => item.type === "planner");
  const avgSeverity =
    autopsies.length > 0
      ? Math.round(autopsies.reduce((sum, item) => sum + item.severity, 0) / autopsies.length)
      : 0;
  const trendDirection =
    autopsies.length >= 2 && autopsies[autopsies.length - 1].severity < autopsies[0].severity
      ? "Improving"
      : planners.length > 1
        ? "More Planned"
        : "Stable";

  elements.historyCountMetric.textContent = String(history.length);
  elements.avgSeverityMetric.textContent = String(avgSeverity);
  elements.plannerCountMetric.textContent = String(planners.length);
  elements.trendMetric.textContent = trendDirection;
}

function runAnalysis() {
  const history = loadHistory();
  let report;

  if (activeMode === "planner") {
    const input = plannerInput();
    if (!input.schedule && !input.priorities) {
      elements.priorities.focus();
      return;
    }
    report = analyzer.analyzeTomorrow(input, history);
  } else {
    const text = elements.dayLog.value.trim();
    if (!text) {
      elements.dayLog.focus();
      return;
    }
    report = analyzer.analyzeDay(text, history, plannerInput());
  }

  const updatedHistory = [...history, report].slice(-20);
  saveHistory(updatedHistory);
  renderReport(report);
  renderHistory(updatedHistory);
  renderHistoryChart(updatedHistory);
  showResultsPage();
}

function loadSample(index = 0) {
  const sample = sampleLogs[index];
  elements.dayLog.value = sample.text;
  elements.wakeTime.value = sample.wake;
  elements.dayEndTime.value = sample.end;
  elements.fixedSchedule.value = sample.schedule;
  elements.priorities.value = sample.priorities;
  setMode("autopsy");
  document.getElementById("planner").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSamples() {
  elements.sampleList.innerHTML = sampleLogs
    .map(
      (sample, index) => `<button class="sample-chip" data-index="${index}">${sample.label}</button>`
    )
    .join("");

  document.querySelectorAll(".sample-chip").forEach((button) => {
    button.addEventListener("click", () => loadSample(Number(button.dataset.index)));
  });
}

elements.jumpToInputBtn.addEventListener("click", () => {
  document.getElementById("planner").scrollIntoView({ behavior: "smooth", block: "start" });
});
elements.heroAnalyzeBtn.addEventListener("click", () => {
  setMode("autopsy");
  document.getElementById("planner").scrollIntoView({ behavior: "smooth", block: "start" });
});
elements.heroPlannerBtn.addEventListener("click", () => {
  setMode("planner");
  document.getElementById("planner").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelectorAll(".feature-option").forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
    document.getElementById("planner").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
elements.backBtn.addEventListener("click", showLandingPage);
elements.autopsyModeBtn.addEventListener("click", () => setMode("autopsy"));
elements.plannerModeBtn.addEventListener("click", () => setMode("planner"));
elements.analyzeBtn.addEventListener("click", runAnalysis);
elements.clearBtn.addEventListener("click", () => {
  elements.dayLog.value = "";
  elements.fixedSchedule.value = "";
  elements.priorities.value = "";
  elements.wakeTime.value = "07:30";
  elements.dayEndTime.value = "22:30";
});
elements.loadSampleBtn.addEventListener("click", () => loadSample(0));
elements.shortReportBtn.addEventListener("click", () => setReportDepth("short"));
elements.deepReportBtn.addEventListener("click", () => setReportDepth("deep"));
elements.clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory([]);
  renderHistoryChart([]);
});
elements.dayLog.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    runAnalysis();
  }
});

renderSamples();
const initialHistory = loadHistory();
renderHistory(initialHistory);
renderHistoryChart(initialHistory);
setMode("autopsy");
setReportDepth("short");

const STORAGE_KEY = "ai-day-autopsy-history";
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
    lateStart: ["woke up late", "slept in", "overslept", "late start"],
    phoneDrift: ["phone", "instagram", "tiktok", "scroll", "social media", "youtube"],
    nutritionDebt: ["skipped breakfast", "skipped lunch", "didn't eat", "forgot to eat", "no lunch"],
    contextSwitching: ["bounced between", "reopened", "tabs", "slack", "multitask", "switched", "three tasks"],
    stress: ["fried", "wired", "overwhelmed", "burned out", "heavy", "useless", "crashed", "drained"],
    urgency: ["rushed", "behind", "forgot", "missed", "due", "late"],
    fatigue: ["tired", "exhausted", "no break", "too much coffee", "staring", "mistakes"],
    planningDebt: ["forgot", "missed", "behind", "bounced between", "rushed", "started three tasks"],
  },

  analyze(log, history, planInput) {
    const normalized = log.toLowerCase();
    const features = this.detectFeatures(normalized);
    const metrics = this.computeMetrics(features, normalized, planInput);
    const severity = this.computeSeverity(metrics);
    const confidence = this.computeConfidence(features, normalized, planInput);
    const timeLeaks = this.buildTimeLeaks(features, metrics);
    const burnoutSignals = this.buildBurnoutSignals(features, metrics);
    const rootCauses = this.buildRootCauses(features);
    const behaviorPatches = this.buildBehaviorPatches(features, planInput);
    const summary = this.buildSummary(features, severity);
    const timeline = this.buildFailureTimeline(features, metrics);
    const tomorrowPlan = this.buildTomorrowPlan(planInput, features);
    const trend = this.buildTrend(rootCauses, history);
    const failurePoint = this.buildFailurePoint(features, metrics);

    return {
      id: createId(),
      createdAt: new Date().toISOString(),
      rawLog: log.trim(),
      severity,
      confidence,
      summary,
      timeLeaks,
      burnoutSignals,
      rootCauses,
      behaviorPatches,
      timeline,
      tomorrowPlan,
      trend,
      metrics,
      failurePoint,
      planner: planInput,
    };
  },

  detectFeatures(text) {
    const flags = {};
    for (const [key, phrases] of Object.entries(this.keywordSets)) {
      flags[key] = phrases.some((phrase) => text.includes(phrase));
    }

    return {
      ...flags,
      longLog: text.split(/\s+/).length > 45,
      intenseDay:
        (flags.phoneDrift ? 1 : 0) +
          (flags.contextSwitching ? 1 : 0) +
          (flags.stress ? 1 : 0) +
          (flags.urgency ? 1 : 0) >=
        3,
    };
  },

  timeToMinutes(value, fallback) {
    if (!value) return fallback;
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

  computeMetrics(features, text, planInput) {
    const wakeMinutes = this.timeToMinutes(planInput.wakeTime, 450);
    const endMinutes = this.timeToMinutes(planInput.dayEndTime, 1350);
    const dayLength = Math.max(600, endMinutes - wakeMinutes);

    const scrollCost = (features.phoneDrift ? 28 : 8) + (features.lateStart ? 10 : 0);
    const planningDebt =
      (features.planningDebt ? 26 : 10) +
      (!planInput.schedule ? 14 : 0) +
      (!planInput.priorities ? 12 : 0);
    const energyStrain =
      (features.nutritionDebt ? 24 : 8) +
      (features.stress ? 20 : 6) +
      (features.fatigue ? 18 : 4);

    let firstFailureMinute = wakeMinutes + 30;
    if (features.phoneDrift) firstFailureMinute = wakeMinutes + 40;
    else if (features.lateStart) firstFailureMinute = wakeMinutes + 20;
    else if (features.contextSwitching) firstFailureMinute = wakeMinutes + 150;
    else if (features.nutritionDebt) firstFailureMinute = wakeMinutes + 240;

    const focusRecoveryWindow = Math.max(45, Math.round((dayLength - scrollCost - planningDebt) / 8));

    return {
      wakeMinutes,
      endMinutes,
      dayLength,
      scrollCost,
      planningDebt,
      energyStrain,
      firstFailureMinute,
      focusRecoveryWindow,
      lateWakePenalty: features.lateStart ? 16 : 4,
      taskSwitchPenalty: features.contextSwitching ? 24 : 8,
      planCompleteness:
        (planInput.schedule ? 1 : 0) + (planInput.priorities ? 1 : 0) + (planInput.wakeTime ? 1 : 0),
      textIncludesPlanWords: text.includes("plan") || text.includes("schedule"),
    };
  },

  computeSeverity(metrics) {
    return Math.min(
      97,
      28 +
        metrics.scrollCost * 0.7 +
        metrics.planningDebt * 0.55 +
        metrics.energyStrain * 0.62 +
        metrics.taskSwitchPenalty * 0.4
    );
  },

  computeConfidence(features, text, planInput) {
    let score = 0.63;
    if (features.longLog) score += 0.08;
    if (features.phoneDrift) score += 0.07;
    if (features.contextSwitching) score += 0.08;
    if (features.stress) score += 0.06;
    if (text.includes("felt")) score += 0.04;
    if (planInput.schedule || planInput.priorities) score += 0.03;
    return Math.min(0.95, score);
  },

  buildTimeLeaks(features, metrics) {
    const list = [];

    if (features.phoneDrift) {
      list.push({
        title: `Reactive screen drift (+${metrics.scrollCost} drag points)`,
        detail:
          "The first usable minutes of the day were spent consuming input instead of stabilizing direction, so the day started from reaction mode.",
      });
    }

    if (features.contextSwitching) {
      list.push({
        title: `Task-fragmented work blocks (+${metrics.taskSwitchPenalty} restart penalty)`,
        detail:
          "Repeated reopening and switching created restart costs, which made the workload feel larger than it actually was.",
      });
    }

    list.push({
      title: `Planning debt (+${metrics.planningDebt} friction points)`,
      detail:
        "A weak or missing day shape meant the next task had to be re-decided too often, which silently burned attention.",
    });

    return list.slice(0, 3);
  },

  buildBurnoutSignals(features, metrics) {
    const list = [];

    if (features.nutritionDebt) {
      list.push({
        title: "Energy support broke early",
        detail:
          "Skipping meals increased the odds that focus problems later in the day felt like personal failure instead of depleted fuel.",
      });
    }

    if (features.stress) {
      list.push({
        title: "Language of overload",
        detail:
          "Words like fried, useless, or overwhelmed usually signal strain accumulation rather than a single bad task.",
      });
    }

    list.push({
      title: `Accumulated energy strain (${metrics.energyStrain}/50)`,
      detail:
        "The app sees mounting pressure from low fuel, urgency, and declining executive control by late day.",
    });

    return list.slice(0, 3);
  },

  buildRootCauses(features) {
    const causes = [];

    if (features.phoneDrift || features.lateStart) {
      causes.push({
        title: "Unprotected start-of-day ramp",
        detail:
          "Your first hour was too easy to hijack, so the rest of the day inherited a weaker baseline for focus and pacing.",
      });
    }

    if (features.contextSwitching || features.urgency) {
      causes.push({
        title: "No stable execution lane",
        detail:
          "Without a defined lane, each interruption or open tab became a new candidate for attention.",
      });
    }

    if (features.nutritionDebt || features.stress || features.fatigue) {
      causes.push({
        title: "Physical depletion amplified mental noise",
        detail:
          "The breakdown was not only organizational. Low fuel and strain made ordinary friction much more expensive.",
      });
    }

    while (causes.length < 3) {
      causes.push({
        title: "Feedback loop of inconsistency",
        detail:
          "Small slips stacked into a self-confirming story that the day was off, which made recovery less likely.",
      });
    }

    return causes.slice(0, 3);
  },

  buildBehaviorPatches(features, planInput) {
    const patches = [];

    patches.push({
      title: "Lock the first 30 minutes",
      detail:
        "Keep your phone out of reach until you have water, food, and one written first task. Prevent passive input before active intent.",
    });

    patches.push({
      title: "Run one visible work lane",
      detail:
        "Pick a single 45-minute priority block, close all non-task tabs, and keep a scratchpad for distractions instead of switching immediately.",
    });

    patches.push({
      title: `Pre-load tomorrow by ${planInput.wakeTime || "07:30"}`,
      detail:
        "Define the wake time, your first work block, and one midday energy checkpoint tonight so tomorrow starts with structure already installed.",
    });

    return patches;
  },

  buildSummary(features, severity) {
    if (features.phoneDrift && features.contextSwitching) {
      return `The day likely failed at the transition from intention to execution: the first hour drifted, then the rest of the day fractured. Severity ${Math.round(severity)}/100.`;
    }

    if (features.nutritionDebt && features.stress) {
      return `This looks less like laziness and more like depletion: low physical support made the afternoon collapse feel sharper than the workload alone would explain. Severity ${Math.round(severity)}/100.`;
    }

    return `The main pattern was unstable focus under rising strain, which turned normal work into a cascade of friction by mid to late day. Severity ${Math.round(severity)}/100.`;
  },

  buildFailureTimeline(features, metrics) {
    return [
      {
        title: `${this.minutesToClock(metrics.wakeMinutes)} | Day setup window`,
        detail: features.lateStart
          ? "The day began behind schedule, which shrank the margin for calm setup immediately."
          : "This was the best window to set direction before the day got noisy.",
      },
      {
        title: `${this.minutesToClock(metrics.firstFailureMinute)} | Likely first break point`,
        detail: features.phoneDrift
          ? `Phone drift likely consumed the first planning block and cost about ${metrics.scrollCost} focus points.`
          : "Early structure appears to have broken here, which made later choices more reactive.",
      },
      {
        title: `${this.minutesToClock(metrics.firstFailureMinute + 180)} | Compounding phase`,
        detail:
          "By this point the app sees planning debt and task switching interacting, so recovery required more effort than prevention would have.",
      },
      {
        title: `${this.minutesToClock(metrics.endMinutes - 120)} | Fatigue zone`,
        detail:
          `Late-day control likely weakened here. Estimated recovery window remaining: ${metrics.focusRecoveryWindow} usable minutes.`,
      },
    ];
  },

  buildFailurePoint(features, metrics) {
    if (features.phoneDrift) {
      return {
        moment: `${this.minutesToClock(metrics.firstFailureMinute)}: screen drift displaced day setup`,
        why: "The first high-leverage decision window was lost to passive scrolling, which made the rest of the day reactive instead of directed.",
      };
    }

    if (features.lateStart) {
      return {
        moment: `${this.minutesToClock(metrics.firstFailureMinute)}: late wake-up compressed the day`,
        why: "Waking late likely triggered urgency before the day had structure, so execution started from catch-up mode.",
      };
    }

    return {
      moment: `${this.minutesToClock(metrics.firstFailureMinute)}: planning debt started to show`,
      why: "The day appears to have drifted once tasks stopped being pre-decided and attention had to keep renegotiating priorities.",
    };
  },

  buildTomorrowPlan(planInput, features) {
    const wakeMinutes = this.timeToMinutes(planInput.wakeTime, 450);
    const firstFocus = this.minutesToClock(wakeMinutes + 45);
    const middayReset = this.minutesToClock(wakeMinutes + 300);
    const shutdown = this.minutesToClock(this.timeToMinutes(planInput.dayEndTime, 1350) - 45);

    return [
      {
        title: `${planInput.wakeTime || "07:30"} | Wake and protect the first 30 minutes`,
        detail:
          "No scrolling until food, water, and a written first move are done. This guards the day’s cleanest attention window.",
      },
      {
        title: `${firstFocus} | First deep block`,
        detail: `Start with the single task that matters most tomorrow${planInput.priorities ? `: ${planInput.priorities.split(",")[0].trim()}` : ""}.`,
      },
      {
        title: `${middayReset} | Midday reset`,
        detail:
          "Eat, step away, and choose the next one or two tasks deliberately instead of carrying morning chaos into the afternoon.",
      },
      {
        title: `${shutdown} | Close the loop`,
        detail: features.contextSwitching
          ? "List unfinished items and assign each one to a future slot so open loops do not leak back into the evening."
          : "Write the next day’s first task before stopping so tomorrow does not begin from friction.",
      },
    ];
  },

  buildTrend(rootCauses, history) {
    if (!history.length) {
      return {
        title: "No trend yet",
        body: "One report is enough for diagnosis, but not enough to confirm whether the same failure mode is repeating across days.",
      };
    }

    const currentPrimary = rootCauses[0].title;
    const repeatCount = history.filter(
      (item) => item.rootCauses && item.rootCauses[0] && item.rootCauses[0].title === currentPrimary
    ).length;

    if (repeatCount >= 2) {
      return {
        title: "Repeat pattern detected",
        body: `The top failure mode has appeared ${repeatCount + 1} times including today. This is behaving like a system pattern, not a one-off miss.`,
      };
    }

    return {
      title: "Pattern still forming",
      body: "Today shares some friction with earlier reports, but the app does not yet see one dominant repeating cause.",
    };
  },
};

const elements = {
  dayLog: document.getElementById("dayLog"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  clearBtn: document.getElementById("clearBtn"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  sampleList: document.getElementById("sampleList"),
  emptyState: document.getElementById("emptyState"),
  resultsView: document.getElementById("resultsView"),
  analysisStamp: document.getElementById("analysisStamp"),
  autopsySummary: document.getElementById("autopsySummary"),
  severityScore: document.getElementById("severityScore"),
  confidenceScore: document.getElementById("confidenceScore"),
  timeLeakCount: document.getElementById("timeLeakCount"),
  burnoutCount: document.getElementById("burnoutCount"),
  timeLeaks: document.getElementById("timeLeaks"),
  burnoutSignals: document.getElementById("burnoutSignals"),
  rootCauses: document.getElementById("rootCauses"),
  behaviorPatches: document.getElementById("behaviorPatches"),
  trendTitle: document.getElementById("trendTitle"),
  trendBody: document.getElementById("trendBody"),
  historyList: document.getElementById("historyList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  shortReportBtn: document.getElementById("shortReportBtn"),
  deepReportBtn: document.getElementById("deepReportBtn"),
  deepSection: document.getElementById("deepSection"),
  failureMoment: document.getElementById("failureMoment"),
  failureWhy: document.getElementById("failureWhy"),
  scrollCost: document.getElementById("scrollCost"),
  planningDebt: document.getElementById("planningDebt"),
  energyStrain: document.getElementById("energyStrain"),
  failureTimeline: document.getElementById("failureTimeline"),
  tomorrowPlan: document.getElementById("tomorrowPlan"),
  wakeTime: document.getElementById("wakeTime"),
  dayEndTime: document.getElementById("dayEndTime"),
  fixedSchedule: document.getElementById("fixedSchedule"),
  priorities: document.getElementById("priorities"),
  autopsyModeBtn: document.getElementById("autopsyModeBtn"),
  plannerModeBtn: document.getElementById("plannerModeBtn"),
  featureMenuBtn: document.getElementById("featureMenuBtn"),
};

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

function setReportDepth(depth) {
  reportDepth = depth;
  elements.shortReportBtn.classList.toggle("active", depth === "short");
  elements.deepReportBtn.classList.toggle("active", depth === "deep");
  elements.deepSection.classList.toggle("hidden", depth !== "deep");
}

function plannerInput() {
  return {
    wakeTime: elements.wakeTime.value,
    dayEndTime: elements.dayEndTime.value,
    schedule: elements.fixedSchedule.value.trim(),
    priorities: elements.priorities.value.trim(),
  };
}

function renderAnalysis(report) {
  elements.emptyState.classList.add("hidden");
  elements.resultsView.classList.remove("hidden");
  elements.analysisStamp.textContent = `Analyzed ${formatDate(report.createdAt)}`;
  elements.autopsySummary.textContent = report.summary;
  elements.severityScore.textContent = Math.round(report.severity);
  elements.confidenceScore.textContent = `${Math.round(report.confidence * 100)}%`;
  elements.timeLeakCount.textContent = String(report.timeLeaks.length);
  elements.burnoutCount.textContent = String(report.burnoutSignals.length);
  elements.trendTitle.textContent = report.trend.title;
  elements.trendBody.textContent = report.trend.body;
  elements.failureMoment.textContent = report.failurePoint.moment;
  elements.failureWhy.textContent = report.failurePoint.why;
  elements.scrollCost.textContent = Math.round(report.metrics.scrollCost);
  elements.planningDebt.textContent = Math.round(report.metrics.planningDebt);
  elements.energyStrain.textContent = Math.round(report.metrics.energyStrain);

  renderInsightList(elements.timeLeaks, report.timeLeaks);
  renderInsightList(elements.burnoutSignals, report.burnoutSignals);
  renderInsightList(elements.rootCauses, report.rootCauses);
  renderInsightList(elements.behaviorPatches, report.behaviorPatches);
  renderInsightList(elements.failureTimeline, report.timeline);
  renderInsightList(elements.tomorrowPlan, report.tomorrowPlan);
  setReportDepth(reportDepth);
}

function renderHistory(history) {
  if (!history.length) {
    elements.historyList.innerHTML = `
      <div class="empty-history">
        Run an analysis to start building a personal pattern history.
      </div>
    `;
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
            <span>Severity ${Math.round(item.severity)}</span>
            <span>${Math.round(item.confidence * 100)}% confidence</span>
          </div>
          <h3>${item.summary}</h3>
          <p class="history-excerpt">${item.rawLog.slice(0, 130)}${item.rawLog.length > 130 ? "..." : ""}</p>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".history-item").forEach((node) => {
    node.addEventListener("click", () => {
      const historyItems = loadHistory();
      const match = historyItems.find((item) => item.id === node.dataset.id);
      if (match) {
        elements.dayLog.value = match.rawLog;
        if (match.planner) {
          elements.wakeTime.value = match.planner.wakeTime || "07:30";
          elements.dayEndTime.value = match.planner.dayEndTime || "22:30";
          elements.fixedSchedule.value = match.planner.schedule || "";
          elements.priorities.value = match.planner.priorities || "";
        }
        renderAnalysis(match);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });
}

function runAnalysis(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    elements.dayLog.focus();
    return;
  }

  const history = loadHistory();
  const report = analyzer.analyze(trimmed, history, plannerInput());
  const updatedHistory = [...history, report].slice(-12);
  saveHistory(updatedHistory);
  renderAnalysis(report);
  renderHistory(updatedHistory);
}

function loadSample(index = 0) {
  const sample = sampleLogs[index];
  elements.dayLog.value = sample.text;
  elements.wakeTime.value = sample.wake;
  elements.dayEndTime.value = sample.end;
  elements.fixedSchedule.value = sample.schedule;
  elements.priorities.value = sample.priorities;
  elements.dayLog.focus();
}

function renderSamples() {
  elements.sampleList.innerHTML = sampleLogs
    .map(
      (sample, index) => `
        <button class="sample-chip" data-index="${index}">${sample.label}</button>
      `
    )
    .join("");

  document.querySelectorAll(".sample-chip").forEach((button) => {
    button.addEventListener("click", () => {
      loadSample(Number(button.dataset.index));
    });
  });
}

function setIntent(mode) {
  const planner = mode === "planner";
  elements.autopsyModeBtn.classList.toggle("active", !planner);
  elements.plannerModeBtn.classList.toggle("active", planner);
  if (planner) {
    elements.priorities.focus();
  } else {
    elements.dayLog.focus();
  }
}

document.querySelectorAll(".feature-option").forEach((button) => {
  button.addEventListener("click", () => {
    setIntent(button.dataset.mode);
  });
});

elements.analyzeBtn.addEventListener("click", () => runAnalysis(elements.dayLog.value));
elements.clearBtn.addEventListener("click", () => {
  elements.dayLog.value = "";
  elements.fixedSchedule.value = "";
  elements.priorities.value = "";
  elements.dayLog.focus();
});
elements.loadSampleBtn.addEventListener("click", () => loadSample(0));
elements.clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory([]);
});
elements.shortReportBtn.addEventListener("click", () => setReportDepth("short"));
elements.deepReportBtn.addEventListener("click", () => setReportDepth("deep"));
elements.autopsyModeBtn.addEventListener("click", () => setIntent("autopsy"));
elements.plannerModeBtn.addEventListener("click", () => setIntent("planner"));
elements.featureMenuBtn.addEventListener("click", () => setIntent("planner"));
elements.dayLog.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    runAnalysis(elements.dayLog.value);
  }
});

renderSamples();
renderHistory(loadHistory());
setReportDepth("short");

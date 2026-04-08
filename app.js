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

  analyzeDay(log, history, planInput) {
    const normalized = log.toLowerCase();
    const features = this.detectFeatures(normalized);
    const metrics = this.computeMetrics(features, planInput);
    const severity = this.computeSeverity(metrics);
    const confidence = this.computeConfidence(features, normalized, planInput);
    const timeLeaks = this.buildTimeLeaks(features, metrics);
    const burnoutSignals = this.buildBurnoutSignals(features, metrics);
    const rootCauses = this.buildRootCauses(features);
    const behaviorPatches = this.buildBehaviorPatches(planInput);
    const summary = this.buildSummary(features, severity);
    const timeline = this.buildFailureTimeline(features, metrics);
    const tomorrowPlan = this.buildTomorrowPlan(planInput, features);
    const trend = this.buildTrend(rootCauses, history, "autopsy");
    const failurePoint = this.buildFailurePoint(features, metrics);

    return {
      id: createId(),
      type: "autopsy",
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

  analyzeTomorrow(planInput, history) {
    const wakeMinutes = this.timeToMinutes(planInput.wakeTime || "07:30");
    const endMinutes = this.timeToMinutes(planInput.dayEndTime || "22:30");
    const usableMinutes = Math.max(540, endMinutes - wakeMinutes);
    const deepWorkStart = wakeMinutes + 45;
    const middayReset = wakeMinutes + 300;
    const shutdown = Math.max(wakeMinutes + 720, endMinutes - 45);
    const focusHours = Math.max(2.5, Math.min(7.5, (usableMinutes - 240) / 60));
    const priorityCount = this.splitList(planInput.priorities).length;
    const scheduleItems = this.splitList(planInput.schedule).length;
    const planQuality = Math.min(96, 48 + priorityCount * 9 + scheduleItems * 7 + (focusHours - 2) * 4);

    const suggestedSchedule = [
      {
        title: `${planInput.wakeTime || "07:30"} | Wake, fuel, and orient`,
        detail:
          "Use the first 30 minutes for water, food, and deciding the first priority. Do not let messages or scrolling occupy this slot.",
      },
      {
        title: `${this.minutesToClock(deepWorkStart)} | Primary deep-work block`,
        detail: priorityCount
          ? `Start with ${this.splitList(planInput.priorities)[0]}. This should be the cleanest cognitive block of the day.`
          : "Reserve this block for the hardest task before lower-value noise enters the day.",
      },
      {
        title: `${this.minutesToClock(middayReset)} | Midday reset`,
        detail:
          "Break, eat, and decide the next work lane deliberately. This prevents the afternoon from becoming reactive.",
      },
      {
        title: `${this.minutesToClock(shutdown)} | Shutdown window`,
        detail:
          "Close loops, list carryover tasks, and decide tomorrow’s first move before ending the day.",
      },
    ];

    const priorityPlan = this.splitList(planInput.priorities).length
      ? this.splitList(planInput.priorities).slice(0, 4).map((priority, index) => ({
          title: `Priority ${index + 1} | ${priority}`,
          detail:
            index === 0
              ? "Put this in the first deep-work block."
              : index === 1
                ? "Handle this after the midday reset."
                : "Keep this in a later, lower-energy slot or batch it with admin work.",
        }))
      : [
          {
            title: "No priorities entered",
            detail: "Add 2 to 4 concrete priorities so the planner can schedule a tighter day.",
          },
        ];

    const efficiencyRules = [
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
    ];

    const notes = [
      {
        title: `Focus capacity | ${focusHours.toFixed(1)} hours`,
        detail: "This is the estimated amount of realistic focused work your schedule can hold without turning the whole day into strain.",
      },
      {
        title: `Commitment load | ${scheduleItems} fixed item${scheduleItems === 1 ? "" : "s"}`,
        detail:
          scheduleItems > 0
            ? "Your fixed commitments reduce flexibility, so the first deep-work window becomes more valuable."
            : "Your day is flexible, which means structure matters even more because nothing external will impose it.",
      },
      {
        title: "Planning logic",
        detail:
          "The planner front-loads hard work, inserts a reset before the afternoon, and uses a shutdown window so tomorrow does not begin in friction.",
      },
    ];

    return {
      id: createId(),
      type: "planner",
      createdAt: new Date().toISOString(),
      planner: planInput,
      summary:
        priorityCount > 0
          ? `Tomorrow should start earlier in intention than in effort: lock the first hour, start with ${this.splitList(planInput.priorities)[0]}, and avoid letting fixed commitments scatter your attention.`
          : "Tomorrow needs a stronger structure first: set 2 to 4 priorities, protect the first hour, and use fixed commitments as anchors instead of letting them fragment the day.",
      planQuality,
      focusHours,
      bestStartWindow: this.minutesToClock(deepWorkStart),
      bestStartWhy:
        "This is the earliest clean slot after waking where cognitive energy is still high and the day has not yet been fragmented.",
      shutdownTime: this.minutesToClock(shutdown),
      suggestedSchedule,
      priorityPlan,
      efficiencyRules,
      notes,
      trend: this.buildTrend([], history, "planner"),
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

  splitList(value) {
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  },

  timeToMinutes(value) {
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

  computeMetrics(features, planInput) {
    const wakeMinutes = this.timeToMinutes(planInput.wakeTime || "07:30");
    const endMinutes = this.timeToMinutes(planInput.dayEndTime || "22:30");
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
      taskSwitchPenalty: features.contextSwitching ? 24 : 8,
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
    return [
      {
        title: features.nutritionDebt ? "Energy support broke early" : "Energy support looks unstable",
        detail:
          "Skipping meals or delaying recovery tends to make late-day focus problems feel like a character issue instead of a fuel issue.",
      },
      {
        title: features.stress ? "Language of overload" : "Stress is likely compounding friction",
        detail:
          "Words like fried, useless, or overwhelmed usually signal strain accumulation rather than one isolated mistake.",
      },
      {
        title: `Accumulated energy strain (${metrics.energyStrain}/50)`,
        detail:
          "The app sees mounting pressure from low fuel, urgency, and declining executive control by late day.",
      },
    ];
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

  buildBehaviorPatches(planInput) {
    return [
      {
        title: "Lock the first 30 minutes",
        detail:
          "Keep your phone out of reach until you have water, food, and one written first task. Prevent passive input before active intent.",
      },
      {
        title: "Run one visible work lane",
        detail:
          "Pick a single 45-minute priority block, close all non-task tabs, and keep a scratchpad for distractions instead of switching immediately.",
      },
      {
        title: `Pre-load tomorrow by ${planInput.wakeTime || "07:30"}`,
        detail:
          "Define the wake time, your first work block, and one midday energy checkpoint tonight so tomorrow starts with structure already installed.",
      },
    ];
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
    const wakeMinutes = this.timeToMinutes(planInput.wakeTime || "07:30");
    const firstFocus = this.minutesToClock(wakeMinutes + 45);
    const middayReset = this.minutesToClock(wakeMinutes + 300);
    const shutdown = this.minutesToClock(this.timeToMinutes(planInput.dayEndTime || "22:30") - 45);

    return [
      {
        title: `${planInput.wakeTime || "07:30"} | Wake and protect the first 30 minutes`,
        detail:
          "No scrolling until food, water, and a written first move are done. This guards the day’s cleanest attention window.",
      },
      {
        title: `${firstFocus} | First deep block`,
        detail: `Start with the single task that matters most tomorrow${planInput.priorities ? `: ${this.splitList(planInput.priorities)[0]}` : ""}.`,
      },
      {
        title: `${middayReset} | Midday reset`,
        detail:
          "Break, eat, and choose the next one or two tasks deliberately instead of carrying morning chaos into the afternoon.",
      },
      {
        title: `${shutdown} | Close the loop`,
        detail: features.contextSwitching
          ? "List unfinished items and assign each one to a future slot so open loops do not leak back into the evening."
          : "Write the next day’s first task before stopping so tomorrow does not begin from friction.",
      },
    ];
  },

  buildTrend(rootCauses, history, type) {
    const sameTypeHistory = history.filter((item) => item.type === type);

    if (!sameTypeHistory.length) {
      return {
        title: "No trend yet",
        body:
          type === "planner"
            ? "You have one planning run so far. Save more tomorrow plans to compare how consistent your structure becomes."
            : "One report is enough for diagnosis, but not enough to confirm whether the same failure mode is repeating across days.",
      };
    }

    if (type === "planner") {
      return {
        title: "Planner history active",
        body: `You now have ${sameTypeHistory.length + 1} planning runs including this one. Reuse the planner to compare better day structures over time.`,
      };
    }

    const currentPrimary = rootCauses[0].title;
    const repeatCount = sameTypeHistory.filter(
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
  emptyText: document.getElementById("emptyText"),
  resultsView: document.getElementById("resultsView"),
  resultsHeading: document.getElementById("resultsHeading"),
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
  autopsyInputSection: document.getElementById("autopsyInputSection"),
  plannerInputSection: document.getElementById("plannerInputSection"),
  autopsyControls: document.getElementById("autopsyControls"),
  autopsyResultsSection: document.getElementById("autopsyResultsSection"),
  plannerResultsSection: document.getElementById("plannerResultsSection"),
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
};

let reportDepth = "short";
let activeMode = "autopsy";

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

function renderAutopsy(report) {
  elements.resultsHeading.textContent = "Autopsy Report";
  elements.autopsyControls.classList.remove("hidden");
  elements.autopsyResultsSection.classList.remove("hidden");
  elements.plannerResultsSection.classList.add("hidden");

  elements.autopsySummary.textContent = report.summary;
  elements.severityScore.textContent = Math.round(report.severity);
  elements.confidenceScore.textContent = `${Math.round(report.confidence * 100)}%`;
  elements.timeLeakCount.textContent = String(report.timeLeaks.length);
  elements.burnoutCount.textContent = String(report.burnoutSignals.length);
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
  elements.emptyState.classList.add("hidden");
  elements.resultsView.classList.remove("hidden");
  elements.analysisStamp.textContent = `Analyzed ${formatDate(report.createdAt)}`;
  elements.trendTitle.textContent = report.trend.title;
  elements.trendBody.textContent = report.trend.body;

  if (report.type === "planner") renderPlanner(report);
  else renderAutopsy(report);
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
            <span>${item.type === "planner" ? "Planner" : "Autopsy"}</span>
          </div>
          <h3>${item.summary}</h3>
          <p class="history-excerpt">${
            item.type === "planner"
              ? `${item.planner.priorities || "No priorities entered"}`
              : `${item.rawLog.slice(0, 130)}${item.rawLog.length > 130 ? "..." : ""}`
          }</p>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".history-item").forEach((node) => {
    node.addEventListener("click", () => {
      const historyItems = loadHistory();
      const match = historyItems.find((item) => item.id === node.dataset.id);
      if (!match) return;

      if (match.planner) {
        elements.wakeTime.value = match.planner.wakeTime || "07:30";
        elements.dayEndTime.value = match.planner.dayEndTime || "22:30";
        elements.fixedSchedule.value = match.planner.schedule || "";
        elements.priorities.value = match.planner.priorities || "";
      }
      if (match.rawLog) {
        elements.dayLog.value = match.rawLog;
      }

      setMode(match.type === "planner" ? "planner" : "autopsy");
      renderReport(match);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
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
    const trimmed = elements.dayLog.value.trim();
    if (!trimmed) {
      elements.dayLog.focus();
      return;
    }
    report = analyzer.analyzeDay(trimmed, history, plannerInput());
  }

  const updatedHistory = [...history, report].slice(-12);
  saveHistory(updatedHistory);
  renderReport(report);
  renderHistory(updatedHistory);
}

function loadSample(index = 0) {
  const sample = sampleLogs[index];
  elements.dayLog.value = sample.text;
  elements.wakeTime.value = sample.wake;
  elements.dayEndTime.value = sample.end;
  elements.fixedSchedule.value = sample.schedule;
  elements.priorities.value = sample.priorities;
  setMode("autopsy");
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

function setMode(mode) {
  activeMode = mode;
  const planner = mode === "planner";

  elements.autopsyModeBtn.classList.toggle("active", !planner);
  elements.plannerModeBtn.classList.toggle("active", planner);
  elements.autopsyInputSection.classList.toggle("hidden", planner);
  elements.plannerInputSection.classList.toggle("hidden", !planner);

  elements.emptyText.textContent = planner
    ? "Enter tomorrow’s wake time, end time, schedule constraints, and priorities to generate a better day plan."
    : "Start with a rough day log to uncover where the day failed.";

  if (planner) elements.priorities.focus();
  else elements.dayLog.focus();
}

document.querySelectorAll(".feature-option").forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
});

elements.analyzeBtn.addEventListener("click", runAnalysis);
elements.clearBtn.addEventListener("click", () => {
  elements.dayLog.value = "";
  elements.fixedSchedule.value = "";
  elements.priorities.value = "";
  elements.wakeTime.value = "07:30";
  elements.dayEndTime.value = "22:30";
  if (activeMode === "planner") elements.priorities.focus();
  else elements.dayLog.focus();
});
elements.loadSampleBtn.addEventListener("click", () => loadSample(0));
elements.clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory([]);
});
elements.shortReportBtn.addEventListener("click", () => setReportDepth("short"));
elements.deepReportBtn.addEventListener("click", () => setReportDepth("deep"));
elements.autopsyModeBtn.addEventListener("click", () => setMode("autopsy"));
elements.plannerModeBtn.addEventListener("click", () => setMode("planner"));
elements.featureMenuBtn.addEventListener("click", () => setMode("planner"));
elements.dayLog.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    runAnalysis();
  }
});

renderSamples();
renderHistory(loadHistory());
setReportDepth("short");
setMode("autopsy");

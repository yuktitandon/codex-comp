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
  },
  {
    label: "Context-Switch Spiral",
    text:
      "I started three tasks before finishing one, kept replying to Slack right away, had six tabs open for one assignment, skipped lunch because I thought I was behind, and spent the evening staring at work without getting traction.",
  },
  {
    label: "Silent Burnout",
    text:
      "I got through the whole day technically working, but everything felt heavy. I procrastinated starting hard work, drank too much coffee, had no real break, made tiny mistakes in things I normally do well, and crashed after dinner.",
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
  },

  analyze(log, history) {
    const normalized = log.toLowerCase();
    const features = this.detectFeatures(normalized);
    const severity = this.computeSeverity(features);
    const confidence = this.computeConfidence(features, normalized);
    const timeLeaks = this.buildTimeLeaks(features);
    const burnoutSignals = this.buildBurnoutSignals(features);
    const rootCauses = this.buildRootCauses(features);
    const behaviorPatches = this.buildBehaviorPatches(features);
    const summary = this.buildSummary(features, severity);
    const trend = this.buildTrend(rootCauses, history);

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
      trend,
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

  computeSeverity(features) {
    let score = 39;
    if (features.lateStart) score += 11;
    if (features.phoneDrift) score += 13;
    if (features.nutritionDebt) score += 10;
    if (features.contextSwitching) score += 15;
    if (features.stress) score += 14;
    if (features.urgency) score += 9;
    if (features.fatigue) score += 11;
    if (features.intenseDay) score += 8;
    return Math.min(97, score);
  },

  computeConfidence(features, text) {
    let score = 0.62;
    if (features.longLog) score += 0.08;
    if (features.phoneDrift) score += 0.07;
    if (features.contextSwitching) score += 0.08;
    if (features.stress) score += 0.06;
    if (text.includes("felt")) score += 0.04;
    return Math.min(0.94, score);
  },

  buildTimeLeaks(features) {
    const list = [];

    if (features.phoneDrift) {
      list.push({
        title: "Reactive screen drift",
        detail: "The day opened in consumption mode, which likely delayed cognitive momentum before real work started.",
      });
    }

    if (features.contextSwitching) {
      list.push({
        title: "Task-fragmented work blocks",
        detail: "Repeated reopening and switching created restart costs, making even simple work feel heavier than it was.",
      });
    }

    if (features.urgency) {
      list.push({
        title: "Emergency-mode execution",
        detail: "Running the day from missed items and urgency cues forced reaction instead of prioritization.",
      });
    }

    if (!list.length) {
      list.push({
        title: "Diffuse attention leakage",
        detail: "The day appears to have spread effort too thinly, with low-friction decisions eating focus in the background.",
      });
    }

    return list.slice(0, 3);
  },

  buildBurnoutSignals(features) {
    const list = [];

    if (features.nutritionDebt) {
      list.push({
        title: "Energy support broke early",
        detail: "Skipping meals increased the odds that focus problems later in the day felt like personal failure instead of depleted fuel.",
      });
    }

    if (features.stress) {
      list.push({
        title: "Language of overload",
        detail: "Words like fried, useless, or overwhelmed usually signal strain accumulation rather than a single bad task.",
      });
    }

    if (features.fatigue || features.intenseDay) {
      list.push({
        title: "Cognitive fatigue buildup",
        detail: "Mistakes, staring at work, or relying on caffeine point to declining executive control by late afternoon.",
      });
    }

    if (!list.length) {
      list.push({
        title: "Low-grade strain pattern",
        detail: "The day shows friction without full collapse, which is often how early burnout risk first presents.",
      });
    }

    return list.slice(0, 3);
  },

  buildRootCauses(features) {
    const causes = [];

    if (features.phoneDrift || features.lateStart) {
      causes.push({
        title: "Unprotected start-of-day ramp",
        detail: "Your first hour was easy to hijack, so the rest of the day inherited a weaker baseline for focus and pacing.",
      });
    }

    if (features.contextSwitching || features.urgency) {
      causes.push({
        title: "No stable execution lane",
        detail: "Without a defined work lane, every interruption or open tab became a new priority candidate.",
      });
    }

    if (features.nutritionDebt || features.stress || features.fatigue) {
      causes.push({
        title: "Physical depletion amplified mental noise",
        detail: "The breakdown was not just organizational. Low fuel and strain made normal friction feel much more expensive.",
      });
    }

    while (causes.length < 3) {
      causes.push({
        title: "Feedback loop of inconsistency",
        detail: "Small slips stacked into a self-confirming story that the day was off, which made recovery less likely.",
      });
    }

    return causes.slice(0, 3);
  },

  buildBehaviorPatches(features) {
    const patches = [];

    patches.push({
      title: "Lock the first 30 minutes",
      detail:
        "Tomorrow, keep your phone physically out of reach until you have water, food, and a written first task. The goal is to prevent passive inputs before active intent.",
    });

    if (features.contextSwitching || features.urgency) {
      patches.push({
        title: "Run one visible work lane",
        detail:
          "Pick a single assignment block for 45 minutes, close all non-task tabs, and keep a scrap note for urges instead of switching tasks mid-block.",
      });
    } else {
      patches.push({
        title: "Pre-commit the hardest task",
        detail:
          "Name the one task that would make the day feel recovered if finished by noon, and start there before any smaller maintenance work.",
      });
    }

    patches.push({
      title: "Install an energy checkpoint",
      detail:
        "Set one midday check: eat something real, step away for ten minutes, and ask whether the problem is workload, low fuel, or distraction before forcing more effort.",
    });

    return patches.slice(0, 3);
  },

  buildSummary(features, severity) {
    if (features.phoneDrift && features.contextSwitching) {
      return `The day likely failed at the transition from intention to execution: attention got fragmented early, then everything after that cost too much effort. Severity ${severity}/100.`;
    }

    if (features.nutritionDebt && features.stress) {
      return `This looks less like laziness and more like depletion: low physical support made the afternoon collapse feel sharper than the workload alone would explain. Severity ${severity}/100.`;
    }

    return `The main pattern was unstable focus under rising strain, which turned normal work into a cascade of friction by mid to late day. Severity ${severity}/100.`;
  },

  buildTrend(rootCauses, history) {
    if (!history.length) {
      return {
        title: "No trend yet",
        body: "One report is enough for diagnosis, but not enough to tell whether the same breakdown repeats across days.",
      };
    }

    const currentPrimary = rootCauses[0].title;
    const repeatCount = history.filter(
      (item) => item.rootCauses && item.rootCauses[0] && item.rootCauses[0].title === currentPrimary
    ).length;

    if (repeatCount >= 2) {
      return {
        title: "Repeat pattern detected",
        body: `The top failure mode has appeared ${repeatCount + 1} times including today. This suggests a system issue, not a one-off bad day.`,
      };
    }

    return {
      title: "Pattern still forming",
      body: "Today shares some friction with earlier reports, but the app does not yet see a dominant repeating cause.",
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
};

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

function renderAnalysis(report) {
  elements.emptyState.classList.add("hidden");
  elements.resultsView.classList.remove("hidden");
  elements.analysisStamp.textContent = `Analyzed ${formatDate(report.createdAt)}`;
  elements.autopsySummary.textContent = report.summary;
  elements.severityScore.textContent = report.severity;
  elements.confidenceScore.textContent = `${Math.round(report.confidence * 100)}%`;
  elements.timeLeakCount.textContent = String(report.timeLeaks.length);
  elements.burnoutCount.textContent = String(report.burnoutSignals.length);
  elements.trendTitle.textContent = report.trend.title;
  elements.trendBody.textContent = report.trend.body;

  renderInsightList(elements.timeLeaks, report.timeLeaks);
  renderInsightList(elements.burnoutSignals, report.burnoutSignals);
  renderInsightList(elements.rootCauses, report.rootCauses);
  renderInsightList(elements.behaviorPatches, report.behaviorPatches);
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
            <span>Severity ${item.severity}</span>
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
  const report = analyzer.analyze(trimmed, history);
  const updatedHistory = [...history, report].slice(-12);
  saveHistory(updatedHistory);
  renderAnalysis(report);
  renderHistory(updatedHistory);
}

function loadSample(index = 0) {
  elements.dayLog.value = sampleLogs[index].text;
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

elements.analyzeBtn.addEventListener("click", () => runAnalysis(elements.dayLog.value));
elements.clearBtn.addEventListener("click", () => {
  elements.dayLog.value = "";
  elements.dayLog.focus();
});
elements.loadSampleBtn.addEventListener("click", () => loadSample(0));
elements.clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory([]);
});
elements.dayLog.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    runAnalysis(elements.dayLog.value);
  }
});

renderSamples();
renderHistory(loadHistory());

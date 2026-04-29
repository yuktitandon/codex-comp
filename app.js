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
    highStart: "08:00",
    highEnd: "12:00",
    lowStart: "15:00",
    lowEnd: "17:00",
    schedule: "Class 10 AM to 12 PM, library from 2 PM, gym at 6 PM",
    priorities: "Finish quiz review, submit lab draft, read chapter notes",
    tasks: [
      { title: "Finish quiz review", duration: 90 },
      { title: "Submit lab draft", duration: 75 },
      { title: "Read chapter notes", duration: 45 },
    ],
  },
  {
    label: "Context-Switch Spiral",
    text:
      "I started three tasks before finishing one, kept replying to Slack right away, had six tabs open for one assignment, skipped lunch because I thought I was behind, and spent the evening staring at work without getting traction.",
    wake: "06:50",
    end: "23:00",
    highStart: "08:30",
    highEnd: "11:30",
    lowStart: "16:00",
    lowEnd: "18:00",
    schedule: "Work block before 9, team sync at 11, client edits due by 5",
    priorities: "Complete client revision, send invoice, draft presentation outline",
    tasks: [
      { title: "Complete client revision", duration: 120 },
      { title: "Send invoice", duration: 25 },
      { title: "Draft presentation outline", duration: 60 },
    ],
  },
  {
    label: "Silent Burnout",
    text:
      "I got through the whole day technically working, but everything felt heavy. I procrastinated starting hard work, drank too much coffee, had no real break, made tiny mistakes in things I normally do well, and crashed after dinner.",
    wake: "07:45",
    end: "22:00",
    highStart: "09:00",
    highEnd: "12:30",
    lowStart: "15:30",
    lowEnd: "17:30",
    schedule: "Morning meetings, project block 1 to 4, dinner at 7",
    priorities: "Finish proposal deck, review hiring notes, clear inbox backlog",
    tasks: [
      { title: "Finish proposal deck", duration: 100 },
      { title: "Review hiring notes", duration: 40 },
      { title: "Clear inbox backlog", duration: 30 },
    ],
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

  extractTimes(text) {
    const matches = [...text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi)];
    return matches
      .map((match) => ({
        raw: match[0],
        minutes: this.parseTimeToken(match[0]),
        index: match.index || 0,
      }))
      .filter((item) => item.minutes !== null)
      .sort((a, b) => a.index - b.index);
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
    return this.splitList(scheduleText).map((label) => {
      const range =
        label.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i) ||
        label.match(/from\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

      if (range) {
        const hint = /pm/i.test(range[1]) || /pm/i.test(range[2]) ? "pm" : /am/i.test(range[1]) || /am/i.test(range[2]) ? "am" : null;
        const start = this.parseTimeToken(range[1], hint);
        const end = this.parseTimeToken(range[2], hint);
        if (start !== null && end !== null && end > start) {
          return { label, start, end, originalStart: start, originalEnd: end };
        }
      }

      const single = label.match(/(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (single) {
        const start = this.parseTimeToken(single[1]);
        if (start !== null) {
          return { label, start, end: Math.min(start + 60, endMinutes), originalStart: start, originalEnd: Math.min(start + 60, endMinutes) };
        }
      }

      return null;
    }).filter(Boolean).sort((a, b) => a.start - b.start);
  },

  validateCommitments(commitments, wakeMinutes, endMinutes) {
    const conflicts = [];
    const usableCommitments = [];

    commitments.forEach((item) => {
      let invalid = false;
      if (item.originalStart < wakeMinutes) {
        conflicts.push({
          title: `${item.label} starts before your wake time`,
          detail: `You set wake-up for ${this.minutesToClock(wakeMinutes)}, but this starts at ${this.minutesToClock(item.originalStart)}. Do you want to wake earlier or rearrange this commitment?`,
        });
        invalid = true;
      }
      if (item.originalEnd > endMinutes) {
        conflicts.push({
          title: `${item.label} runs past your day end`,
          detail: `You set day end for ${this.minutesToClock(endMinutes)}, but this commitment reaches ${this.minutesToClock(item.originalEnd)}. Rearranging this will make the plan more accurate.`,
        });
        invalid = true;
      }
      if (!invalid) {
        usableCommitments.push(item);
      }
    });

    usableCommitments.sort((a, b) => a.start - b.start);

    for (let index = 0; index < usableCommitments.length - 1; index += 1) {
      const current = usableCommitments[index];
      const next = usableCommitments[index + 1];
      if (current.end > next.start) {
        conflicts.push({
          title: `${current.label} overlaps with ${next.label}`,
          detail: `${this.minutesToClock(current.start)}-${this.minutesToClock(current.end)} clashes with ${this.minutesToClock(next.start)}-${this.minutesToClock(next.end)}. Do you want to rearrange one of these commitments?`,
        });
      }
    }

    const nonOverlapping = usableCommitments.filter((item, index) => {
      const previous = usableCommitments[index - 1];
      return !previous || previous.end <= item.start;
    });

    return { usableCommitments: nonOverlapping, conflicts };
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

  clampToWindow(start, duration, windows) {
    for (const window of windows) {
      const adjustedStart = Math.max(start, window.start);
      if (adjustedStart + duration <= window.end) {
        return { start: adjustedStart, end: adjustedStart + duration };
      }
    }
    const fallback = windows[windows.length - 1] || { start, end: start + duration };
    const safeStart = Math.max(fallback.start, fallback.end - duration);
    return { start: safeStart, end: safeStart + duration };
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
    const extractedTimes = this.extractTimes(normalized);
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

    const dominantSignals = [
      features.phoneDrift > 0 ? "early phone drift" : null,
      features.lateStart > 0 ? "a compressed late start" : null,
      features.contextSwitching > 0 ? "constant task switching" : null,
      features.planningDebt > 0 ? "weak day structure" : null,
      features.nutritionDebt > 0 ? "low energy support" : null,
      features.avoidance > 0 ? "avoidance of the hardest task" : null,
      features.stress > 0 ? "rising overload signals" : null,
    ].filter(Boolean);

    const dominantSummary = dominantSignals.slice(0, 2).join(" plus ");
    const focusMinutes = Math.max(45, Math.round((endMinutes - wakeMinutes) * 0.42 - scrollCost * 0.9 - planningDebt * 0.55));
    const wastedMinutes = Math.max(35, Math.round(scrollCost * 1.8 + planningDebt * 1.2 + energyStrain * 0.9));
    const explicitWake = extractedTimes[0]?.minutes || wakeMinutes;

    const timeline = [
      {
        time: explicitWake,
        title: `${this.minutesToClock(explicitWake)} | Day begins`,
        detail: features.lateStart > 0
          ? "Wake-up happened later than ideal, immediately shrinking recovery and planning margin."
          : "The day opened with a clean chance to set direction.",
      },
      features.phoneDrift > 0
        ? {
            time: explicitWake + 15,
            title: `${this.minutesToClock(explicitWake + 15)} | Phone usage begins`,
            detail: "Critical divergence: passive input likely displaced setup and early intention.",
          }
        : null,
      {
        time: firstFailureMinute,
        title: `${this.minutesToClock(firstFailureMinute)} | First meaningful break point`,
        detail:
          features.phoneDrift > 0
            ? "Early phone drift changed the trajectory before the day had structure."
            : features.avoidance > 0
              ? "The hardest task was delayed, creating drag that spread through the day."
              : "The day likely shifted from directed to reactive here.",
      },
      features.planningDebt > 0
        ? {
            time: firstFailureMinute + 35,
            title: `${this.minutesToClock(firstFailureMinute + 35)} | Planning skipped or weakened`,
            detail: "The next steps had to be re-decided repeatedly instead of already being clear.",
          }
        : null,
      features.contextSwitching > 0
        ? {
            time: firstFailureMinute + 80,
            title: `${this.minutesToClock(firstFailureMinute + 80)} | Task switching begins`,
            detail: "Attention started fragmenting across tabs, tasks, or channels.",
          }
        : null,
      {
        time: endMinutes - 150,
        title: `${this.minutesToClock(endMinutes - 150)} | Energy drop becomes visible`,
        detail: "Late-day fatigue or overload likely made simple work feel heavier than it should have.",
      },
    ].filter(Boolean).sort((a, b) => a.time - b.time).map(({ title, detail }) => ({ title, detail }));

    const wentWell = [
      !features.lateStart
        ? {
            title: "The day had a usable opening window",
            detail: "There was at least some early capacity to build structure before drift took over.",
          }
        : null,
      planInput.schedule
        ? {
            title: "There were fixed anchors in the day",
            detail: "Existing commitments gave the day some structure to build around.",
          }
        : null,
      focusMinutes > wastedMinutes
        ? {
            title: "You still preserved some real focus time",
            detail: `Estimated focused work: about ${focusMinutes} minutes, which means the day was not a total loss.`,
          }
        : {
            title: "You kept the day moving despite friction",
            detail: "Even with drag and overload, the day still had usable blocks that can be recovered better tomorrow.",
          },
    ].filter(Boolean);

    const didntGo = [
      {
        title: `Focus time vs wasted time`,
        detail: `Estimated focused work: ${focusMinutes} min. Estimated wasted or low-value time: ${wastedMinutes} min. A cleaner day would have protected the first focused block before low-value drift started.`,
      },
      {
        title: `Critical divergence at ${this.minutesToClock(firstFailureMinute)}`,
        detail:
          features.phoneDrift > 0
            ? "Phone use took over before the day had a plan. What should have happened instead: the first task should have been decided before any scrolling."
            : features.avoidance > 0
              ? "The hardest task was delayed until the day lost momentum. What should have happened instead: start with the hardest task while energy was still clean."
              : "Direction weakened early, which made the rest of the day reactive. What should have happened instead: the next block should have been pre-decided.",
      },
      {
        title: "Execution degraded as the day progressed",
        detail: "Planning debt, switching, or energy strain kept compounding instead of being reset. What should have happened instead: one reset should have interrupted the slide before the afternoon got heavier.",
      },
    ];

    const changeTomorrow = [
      {
        title: "Protect the first 30 minutes",
        detail: "Use that window for food, water, and deciding the first task before anything reactive enters the day.",
      },
      {
        title: "Pre-decide the first work lane",
        detail: "Start the day already knowing what the first meaningful block is, so the day does not begin with choice friction.",
      },
      {
        title: "Insert one reset before the afternoon",
        detail: "Use a deliberate midday pause to stop morning chaos from spilling into the rest of the day.",
        },
    ];

    const avoidTomorrow = [
      features.phoneDrift > 0
        ? {
            title: "Do not open your phone before your day has a first task",
            detail: "What to do instead: decide the first task, drink water, and get oriented before any scrolling starts.",
          }
        : null,
      features.lateStart > 0
        ? {
            title: "Do not let the day begin late and unplanned",
            detail: "What to do instead: set a realistic wake time tonight and define the first block before sleeping.",
          }
        : null,
      features.contextSwitching > 0
        ? {
            title: "Do not bounce between tabs, tasks, or channels",
            detail: "What to do instead: finish one clear block before switching to the next task.",
          }
        : null,
      features.nutritionDebt > 0 || features.fatigue > 0
        ? {
            title: "Do not treat low energy like a discipline problem",
            detail: "What to do instead: eat earlier, take one real break, and stop trying to brute-force tired work.",
          }
        : null,
      !features.phoneDrift && !features.lateStart && !features.contextSwitching && !features.nutritionDebt && !features.fatigue
        ? {
            title: "Do not start the day reactively",
            detail: "What to do instead: keep the first hour simple, pre-decide one priority, and protect it.",
          }
        : null,
    ].filter(Boolean).slice(0, 3);

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
          ? `The day likely broke at the transition from intention to execution: ${dominantSummary || "the first hour drifted"}, then the rest of the day fractured.`
          : features.lateStart > 0 && features.planningDebt > 0
            ? `The day appears to have started behind and stayed reactive: ${dominantSummary || "a compressed start plus weak planning"} kept forcing catch-up decisions.`
            : features.avoidance > 0
              ? `The day seems to have broken when hard work was delayed: ${dominantSummary || "avoidance let low-value tasks fill the schedule"} and stress grew faster than progress.`
          : `The main pattern was ${dominantSummary || "unstable focus under rising strain"}, which turned normal work into a cascade of friction by mid to late day.`,
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
      analytics: { focusMinutes, wastedMinutes },
      wentWell,
      didntGo,
      changeTomorrow,
      avoidTomorrow,
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
      timeline,
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
    const normalizedEndMinutes = endMinutes <= wakeMinutes ? wakeMinutes + 60 : endMinutes;
    const usableMinutes = Math.max(540, normalizedEndMinutes - wakeMinutes);
    const parsedCommitments = this.parseCommitments(planInput.schedule, wakeMinutes, normalizedEndMinutes);
    const { usableCommitments: commitments, conflicts } = this.validateCommitments(parsedCommitments, wakeMinutes, normalizedEndMinutes);
    if (endMinutes <= wakeMinutes) {
      conflicts.unshift({
        title: "Day end is earlier than wake-up",
        detail: `You set wake-up for ${this.minutesToClock(wakeMinutes)} and day end for ${this.minutesToClock(endMinutes)}. Please correct that timing before trusting the schedule.`,
      });
    }
    const openWindows = this.buildOpenWindows(commitments, wakeMinutes, normalizedEndMinutes);
    const bestWindow = [...openWindows].sort((a, b) => (b.end - b.start) - (a.end - a.start))[0] || {
      start: wakeMinutes + 45,
      end: wakeMinutes + 135,
    };
    const deepWorkStart = bestWindow.start;
    const middayReset = Math.min(normalizedEndMinutes - 180, wakeMinutes + 300);
    const shutdown = Math.max(wakeMinutes + 720, normalizedEndMinutes - 45);
    const focusHours = Math.max(2.5, Math.min(7.5, (usableMinutes - 240) / 60));
    const priorities = this.splitList(planInput.priorities);
    const scheduleItems = commitments.length ? commitments.map((item) => item.label) : this.splitList(planInput.schedule);
    const tasks = planInput.tasks.filter((task) => task.title && task.duration > 0);
    const totalTaskMinutes = tasks.reduce((sum, task) => sum + task.duration, 0);
    const totalOpenMinutes = openWindows.reduce((sum, window) => sum + (window.end - window.start), 0);
    if ((tasks.length || priorities.length) && totalOpenMinutes < 30) {
      conflicts.push({
        title: "Almost no workable open time remains",
        detail: "Your commitments leave almost no usable planning space. Rearranging one block or reducing the task load will make the schedule more realistic.",
      });
    }
    if (tasks.length && totalOpenMinutes > 0 && totalTaskMinutes > totalOpenMinutes) {
      conflicts.push({
        title: "Task load exceeds your open time",
        detail: `You entered ${totalTaskMinutes} minutes of task work, but only about ${totalOpenMinutes} open minutes fit around your commitments. Do you want to rearrange, shorten, or move some tasks?`,
      });
    }
    const planQuality = Math.min(
      96,
      Math.max(24, 40 + priorities.length * 7 + scheduleItems.length * 6 + tasks.length * 5 + (focusHours - 2) * 4 + (openWindows.length > 1 ? 6 : 0) - conflicts.length * 12)
    );
    const highEnergyWindow = planInput.useEnergyHours
      ? {
          start: this.timeToMinutes(planInput.highEnergyStart || "08:00"),
          end: this.timeToMinutes(planInput.highEnergyEnd || "12:00"),
        }
      : null;
    const lowEnergyWindow = planInput.useEnergyHours
      ? {
          start: this.timeToMinutes(planInput.lowEnergyStart || "15:00"),
          end: this.timeToMinutes(planInput.lowEnergyEnd || "17:30"),
        }
      : null;
    const availableWindows = openWindows.length ? openWindows : [{ start: wakeMinutes + 30, end: normalizedEndMinutes - 30 }];

    const scheduledTasks = tasks
      .slice()
      .map((task, index) => {
        const preferredStart =
          index === 0 && highEnergyWindow
            ? highEnergyWindow.start
            : index >= Math.max(1, tasks.length - 1) && lowEnergyWindow
              ? lowEnergyWindow.start
              : availableWindows[Math.min(index, availableWindows.length - 1)].start;
        const slot = this.clampToWindow(preferredStart, task.duration, availableWindows);
        return {
          id: `${task.title}-${index}-${slot.start}`,
          title: task.title,
          start: slot.start,
          end: slot.end,
        };
      })
      .sort((a, b) => a.start - b.start);

    const planningPool = tasks.length ? tasks : priorities.map((title) => ({ title, duration: 60 }));
    const allocatedPriorityPlan = planningPool.length
      ? planningPool.slice(0, 4).map((task, index) => {
          const window = scheduledTasks[index]
            ? { start: scheduledTasks[index].start, end: scheduledTasks[index].end }
            : openWindows[Math.min(index, Math.max(0, openWindows.length - 1))] || bestWindow;
          return {
            title: `Priority ${index + 1} | ${task.title}`,
            detail:
              index === 0
                ? `Place this in ${this.minutesToClock(window.start)} to ${this.minutesToClock(Math.min(window.start + 90, window.end))}, your strongest open block.`
                : index === 1
                  ? `Move this into ${this.minutesToClock(window.start)} to ${this.minutesToClock(Math.min(window.start + 75, window.end))} after the main block or after a reset.`
                  : `Batch this into a later lighter window such as ${this.minutesToClock(window.start)} onward so it does not contaminate the first deep block.`,
          };
        })
      : null;

    const orderedSchedule = [
      {
        title: `${planInput.wakeTime || "07:30"} | Wake, fuel, and orient`,
        detail: "Use the first 30 minutes for water, food, and deciding the first priority. Do not let messages or scrolling occupy this slot.",
        start: wakeMinutes,
      },
      {
        title: `${this.minutesToClock(deepWorkStart)} | Primary deep-work block`,
        detail: priorities.length
          ? `Start with ${priorities[0]}. This should be the cleanest cognitive block of the day.`
          : "Reserve this block for the hardest task before lower-value noise enters the day.",
        start: deepWorkStart,
      },
      ...scheduledTasks.map((task) => ({
        title: `${this.minutesToClock(task.start)}-${this.minutesToClock(task.end)} | ${task.title}`,
        detail: "Placed into the cleanest available slot based on your timing, priorities, and open windows.",
        start: task.start,
      })),
      ...commitments.slice(0, 3).map((item) => ({
        title: `${this.minutesToClock(item.start)}-${this.minutesToClock(item.end)} | Fixed commitment`,
        detail: item.label,
        start: item.start,
      })),
      {
        title: `${this.minutesToClock(middayReset)} | Midday reset`,
        detail: "Break, eat, and decide the next work lane deliberately. This prevents the afternoon from becoming reactive.",
        start: middayReset,
      },
      {
        title: `${this.minutesToClock(shutdown)} | Shutdown window`,
        detail: "Close loops, list carryover tasks, and decide tomorrow’s first move before ending the day.",
        start: shutdown,
      },
    ].sort((a, b) => a.start - b.start).map(({ title, detail }) => ({ title, detail }));

    const plannerSummaryBits = [
      priorities[0] ? `start with ${priorities[0]}` : null,
      commitments.length ? `route work around ${commitments.length} fixed commitment${commitments.length === 1 ? "" : "s"}` : "protect your first clean work window",
      priorities.length > 2 ? `avoid overloading ${priorities.length} priorities into the same energy band` : null,
      conflicts.length ? `resolve ${conflicts.length} schedule conflict${conflicts.length === 1 ? "" : "s"} before trusting this plan` : null,
    ].filter(Boolean);

    return {
      id: createId(),
      type: "planner",
      createdAt: new Date().toISOString(),
      planner: planInput,
      summary:
        conflicts.length
          ? `Your schedule has conflicting inputs, so the first job is to correct those before optimizing tomorrow: ${plannerSummaryBits.join(", ")}.`
          : priorities.length > 0
          ? `Tomorrow should be structured around what matters most: ${plannerSummaryBits.join(", ")}.`
          : commitments.length
            ? "Tomorrow already has structure from fixed commitments, so the goal is to add 2 to 4 priorities and place them into the open windows between them."
            : "Tomorrow needs stronger structure first: set 2 to 4 priorities, protect the first hour, and use clean time blocks instead of improvising the day.",
      planQuality,
      focusHours,
      bestStartWindow: this.minutesToClock(deepWorkStart),
      bestStartWhy:
        conflicts.length
          ? "This is the cleanest remaining slot, but the overall plan still needs conflict resolution before it becomes reliable."
          : commitments.length
          ? "This is the largest open window after accounting for your fixed commitments, so it is the best place to protect serious work."
          : "This is the earliest clean slot after waking where cognitive energy is still high and the day has not yet been fragmented.",
      shutdownTime: this.minutesToClock(shutdown),
      suggestedSchedule: orderedSchedule,
      editableSchedule: scheduledTasks,
      scheduleConflicts: conflicts.length
        ? conflicts
        : [
            {
              title: "No timing clashes detected",
              detail: "Your wake time, commitments, and task durations fit together without obvious collisions.",
            },
          ],
      priorityPlan: priorities.length
        ? allocatedPriorityPlan
        : [
            {
              title: "No priorities entered",
              detail: "Add task blocks or 2 to 4 concrete priorities so the planner can schedule a tighter day.",
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
          detail: planInput.useEnergyHours
            ? "The planner uses the energy hours you gave it, routes around fixed commitments, keeps the schedule in time order, and flags input mistakes before building the day."
            : "The planner keeps the schedule in time order, routes around fixed commitments, and builds the day from realistic open windows even if you skip energy-hour inputs.",
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
  historyChart: document.getElementById("historyChart"),
  progressPanel: document.getElementById("progressPanel"),
  toggleProgressBtn: document.getElementById("toggleProgressBtn"),
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
  toggleEnergyBtn: document.getElementById("toggleEnergyBtn"),
  energyHoursSection: document.getElementById("energyHoursSection"),
  highEnergyStart: document.getElementById("highEnergyStart"),
  highEnergyEnd: document.getElementById("highEnergyEnd"),
  lowEnergyStart: document.getElementById("lowEnergyStart"),
  lowEnergyEnd: document.getElementById("lowEnergyEnd"),
  taskDump: document.getElementById("taskDump"),
  resultsHeading: document.getElementById("resultsHeading"),
  analysisStamp: document.getElementById("analysisStamp"),
  autopsyResultsSection: document.getElementById("autopsyResultsSection"),
  plannerResultsSection: document.getElementById("plannerResultsSection"),
  autopsySummary: document.getElementById("autopsySummary"),
  failureMoment: document.getElementById("failureMoment"),
  failureWhy: document.getElementById("failureWhy"),
  wentWell: document.getElementById("wentWell"),
  didntGo: document.getElementById("didntGo"),
  changeTomorrow: document.getElementById("changeTomorrow"),
  avoidTomorrow: document.getElementById("avoidTomorrow"),
  plannerSummary: document.getElementById("plannerSummary"),
  bestStartWindow: document.getElementById("bestStartWindow"),
  bestStartWhy: document.getElementById("bestStartWhy"),
  schedulePlan: document.getElementById("schedulePlan"),
  priorityPlan: document.getElementById("priorityPlan"),
  scheduleConflicts: document.getElementById("scheduleConflicts"),
  efficiencyRules: document.getElementById("efficiencyRules"),
  plannerNotes: document.getElementById("plannerNotes"),
};

let activeMode = "autopsy";
let currentPlannerReport = null;

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
  const parsedTasks = analyzer
    .splitList(elements.taskDump.value.trim())
    .map((item) => {
      const durationMatch = item.match(/(\d+)\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i);
      const duration = durationMatch
        ? /h|hr|hrs|hour|hours/i.test(durationMatch[0])
          ? Number(durationMatch[1]) * 60
          : Number(durationMatch[1])
        : 60;
      const title = item
        .replace(/(\d+)\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i, "")
        .replace(/[-:]+/g, " ")
        .trim();
      return {
        title: title || item.trim(),
        duration,
      };
    })
    .filter((task) => task.title);

  return {
    wakeTime: elements.wakeTime.value,
    dayEndTime: elements.dayEndTime.value,
    schedule: elements.fixedSchedule.value.trim(),
    priorities: elements.priorities.value.trim(),
    useEnergyHours: !elements.energyHoursSection.classList.contains("hidden"),
    highEnergyStart: elements.highEnergyStart.value,
    highEnergyEnd: elements.highEnergyEnd.value,
    lowEnergyStart: elements.lowEnergyStart.value,
    lowEnergyEnd: elements.lowEnergyEnd.value,
    tasks: parsedTasks,
  };
}

function renderInsightList(container, items) {
  container.innerHTML = (items || [])
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

function renderAutopsy(report) {
  elements.resultsHeading.textContent = "Autopsy Report";
  elements.autopsyResultsSection.classList.remove("hidden");
  elements.plannerResultsSection.classList.add("hidden");
  elements.autopsySummary.textContent = report.summary;
  elements.failureMoment.textContent = report.failurePoint.moment;
  elements.failureWhy.textContent = report.failurePoint.why;
  renderInsightList(elements.wentWell, report.wentWell);
  renderInsightList(elements.didntGo, report.didntGo);
  renderInsightList(elements.changeTomorrow, report.changeTomorrow);
  renderInsightList(elements.avoidTomorrow, report.avoidTomorrow);
}

function renderPlanner(report) {
  currentPlannerReport = report;
  elements.resultsHeading.textContent = "Tomorrow Plan";
  elements.autopsyResultsSection.classList.add("hidden");
  elements.plannerResultsSection.classList.remove("hidden");
  elements.plannerSummary.textContent = report.summary;
  elements.bestStartWindow.textContent = report.bestStartWindow;
  elements.bestStartWhy.textContent = report.bestStartWhy;
  renderInsightList(elements.schedulePlan, report.suggestedSchedule);
  renderInsightList(elements.scheduleConflicts, report.scheduleConflicts);
  elements.priorityPlan.innerHTML = report.editableSchedule && report.editableSchedule.length
    ? report.editableSchedule
        .map(
          (task, index) => `
            <div class="schedule-row" data-schedule-index="${index}">
              <label>
                <span>Start</span>
                <input type="time" class="schedule-start" value="${String(Math.floor(task.start / 60)).padStart(2, "0")}:${String(task.start % 60).padStart(2, "0")}" />
              </label>
              <label>
                <span>End</span>
                <input type="time" class="schedule-end" value="${String(Math.floor(task.end / 60)).padStart(2, "0")}:${String(task.end % 60).padStart(2, "0")}" />
              </label>
              <label>
                <span>Task</span>
                <input type="text" class="schedule-title" value="${task.title}" />
              </label>
              <div class="schedule-controls">
                <button type="button" class="small-button shift-earlier">-15m</button>
                <button type="button" class="small-button shift-later">+15m</button>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="insight-item"><strong>No task blocks yet</strong><p>Add tasks in planner mode to get a fully scheduled, editable day.</p></div>`;
  bindScheduleAdjustments();
  renderInsightList(elements.efficiencyRules, report.efficiencyRules);
  renderInsightList(elements.plannerNotes, report.notes);
}

function bindScheduleAdjustments() {
  document.querySelectorAll(".schedule-row").forEach((row) => {
    const index = Number(row.dataset.scheduleIndex);
    const startInput = row.querySelector(".schedule-start");
    const endInput = row.querySelector(".schedule-end");
    const titleInput = row.querySelector(".schedule-title");
    const applyInputs = () => {
      const [sh, sm] = startInput.value.split(":").map(Number);
      const [eh, em] = endInput.value.split(":").map(Number);
      currentPlannerReport.editableSchedule[index].start = sh * 60 + sm;
      currentPlannerReport.editableSchedule[index].end = eh * 60 + em;
      currentPlannerReport.editableSchedule[index].title = titleInput.value;
    };
    startInput.addEventListener("change", applyInputs);
    endInput.addEventListener("change", applyInputs);
    titleInput.addEventListener("input", applyInputs);
    row.querySelector(".shift-earlier").addEventListener("click", () => {
      currentPlannerReport.editableSchedule[index].start -= 15;
      currentPlannerReport.editableSchedule[index].end -= 15;
      renderPlanner(currentPlannerReport);
    });
    row.querySelector(".shift-later").addEventListener("click", () => {
      currentPlannerReport.editableSchedule[index].start += 15;
      currentPlannerReport.editableSchedule[index].end += 15;
      renderPlanner(currentPlannerReport);
    });
  });
}

function renderReport(report) {
  elements.analysisStamp.textContent = `Analyzed ${formatDate(report.createdAt)}`;
  if (report.type === "planner") renderPlanner(report);
  else renderAutopsy(report);
}

function renderHistory(history) {
  elements.toggleProgressBtn.textContent = history.length ? "Show Progress" : "No Progress Yet";
}

function renderHistoryChart(history) {
  if (!history.length) {
    elements.historyChart.innerHTML = `<div class="chart-empty">No chart yet. Run a few analyses to build a 2-week view.</div>`;
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

}

function runAnalysis() {
  const history = loadHistory();
  let report;

  if (activeMode === "planner") {
    const input = plannerInput();
    if (!input.schedule && !input.priorities && !input.tasks.length) {
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
  elements.energyHoursSection.classList.remove("hidden");
  elements.toggleEnergyBtn.textContent = "Hide Energy Hours";
  elements.highEnergyStart.value = sample.highStart;
  elements.highEnergyEnd.value = sample.highEnd;
  elements.lowEnergyStart.value = sample.lowStart;
  elements.lowEnergyEnd.value = sample.lowEnd;
  elements.fixedSchedule.value = sample.schedule;
  elements.priorities.value = sample.priorities;
  elements.taskDump.value = sample.tasks.map((task) => `${task.title} ${task.duration} min`).join(", ");
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
  elements.taskDump.value = "";
  elements.energyHoursSection.classList.add("hidden");
  elements.toggleEnergyBtn.textContent = "Yes, add them";
  elements.highEnergyStart.value = "08:00";
  elements.highEnergyEnd.value = "12:00";
  elements.lowEnergyStart.value = "15:00";
  elements.lowEnergyEnd.value = "17:30";
  elements.wakeTime.value = "07:30";
  elements.dayEndTime.value = "22:30";
});
elements.toggleEnergyBtn.addEventListener("click", () => {
  const shouldHide = !elements.energyHoursSection.classList.contains("hidden");
  elements.energyHoursSection.classList.toggle("hidden", shouldHide);
  elements.toggleEnergyBtn.textContent = shouldHide ? "Yes, add them" : "Hide Energy Hours";
});
elements.loadSampleBtn.addEventListener("click", () => loadSample(0));
elements.toggleProgressBtn.addEventListener("click", () => {
  const shouldShow = elements.progressPanel.classList.contains("hidden");
  elements.progressPanel.classList.toggle("hidden", !shouldShow);
  elements.toggleProgressBtn.textContent = shouldShow ? "Hide Progress" : "Show Progress";
});
elements.clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory([]);
  renderHistoryChart([]);
  elements.progressPanel.classList.add("hidden");
  elements.toggleProgressBtn.textContent = "No Progress Yet";
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

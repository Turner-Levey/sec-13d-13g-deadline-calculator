(function () {
  "use strict";

  const scenarios = {
    "13d-initial": {
      label: "Schedule 13D initial - more than 5%",
      schedule: "Schedule 13D",
      base: "trigger date",
      method: "business-after-date",
      count: 5,
      sourceNote: "Initial Schedule 13D deadline: within five business days after acquiring beneficial ownership of more than five percent of a covered class."
    },
    "13d-amendment": {
      label: "Schedule 13D material amendment",
      schedule: "Schedule 13D/A",
      base: "trigger date",
      method: "business-after-date",
      count: 2,
      sourceNote: "Schedule 13D amendment deadline: within two business days after the date of a material change."
    },
    "13g-qii-exempt-quarter": {
      label: "Schedule 13G QII / exempt investor initial - quarter end",
      schedule: "Schedule 13G",
      base: "calendar quarter end",
      method: "calendar-after-period",
      count: 45,
      sourceNote: "QII and exempt-investor initial Schedule 13G scenario: within 45 calendar days after the end of the calendar quarter in which beneficial ownership first exceeds five percent, subject to category-specific rules."
    },
    "13g-qii-initial-10": {
      label: "Schedule 13G QII initial - more than 10% month end",
      schedule: "Schedule 13G",
      base: "calendar month end",
      method: "business-after-period",
      count: 5,
      sourceNote: "QII accelerated initial Schedule 13G scenario: within five business days after the end of the first month in which beneficial ownership exceeds 10 percent, computed as of the last day of the month."
    },
    "13g-passive-initial": {
      label: "Schedule 13G passive investor initial - more than 5%",
      schedule: "Schedule 13G",
      base: "trigger date",
      method: "business-after-date",
      count: 5,
      sourceNote: "Passive-investor initial Schedule 13G scenario: within five business days after acquiring beneficial ownership of more than five percent of a covered class."
    },
    "13g-quarter-amendment": {
      label: "Schedule 13G material-change amendment - quarter end",
      schedule: "Schedule 13G/A",
      base: "calendar quarter end",
      method: "calendar-after-period",
      count: 45,
      sourceNote: "General Schedule 13G amendment scenario: within 45 calendar days after the end of the calendar quarter in which a material change occurred, subject to category-specific accelerated amendment rules."
    },
    "13g-qii-10-amendment": {
      label: "Schedule 13G QII amendment - more than 10% or 5% change",
      schedule: "Schedule 13G/A",
      base: "calendar month end",
      method: "business-after-period",
      count: 5,
      sourceNote: "QII accelerated Schedule 13G amendment scenario: within five business days after the end of the first month in which ownership exceeds 10 percent or later changes by more than five percent."
    },
    "13g-passive-10-amendment": {
      label: "Schedule 13G passive amendment - more than 10% or 5% change",
      schedule: "Schedule 13G/A",
      base: "trigger date",
      method: "business-after-date",
      count: 2,
      sourceNote: "Passive-investor accelerated Schedule 13G amendment scenario: within two business days after acquiring greater than 10 percent, and thereafter within two business days after a more-than-five-percent change."
    }
  };

  const today = new Date();
  const form = document.querySelector("#deadline-form");
  const results = document.querySelector("#results");
  const output = document.querySelector("#memo-output");
  const fields = {
    filer: document.querySelector("#filer"),
    issuer: document.querySelector("#issuer"),
    ticker: document.querySelector("#ticker"),
    scenario: document.querySelector("#scenario"),
    triggerDate: document.querySelector("#trigger-date"),
    actualFilingDate: document.querySelector("#actual-filing-date"),
    ownershipContext: document.querySelector("#ownership-context"),
    edgarStatus: document.querySelector("#edgar-status"),
    closureDates: document.querySelector("#closure-dates"),
    sourceUrl: document.querySelector("#source-url"),
    nextStep: document.querySelector("#next-step")
  };

  const toIsoDate = (date) => date.toISOString().slice(0, 10);
  fields.triggerDate.value = toIsoDate(today);

  function getValue(key) {
    return fields[key].value.trim();
  }

  function parseIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addCalendarDays(date, days) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  function endOfMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12));
  }

  function endOfQuarter(date) {
    const quarterEndMonth = Math.floor(date.getUTCMonth() / 3) * 3 + 2;
    return new Date(Date.UTC(date.getUTCFullYear(), quarterEndMonth + 1, 0, 12));
  }

  function observedDate(year, monthIndex, day) {
    const date = new Date(Date.UTC(year, monthIndex, day, 12));
    const weekday = date.getUTCDay();
    if (weekday === 0) return addCalendarDays(date, 1);
    if (weekday === 6) return addCalendarDays(date, -1);
    return date;
  }

  function nthWeekday(year, monthIndex, weekday, occurrence) {
    const first = new Date(Date.UTC(year, monthIndex, 1, 12));
    const offset = (weekday - first.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(year, monthIndex, 1 + offset + (occurrence - 1) * 7, 12));
  }

  function lastWeekday(year, monthIndex, weekday) {
    const last = new Date(Date.UTC(year, monthIndex + 1, 0, 12));
    const offset = (last.getUTCDay() - weekday + 7) % 7;
    return addCalendarDays(last, -offset);
  }

  function standardFederalHolidaySet(year) {
    return new Set([
      observedDate(year, 0, 1),
      nthWeekday(year, 0, 1, 3),
      nthWeekday(year, 1, 1, 3),
      lastWeekday(year, 4, 1),
      observedDate(year, 5, 19),
      observedDate(year, 6, 4),
      nthWeekday(year, 8, 1, 1),
      nthWeekday(year, 9, 1, 2),
      observedDate(year, 10, 11),
      nthWeekday(year, 10, 4, 4),
      observedDate(year, 11, 25)
    ].map(toIsoDate));
  }

  function closureSetFor(anchorDate) {
    const years = [
      anchorDate.getUTCFullYear() - 1,
      anchorDate.getUTCFullYear(),
      anchorDate.getUTCFullYear() + 1
    ];
    const closures = new Set();
    years.forEach((year) => {
      standardFederalHolidaySet(year).forEach((date) => closures.add(date));
    });
    getValue("closureDates")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
      .forEach((date) => closures.add(date));
    return closures;
  }

  function isBusinessDay(date, closures) {
    const day = date.getUTCDay();
    return day !== 0 && day !== 6 && !closures.has(toIsoDate(date));
  }

  function nextBusinessDay(date, closures) {
    let next = new Date(date);
    while (!isBusinessDay(next, closures)) {
      next = addCalendarDays(next, 1);
    }
    return next;
  }

  function addBusinessDaysAfter(date, count, closures) {
    let cursor = addCalendarDays(date, 1);
    let counted = 0;
    while (counted < count) {
      if (isBusinessDay(cursor, closures)) {
        counted += 1;
      }
      if (counted < count) {
        cursor = addCalendarDays(cursor, 1);
      }
    }
    return cursor;
  }

  function baseDateFor(triggerDate, scenario) {
    if (scenario.base === "calendar month end") return endOfMonth(triggerDate);
    if (scenario.base === "calendar quarter end") return endOfQuarter(triggerDate);
    return triggerDate;
  }

  function dueDateFor(baseDate, scenario, closures) {
    if (scenario.method === "calendar-after-period") {
      return addCalendarDays(baseDate, scenario.count);
    }
    return addBusinessDaysAfter(baseDate, scenario.count, closures);
  }

  function daysBetween(from, to) {
    const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
    const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    return Math.round((end - start) / 86400000);
  }

  function formatDate(date) {
    return date ? toIsoDate(date) : "not entered";
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function edgarAction(statusValue, dueDate) {
    if (statusValue === "EDGAR access and filing agent confirmed") {
      return "EDGAR access and filing-agent readiness are marked confirmed; still verify signatures, exhibits, and final source facts before filing.";
    }
    if (statusValue === "EDGAR access exists, filing role not confirmed") {
      return `Confirm filing-agent role, access codes, signatures, and exhibit readiness before ${formatDate(dueDate)}.`;
    }
    if (statusValue === "No EDGAR access confirmed yet") {
      return `Start EDGAR and filing-agent readiness checks immediately; target completion before ${formatDate(dueDate)}.`;
    }
    return "Confirm EDGAR access, filing-agent role, access codes, signatures, and exhibit readiness before relying on the calculated target.";
  }

  function calculate() {
    const scenario = scenarios[getValue("scenario")];
    const triggerDate = parseIsoDate(getValue("triggerDate"));
    if (!scenario || !triggerDate) {
      throw new Error("Choose a scenario and enter a valid trigger date.");
    }
    const baseDate = baseDateFor(triggerDate, scenario);
    const closures = closureSetFor(baseDate);
    const rawDueDate = dueDateFor(baseDate, scenario, closures);
    const adjustedDueDate = nextBusinessDay(rawDueDate, closures);
    const actualFilingDate = parseIsoDate(getValue("actualFilingDate"));
    const todayDate = parseIsoDate(toIsoDate(today));
    const daysUntilDue = daysBetween(todayDate, adjustedDueDate);

    let statusLabel = "Open";
    if (actualFilingDate) {
      statusLabel = actualFilingDate <= adjustedDueDate ? "Filed by calculated target" : "Filed after calculated target";
    } else if (daysUntilDue < 0) {
      statusLabel = "Past calculated target";
    } else if (daysUntilDue <= 2) {
      statusLabel = "Urgent";
    } else if (daysUntilDue <= 7) {
      statusLabel = "Soon";
    }

    const warnings = [
      "This worksheet does not determine filer category, beneficial ownership, group status, control intent, exemptions, or filing obligation.",
      "Verify whether an accelerated Schedule 13G amendment rule overrides a general quarter-end amendment scenario.",
      "Daily filing cutoff reminder: verify current EDGAR and Regulation S-T requirements before relying on the 10 p.m. Eastern note."
    ];
    if (formatDate(rawDueDate) !== formatDate(adjustedDueDate)) {
      warnings.push("The raw due date moved to the next business day because of weekend or closure handling.");
    }
    if (!getValue("closureDates")) {
      warnings.push("Standard U.S. federal holidays are included; add emergency SEC closure dates manually when applicable.");
    }
    if (getValue("edgarStatus") !== "EDGAR access and filing agent confirmed") {
      warnings.push("EDGAR and filing-agent readiness are not marked fully confirmed.");
    }
    if (statusLabel.includes("Past") || statusLabel.includes("after")) {
      warnings.push("Review late-filing consequences, amendment obligations, and cure steps with counsel.");
    }

    return {
      filer: getValue("filer") || "Unnamed filer",
      issuer: getValue("issuer") || "Unnamed issuer",
      ticker: getValue("ticker") || "not entered",
      scenario,
      triggerDate,
      baseDate,
      rawDueDate,
      adjustedDueDate,
      actualFilingDate,
      statusLabel,
      daysUntilDue,
      ownershipContext: getValue("ownershipContext") || "No ownership context entered.",
      edgarNote: edgarAction(getValue("edgarStatus"), adjustedDueDate),
      sourceUrl: getValue("sourceUrl") || "not entered",
      nextStep: getValue("nextStep") || "Verify source facts with counsel.",
      warnings
    };
  }

  function renderResult(data) {
    const daysText = data.actualFilingDate
      ? `filed ${daysBetween(data.adjustedDueDate, data.actualFilingDate)} day(s) from target`
      : `${data.daysUntilDue} day(s) from today`;
    results.innerHTML = [
      `<div><span class="label">Status</span><strong>${data.statusLabel}</strong></div>`,
      `<div><span class="label">Target filing date</span><strong>${formatDate(data.adjustedDueDate)}</strong><small>${daysText}</small></div>`,
      `<div><span class="label">Base date used</span><strong>${formatDate(data.baseDate)}</strong><small>${data.scenario.base}</small></div>`,
      `<div><span class="label">Cutoff note</span><strong>10 p.m. ET</strong><small>verify current EDGAR rules</small></div>`
    ].join("");
  }

  function buildMemo(data) {
    return [
      "# Schedule 13D / 13G Deadline Planning Memo",
      "",
      `Filer or investor: ${data.filer}`,
      `Issuer: ${data.issuer}`,
      `Ticker / CIK: ${data.ticker}`,
      `Scenario: ${data.scenario.label}`,
      `Schedule label: ${data.scenario.schedule}`,
      `Ownership context: ${data.ownershipContext}`,
      `Trigger date entered: ${formatDate(data.triggerDate)}`,
      `Base date used: ${formatDate(data.baseDate)} (${data.scenario.base})`,
      `Raw calculated date: ${formatDate(data.rawDueDate)}`,
      `Adjusted target filing date: ${formatDate(data.adjustedDueDate)}`,
      "Daily filing cutoff note: SEC modernization materials discuss a 10 p.m. Eastern filing cutoff for Schedules 13D and 13G; verify current EDGAR and Regulation S-T requirements before relying on the output.",
      `Actual filing date: ${formatDate(data.actualFilingDate)}`,
      `Current status: ${data.statusLabel}`,
      `EDGAR readiness note: ${data.edgarNote}`,
      `Source URL: ${data.sourceUrl}`,
      `Next verification step: ${data.nextStep}`,
      "",
      `Source basis: ${data.scenario.sourceNote}`,
      "",
      "Warnings:",
      ...data.warnings.map((warning) => `- ${warning}`),
      "",
      "Official sources:",
      "- https://www.sec.gov/newsroom/press-releases/2023-219",
      "- https://www.sec.gov/files/33-11253-fact-sheet.pdf",
      "- https://www.sec.gov/files/rules/final/2023/33-11253.pdf",
      "- https://www.sec.gov/rules-regulations/staff-guidance/corporation-finance-interpretations/exchange-act-sections-13d-13g-regulation-13d-g-beneficial-ownership-reporting",
      "",
      "Disclosure: informational planning worksheet only; not legal advice, securities advice, investment advice, an EDGAR filing service, or an official SEC tool."
    ].join("\n");
  }

  function buildCsv(data) {
    const headers = [
      "filer",
      "issuer",
      "ticker_cik",
      "scenario",
      "schedule_label",
      "ownership_context",
      "trigger_date_entered",
      "base_date_used",
      "raw_calculated_date",
      "adjusted_target_filing_date",
      "actual_filing_date",
      "status",
      "filing_cutoff_note",
      "edgar_readiness_note",
      "source_url",
      "next_step"
    ];
    const row = [
      data.filer,
      data.issuer,
      data.ticker,
      data.scenario.label,
      data.scenario.schedule,
      data.ownershipContext,
      formatDate(data.triggerDate),
      formatDate(data.baseDate),
      formatDate(data.rawDueDate),
      formatDate(data.adjustedDueDate),
      formatDate(data.actualFilingDate),
      data.statusLabel,
      "Verify current 10 p.m. Eastern filing cutoff treatment for Schedules 13D and 13G.",
      data.edgarNote,
      data.sourceUrl,
      data.nextStep
    ];
    return `${headers.join(",")}\n${row.map(csvEscape).join(",")}\n`;
  }

  function setButtonCopied(button) {
    const original = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = original;
    }, 1200);
  }

  async function copyText(text, button) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      output.focus();
      output.select();
      document.execCommand("copy");
    }
    setButtonCopied(button);
  }

  function runCalculation() {
    try {
      const data = calculate();
      renderResult(data);
      output.value = buildMemo(data);
      return data;
    } catch (error) {
      results.innerHTML = `<div><span class="label">Input needed</span><strong>${error.message}</strong></div>`;
      output.value = "";
      throw error;
    }
  }

  function safeRunCalculation() {
    try {
      runCalculation();
    } catch {
      // The result band already shows the input issue.
    }
  }

  form.addEventListener("input", safeRunCalculation);
  form.addEventListener("change", safeRunCalculation);
  document.querySelector("#calculate").addEventListener("click", safeRunCalculation);
  document.querySelector("#copy-memo").addEventListener("click", (event) => {
    const data = output.value.trim() ? calculate() : runCalculation();
    copyText(output.value || buildMemo(data), event.currentTarget).catch(() => {});
  });
  document.querySelector("#copy-csv").addEventListener("click", (event) => {
    copyText(buildCsv(calculate()), event.currentTarget).catch(() => {});
  });
  document.querySelector("#download-csv").addEventListener("click", () => {
    const blob = new Blob([buildCsv(calculate())], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "schedule-13d-13g-deadline.csv";
    link.click();
    URL.revokeObjectURL(url);
  });

  runCalculation();
}());

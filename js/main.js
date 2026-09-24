/* Iron & Oak Barbershop: site scripts */

var SHOP = {
  name: "Iron & Oak Barbershop",
  address: "118 Ironworks Lane, Woodstock, Cape Town",
  phone: "+27 63 349 1759",
  phoneHref: "+27633491759",
  whatsappNumber: "27633491759",
  email: "hello@ironandoak.com",
  currency: "R"
};

/* Service catalogue shared by services.html and the booking form.
   Keys are also used as ?service= query values from "Book this" links.
   Prices are in South African Rand (ZAR). */
var SERVICES = {
  "classic-haircut": { name: "Classic Haircut", duration: 30, price: 220 },
  "skin-fade": { name: "Skin Fade", duration: 45, price: 260 },
  "buzz-cut": { name: "Buzz Cut", duration: 20, price: 150 },
  "beard-trim": { name: "Beard Trim & Shape", duration: 20, price: 120 },
  "hot-towel-shave": { name: "Hot Towel Shave", duration: 30, price: 230 },
  "line-up": { name: "Line Up", duration: 15, price: 90 },
  "kids-cut": { name: "Kids Cut (12 & under)", duration: 25, price: 140 },
  "full-package": { name: "The Full Package", duration: 75, price: 480 }
};

var BARBERS = ["Any available barber", "Marcus Reyes", "Devon Cole", "Sam Okafor"];

/* ---------- Mobile nav ---------- */
function initNav() {
  var toggle = document.querySelector("[data-nav-toggle]");
  var panel = document.querySelector("[data-nav-panel]");
  if (!toggle || !panel) return;
  toggle.addEventListener("click", function () {
    var isOpen = panel.classList.toggle("open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}

/* ---------- Promo popup ---------- */
function initPopup() {
  var overlay = document.querySelector("[data-popup]");
  if (!overlay) return;
  var alreadyShown = false;
  try {
    alreadyShown = sessionStorage.getItem("io_popup_shown") === "1";
  } catch (e) { /* storage unavailable, treat popup as not shown yet */ }

  if (!alreadyShown) {
    window.setTimeout(function () {
      overlay.classList.add("open");
      try { sessionStorage.setItem("io_popup_shown", "1"); } catch (e) {}
    }, 1800);
  }

  overlay.querySelectorAll("[data-popup-close]").forEach(function (el) {
    el.addEventListener("click", function () { overlay.classList.remove("open"); });
  });
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) overlay.classList.remove("open");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") overlay.classList.remove("open");
  });
}

/* ---------- Booking form ---------- */
function pad(n) { return n < 10 ? "0" + n : "" + n; }

/* Generates half-hour start times that let the chosen service finish
   before closing time, and returns [] for days the shop is closed. */
function getAvailableSlots(dateStr, durationMinutes) {
  if (!dateStr) return [];
  var parts = dateStr.split("-").map(Number);
  var d = new Date(parts[0], parts[1] - 1, parts[2]);
  var day = d.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0) return [];

  var openHour = 9;
  var closeHour = day === 6 ? 17 : 19;
  var slots = [];
  var cursor = openHour * 60;
  var closeMinutes = closeHour * 60;

  while (cursor + durationMinutes <= closeMinutes) {
    var h = Math.floor(cursor / 60);
    var m = cursor % 60;
    var label = ((h % 12) === 0 ? 12 : h % 12) + ":" + pad(m) + " " + (h < 12 ? "AM" : "PM");
    slots.push({ value: pad(h) + ":" + pad(m), label: label });
    cursor += 30;
  }
  return slots;
}

function buildGoogleCalendarUrl(details) {
  var fmt = function (dt) {
    return dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate()) + "T" +
      pad(dt.getHours()) + pad(dt.getMinutes()) + "00";
  };
  var params = new URLSearchParams({
    action: "TEMPLATE",
    text: details.title,
    dates: fmt(details.start) + "/" + fmt(details.end),
    details: details.description,
    location: details.location
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}

function buildWhatsAppUrl(details, booking) {
  var lines = [
    "Hi Iron & Oak, I'd like to confirm this booking:",
    "Name: " + booking.name,
    "Service: " + booking.serviceName + " (R" + booking.price + ")",
    "Barber: " + booking.barber,
    "Date: " + booking.dateLabel,
    "Time: " + booking.timeLabel
  ];
  if (booking.notes) lines.push("Notes: " + booking.notes);
  var text = encodeURIComponent(lines.join("\n"));
  return "https://wa.me/" + SHOP.whatsappNumber + "?text=" + text;
}

function buildIcsFile(details) {
  var fmt = function (dt) {
    return dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate()) + "T" +
      pad(dt.getHours()) + pad(dt.getMinutes()) + "00";
  };
  var escapeText = function (s) { return String(s).replace(/([,;])/g, "\\$1"); };
  var uid = "io-" + Date.now() + "@ironandoak.com";
  var lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Iron & Oak Barbershop//Booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + uid,
    "DTSTAMP:" + fmt(new Date()) + "Z",
    "DTSTART:" + fmt(details.start),
    "DTEND:" + fmt(details.end),
    "SUMMARY:" + escapeText(details.title),
    "DESCRIPTION:" + escapeText(details.description),
    "LOCATION:" + escapeText(details.location),
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  return lines.join("\r\n");
}

function initBookingForm() {
  var form = document.querySelector("[data-booking-form]");
  if (!form) return;

  var serviceSelect = form.querySelector("[name=service]");
  var barberSelect = form.querySelector("[name=barber]");
  var dateInput = form.querySelector("[name=date]");
  var timeSelect = form.querySelector("[name=time]");
  var dateError = form.querySelector("[data-date-error]");

  /* Populate services + barbers */
  Object.keys(SERVICES).forEach(function (key) {
    var s = SERVICES[key];
    var opt = document.createElement("option");
    opt.value = key;
    opt.textContent = s.name + " (R" + s.price + ", " + s.duration + " min)";
    serviceSelect.appendChild(opt);
  });
  BARBERS.forEach(function (name, i) {
    var opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    barberSelect.appendChild(opt);
  });

  /* Preselect a service if arriving from a "Book this" link, e.g. contact.html?service=skin-fade */
  var params = new URLSearchParams(window.location.search);
  var preselect = params.get("service");
  if (preselect && SERVICES[preselect]) serviceSelect.value = preselect;

  var today = new Date();
  dateInput.min = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());

  function refreshSlots() {
    var duration = SERVICES[serviceSelect.value] ? SERVICES[serviceSelect.value].duration : 30;
    var slots = getAvailableSlots(dateInput.value, duration);
    timeSelect.innerHTML = "";

    if (!dateInput.value) {
      timeSelect.disabled = true;
      dateError.textContent = "";
      var placeholder = document.createElement("option");
      placeholder.textContent = "Choose a date first";
      timeSelect.appendChild(placeholder);
      return;
    }

    if (slots.length === 0) {
      timeSelect.disabled = true;
      dateError.textContent = "We're closed on Sundays. Please choose another day.";
      var noSlot = document.createElement("option");
      noSlot.textContent = "No times available";
      timeSelect.appendChild(noSlot);
      return;
    }

    dateError.textContent = "";
    timeSelect.disabled = false;
    slots.forEach(function (slot) {
      var opt = document.createElement("option");
      opt.value = slot.value;
      opt.textContent = slot.label;
      timeSelect.appendChild(opt);
    });
  }

  serviceSelect.addEventListener("change", refreshSlots);
  dateInput.addEventListener("change", refreshSlots);
  refreshSlots();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!dateInput.value || timeSelect.disabled || !timeSelect.value) {
      dateError.textContent = dateError.textContent || "Please choose a valid date and time.";
      return;
    }

    var service = SERVICES[serviceSelect.value];
    var barber = barberSelect.value;
    var name = form.querySelector("[name=fullname]").value.trim();
    var notes = form.querySelector("[name=notes]").value.trim();
    var dateParts = dateInput.value.split("-").map(Number);
    var timeParts = timeSelect.value.split(":").map(Number);

    var start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]);
    var end = new Date(start.getTime() + service.duration * 60000);

    var dateLabel = start.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    var timeLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

    var calendarDetails = {
      title: service.name + " at " + SHOP.name,
      description: "Appointment: " + service.name + (barber !== BARBERS[0] ? " with " + barber : "") +
        ". Booked via ironandoak.com." + (notes ? " Notes: " + notes : ""),
      location: SHOP.address,
      start: start,
      end: end
    };

    /* Fill confirmation summary */
    var summary = form.parentElement.querySelector("[data-confirm-summary]");
    summary.innerHTML = "";
    var rows = [
      ["Name", name],
      ["Service", service.name + " (R" + service.price + ")"],
      ["Barber", barber],
      ["Date", dateLabel],
      ["Time", timeLabel]
    ];
    rows.forEach(function (r) {
      var li = document.createElement("li");
      li.innerHTML = "<span>" + r[0] + "</span><span>" + r[1] + "</span>";
      summary.appendChild(li);
    });

    var whatsappLink = form.parentElement.querySelector("[data-whatsapp-link]");
    whatsappLink.href = buildWhatsAppUrl(calendarDetails, {
      name: name,
      serviceName: service.name,
      price: service.price,
      barber: barber,
      dateLabel: dateLabel,
      timeLabel: timeLabel,
      notes: notes
    });

    var gcalLink = form.parentElement.querySelector("[data-gcal-link]");
    gcalLink.href = buildGoogleCalendarUrl(calendarDetails);

    var icsButton = form.parentElement.querySelector("[data-ics-button]");
    icsButton.onclick = function () {
      var icsContent = buildIcsFile(calendarDetails);
      var blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "iron-and-oak-appointment.ics";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    };

    form.classList.add("hide");
    form.parentElement.querySelector("[data-confirm-panel]").classList.add("show");
    form.parentElement.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  var resetBtn = document.querySelector("[data-book-again]");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      form.reset();
      refreshSlots();
      form.classList.remove("hide");
      document.querySelector("[data-confirm-panel]").classList.remove("show");
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initNav();
  initPopup();
  initBookingForm();

  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
});

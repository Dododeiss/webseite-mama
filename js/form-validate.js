(function () {
  function messageFor(field) {
    const v = field.validity;
    if (v.valueMissing) return "Dieses Feld ist erforderlich.";
    if (v.typeMismatch && field.type === "email")
      return "Bitte eine gültige E-Mail-Adresse eingeben.";
    if (v.tooShort)
      return `Mindestens ${field.minLength} Zeichen erforderlich.`;
    if (v.tooLong) return `Höchstens ${field.maxLength} Zeichen erlaubt.`;
    if (v.rangeUnderflow) return `Wert muss mindestens ${field.min} sein.`;
    if (v.rangeOverflow) return `Wert darf höchstens ${field.max} sein.`;
    if (v.stepMismatch || v.badInput) return "Bitte einen gültigen Wert eingeben.";
    if (v.patternMismatch) return "Ungültiges Format.";
    return field.validationMessage || "Ungültiger Wert.";
  }

  function ensureErrorEl(field) {
    let el = field.nextElementSibling;
    if (!el || !el.classList || !el.classList.contains("field-error")) {
      el = document.createElement("p");
      el.className = "field-error";
      el.setAttribute("aria-live", "polite");
      field.insertAdjacentElement("afterend", el);
    }
    return el;
  }

  function validate(field) {
    const errorEl = ensureErrorEl(field);
    if (field.validity.valid) {
      field.classList.remove("invalid");
      field.removeAttribute("aria-invalid");
      errorEl.textContent = "";
      return true;
    }
    field.classList.add("invalid");
    field.setAttribute("aria-invalid", "true");
    errorEl.textContent = messageFor(field);
    return false;
  }

  document.querySelectorAll("form[novalidate]").forEach((form) => {
    const fields = form.querySelectorAll("input, select, textarea");
    fields.forEach((field) => {
      field.addEventListener("blur", () => validate(field));
      field.addEventListener("input", () => {
        if (field.classList.contains("invalid")) validate(field);
      });
    });

    form.addEventListener(
      "submit",
      (event) => {
        let firstInvalid = null;
        fields.forEach((field) => {
          const ok = validate(field);
          if (!ok && !firstInvalid) firstInvalid = field;
        });
        if (firstInvalid) {
          event.preventDefault();
          event.stopImmediatePropagation();
          firstInvalid.focus();
        }
      },
      true
    );
  });
})();

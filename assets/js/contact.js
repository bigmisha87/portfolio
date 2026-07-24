/* Contact page — renders from SITE.contact and submits the form through
   Web3Forms, which forwards each message straight to the inbox tied to the
   access key. No server of our own is involved. */
window.PAGE_INIT = function () {
  var S = window.DC.data, esc = window.DC.esc;
  var C = S.contact || {};
  var app = document.getElementById("app");
  if (!app) return;

  var ENDPOINT = "https://api.web3forms.com/submit";
  var key = (C.accessKey || "").trim();

  var subjectOptions = (C.subjects || []).map(function (s) {
    return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
  }).join("");

  // Shown only until the access key is filled in, so the form can never fail silently.
  var setupNote = key ? "" :
    '<div class="form-setup">' +
      '<b>הטופס עדיין לא מחובר.</b> כדי להפעיל אותו צריך מפתח חינמי מ־Web3Forms: ' +
      'נכנסים ל־web3forms.com, מזינים כתובת דוא״ל, והמפתח נשלח אליכם. ' +
      'אחר כך מדביקים אותו בשדה <b>accessKey</b> בקובץ התוכן. ' +
      'עד אז ההודעות לא יישלחו.' +
    '</div>';

  app.innerHTML =
    '<main class="contact-wrap"><div class="wrap">' +
      '<div class="contact-head">' +
        '<h1>' + esc(C.title || "בואו נדבר") + '</h1>' +
        (C.intro ? '<p>' + esc(C.intro).replace(/\n/g, "<br>") + '</p>' : '') +
      '</div>' +

      '<div class="contact-body">' +
        '<form id="contact-form" novalidate>' +
          setupNote +
          '<div class="form-row">' +
            '<div class="field" data-field="name">' +
              '<label for="cf-name">שם מלא <span class="req">*</span></label>' +
              '<input id="cf-name" name="name" type="text" autocomplete="name" placeholder="איך קוראים לך?">' +
              '<div class="field__error">צריך למלא שם</div>' +
            '</div>' +
            '<div class="field" data-field="email">' +
              '<label for="cf-email">דוא״ל <span class="req">*</span></label>' +
              '<input id="cf-email" name="email" type="email" autocomplete="email" placeholder="name@example.com" dir="ltr">' +
              '<div class="field__error">כתובת דוא״ל לא תקינה</div>' +
            '</div>' +
          '</div>' +

          '<div class="form-row">' +
            '<div class="field" data-field="phone">' +
              '<label for="cf-phone">טלפון <span style="color:#666">(לא חובה)</span></label>' +
              '<input id="cf-phone" name="phone" type="tel" autocomplete="tel" placeholder="050-0000000" dir="ltr">' +
            '</div>' +
            '<div class="field" data-field="subject">' +
              '<label for="cf-subject">על מה מדובר?</label>' +
              '<select id="cf-subject" name="subject">' + subjectOptions + '</select>' +
            '</div>' +
          '</div>' +

          '<div class="field" data-field="message">' +
            '<label for="cf-message">ההודעה <span class="req">*</span></label>' +
            '<textarea id="cf-message" name="message" placeholder="מה רוצים ליצור? מה לוח הזמנים? מה כבר קיים?"></textarea>' +
            '<div class="field__error">צריך לכתוב כמה מילים</div>' +
          '</div>' +

          // honeypot: real people never see it, bots fill it in
          '<div class="hp-hidden" aria-hidden="true">' +
            '<label>אל תמלאו שדה זה<input type="text" name="botcheck" tabindex="-1" autocomplete="off"></label>' +
          '</div>' +

          '<div class="form-actions">' +
            '<button class="btn btn--primary" type="submit" id="cf-submit">' + esc(C.submitLabel || "שליחה") + '</button>' +
          '</div>' +

          '<div class="form-note form-note--ok" id="cf-ok">' +
            '<strong>' + esc(C.successTitle || "ההודעה נשלחה") + '</strong>' +
            '<span>' + esc(C.successBody || "") + '</span>' +
          '</div>' +
          '<div class="form-note form-note--err" id="cf-err">' +
            '<strong>לא הצלחתי לשלוח</strong>' +
            '<span id="cf-err-body">' + esc(C.errorBody || "") + '</span>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div></main>';

  /* ================= behaviour ================= */
  var form = document.getElementById("contact-form");
  var submit = document.getElementById("cf-submit");
  var okBox = document.getElementById("cf-ok");
  var errBox = document.getElementById("cf-err");
  var errBody = document.getElementById("cf-err-body");

  function fieldOf(name) { return form.querySelector('[data-field="' + name + '"]'); }
  function setInvalid(name, bad) {
    var f = fieldOf(name);
    if (f) f.classList[bad ? "add" : "remove"]("is-invalid");
  }
  function val(name) { return (form.elements[name] && form.elements[name].value || "").trim(); }

  function validate() {
    var ok = true;
    if (!val("name")) { setInvalid("name", true); ok = false; } else setInvalid("name", false);
    // deliberately loose: just enough to catch typos, not to reject valid addresses
    var email = val("email");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setInvalid("email", true); ok = false; }
    else setInvalid("email", false);
    if (val("message").length < 5) { setInvalid("message", true); ok = false; } else setInvalid("message", false);
    return ok;
  }

  // clear a field's error as soon as the visitor starts fixing it
  form.addEventListener("input", function (e) {
    var wrap = e.target.closest(".field");
    if (wrap) wrap.classList.remove("is-invalid");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    okBox.classList.remove("is-on");
    errBox.classList.remove("is-on");

    if (val("botcheck")) return;            // a bot filled the honeypot — drop it
    if (!validate()) {
      var first = form.querySelector(".field.is-invalid input, .field.is-invalid textarea");
      if (first) first.focus();
      return;
    }

    if (!key) {
      errBody.textContent = "הטופס עדיין לא חובר למפתח Web3Forms, אז ההודעה לא נשלחה.";
      errBox.classList.add("is-on");
      return;
    }

    submit.disabled = true;
    submit.textContent = C.sendingLabel || "שולח...";

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        access_key: key,
        subject: "פנייה חדשה מהאתר — " + (val("subject") || "כללי"),
        from_name: "Misha Graphics — אתר",
        name: val("name"),
        email: val("email"),
        phone: val("phone"),
        topic: val("subject"),
        message: val("message")
      })
    })
      .then(function (r) { return r.json().catch(function () { return { success: false }; }); })
      .then(function (data) {
        if (data && data.success) {
          form.reset();
          okBox.classList.add("is-on");
          okBox.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          errBody.textContent = (data && data.message) || C.errorBody || "שגיאה בשליחה.";
          errBox.classList.add("is-on");
        }
      })
      .catch(function () {
        errBody.textContent = C.errorBody || "שגיאה בשליחה.";
        errBox.classList.add("is-on");
      })
      .finally(function () {
        submit.disabled = false;
        submit.textContent = C.submitLabel || "שליחה";
      });
  });
};

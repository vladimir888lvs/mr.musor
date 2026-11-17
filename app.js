/* Mr. Musor — hero animation + waitlist application form */
(function () {
  'use strict';
  var CFG = window.MM_CONFIG || {};
  var T = window.MM_I18N || {};
  var LANG = window.MM_LANG || document.documentElement.lang || 'ru';
  function $(id) { return document.getElementById(id); }

  /* ================= HERO SCENE ================= */
  (function hero() {
    var sec = $('top'), stage = $('heroStage'), iso = $('iso');
    if (!sec || !iso) return;
    var van = $('van'), worker = $('worker'), cabin = $('cabin'), cartN = $('cartN'), done = $('doneChip');
    var steps = [0, 1, 2, 3].map(function (i) { return $('hstep' + i); });
    var H = 336, FL = 64;
    var doorX = [64, 112, 160, 208];
    var subs = { 5: [1, 0, 1, 1], 4: [1, 1, 0, 1], 3: [0, 1, 1, 1], 2: [1, 1, 1, 0], 1: [1, 0, 1, 1] };
    function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function feet(f) { return H - (f - 1) * FL - 10; }

    var bagEls = [], bagCt = [];
    var i = 0;
    for (var f = 5; f >= 1; f--) {
      for (var j = 0; j < 4; j++) {
        if (!subs[f][j]) continue;
        var bx = doorX[j] + 26;
        bagCt.push(0.26 + (5 - f) * 0.12 + 0.12 * 0.55 * clamp((bx - 40) / 200));
        bagEls.push($('bag' + i)); i++;
      }
    }
    var fly = [0, 1, 2].map(function (k) { return $('fly' + k); });
    var lastIdx = -1;

    function size() {
      var vh = window.innerHeight || 800;
      if (vh > 1500) vh = 800;
      var stageH = Math.max(560, Math.min(720, vh - 84));
      var mobile = window.matchMedia('(max-width: 900px)').matches;
      var box = sec.querySelector('.scenebox');
      var bw = (box && box.clientWidth) || 600;
      var zs = Math.max(0.3, Math.min(0.8, bw / (mobile ? 760 : 820)));
      sec.style.setProperty('--zs', zs.toFixed(3));
      sec.style.setProperty('--sh', Math.round(Math.max(230, 560 * zs)) + 'px');
      if (mobile) {
        sec.style.height = 'auto'; stage.style.height = 'auto';
      } else {
        sec.style.height = (stageH + 40) + 'px'; stage.style.height = stageH + 'px';
      }
    }

    function frame(p) {
      function seg(a, b) { return clamp((p - a) / (b - a)); }
      var vanLeft = lerp(-280, 210, 1 - Math.pow(1 - seg(0, 0.14), 3));
      var wx = 20, wf = 1, wo = 0;
      if (p < 0.14) { wo = 0; }
      else if (p < 0.18) { wo = seg(0.14, 0.18); }
      else if (p < 0.26) { wo = 1; wf = 1 + 4 * ease(seg(0.18, 0.26)); }
      else if (p < 0.86) {
        wo = 1;
        var q = (p - 0.26) / 0.12, k = Math.min(4, Math.floor(q)), t = q - k, fl = 5 - k;
        if (t < 0.55) { wx = 40 + 200 * (t / 0.55); wf = fl; }
        else if (k < 4) {
          if (t < 0.8) { wx = 240 - 220 * ((t - 0.55) / 0.25); wf = fl; }
          else { wx = 20; wf = fl - ease((t - 0.8) / 0.2); }
        } else { wx = 240 + 12 * ((t - 0.55) / 0.45); wf = 1; }
      } else { wo = 1; wx = 252; wf = 1; }
      var wy = H - (wf - 1) * FL - 10 - 40;
      var cabinY = H - (wf - 1) * FL - 56;

      var collected = 0;
      for (var b = 0; b < bagEls.length; b++) {
        var got = p >= bagCt[b];
        if (got) collected++;
        if (bagEls[b]) bagEls[b].style.opacity = got ? 0 : 1;
      }
      var dumped = Math.round(collected * seg(0.86, 0.97));
      for (var n = 0; n < 3; n++) {
        var a = 0.86 + n * 0.035, ft = seg(a, a + 0.05), el = fly[n];
        if (!el) continue;
        el.style.left = Math.round(lerp(wx + 30, 305, ft)) + 'px';
        el.style.top = Math.round(lerp(feet(1) - 30, H - 76, ft) - 70 * Math.sin(Math.PI * ft)) + 'px';
        el.style.transform = 'translateZ(' + Math.round(lerp(18, 44, ft)) + 'px)';
        el.style.opacity = ft > 0 && ft < 1 ? 1 : 0;
      }
      van.style.left = Math.round(vanLeft) + 'px';
      worker.style.left = Math.round(wx) + 'px';
      worker.style.top = Math.round(wy) + 'px';
      worker.style.opacity = wo.toFixed(2);
      cabin.style.top = Math.round(cabinY) + 'px';
      cartN.textContent = String(collected - dumped);
      done.style.opacity = p >= 0.97 ? 1 : 0;
      iso.style.transform = 'rotateX(' + (60 - 6 * p).toFixed(2) + 'deg) rotateZ(' + (-54 + 16 * p).toFixed(2) + 'deg)';

      var idx = p < 0.15 ? 0 : p < 0.26 ? 1 : p < 0.86 ? 2 : 3;
      if (idx !== lastIdx) {
        lastIdx = idx;
        steps.forEach(function (li, ii) {
          if (!li) return;
          var on = ii === idx, dn = ii < idx;
          li.style.padding = on ? '18px 20px' : '12px 16px';
          li.style.background = on ? '#0E1A14' : '#FFFFFF';
          li.style.borderColor = on ? '#0E1A14' : '#DDE3D7';
          li.style.boxShadow = on ? '0 18px 40px rgba(14,26,20,.18)' : 'none';
          li.style.transform = 'scale(' + (on ? '1.03' : '1') + ')';
          var num = li.querySelector('.hs-num'), tt = li.querySelector('.hs-t'), d = li.querySelector('.hs-d');
          num.style.background = on ? '#B9F08A' : dn ? '#2F9E62' : '#EEF1EA';
          num.style.color = on ? '#0E1A14' : dn ? '#FFFFFF' : '#3E4A44';
          tt.style.color = on ? '#FFFFFF' : '#3E4A44';
          d.hidden = !on;
          if (on) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        });
      }
    }

    size();
    var raf = 0;
    window.addEventListener('resize', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; size(); });
    });
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { frame(1); return; }
    var start = Date.now();
    frame(0);
    setInterval(function () {
      if (document.hidden) return;
      var t = ((Date.now() - start) % 19000) / 16000;
      frame(Math.min(1, t));
    }, 50);
  })();

  /* ================= CONTACT LINKS ================= */
  (function contacts() {
    var wa = String(CFG.WHATSAPP || '').replace(/\D/g, '');
    var ig = String(CFG.INSTAGRAM || '').replace(/^@/, '');
    document.querySelectorAll('.js-wa').forEach(function (a) {
      if (wa) { a.href = 'https://wa.me/' + wa; a.hidden = false; }
    });
    var parts = [];
    if (wa) parts.push('+' + wa.replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5'));
    if (ig) parts.push('@' + ig);
    document.querySelectorAll('.js-contacts').forEach(function (p) {
      if (!parts.length) return;
      p.textContent = '';
      parts.forEach(function (txt, k) {
        if (k) p.appendChild(document.createTextNode(' · '));
        var a = document.createElement('a');
        a.textContent = txt; a.style.color = '#C9D3CD'; a.target = '_blank'; a.rel = 'noopener';
        a.href = txt.charAt(0) === '@' ? 'https://instagram.com/' + ig : 'https://wa.me/' + wa;
        p.appendChild(a);
      });
      p.hidden = false;
    });
  })();

  /* ================= UTM / SOURCE TRACKING ================= */
  var utm = '';
  try {
    var qs = new URLSearchParams(location.search), bits = [];
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref'].forEach(function (k) {
      if (qs.get(k)) bits.push(k + '=' + qs.get(k));
    });
    if (bits.length) sessionStorage.setItem('mm_utm', bits.join('&'));
    utm = sessionStorage.getItem('mm_utm') || '';
  } catch (e) { /* storage unavailable */ }

  /* ================= APPLICATION FORM ================= */
  var form = $('applyForm');
  if (!form) return;
  var ok = $('applyOk'), alertBox = $('formAlert'), btn = $('applySubmit');
  var btnHTML = btn.innerHTML;

  // Pricing buttons preselect the plan
  document.querySelectorAll('a[data-plan]').forEach(function (a) {
    a.addEventListener('click', function () {
      var r = form.querySelector('input[name="plan"][value="' + a.getAttribute('data-plan') + '"]');
      if (r) { r.checked = true; clearErr('plan'); }
    });
  });

  function digits(v) { return String(v || '').replace(/\D/g, ''); }
  function normPhone(v) {
    var d = digits(v);
    // "+7 " prefix followed by a full number typed as 8XXX… or 7XXX…
    if (d.length === 12 && d.charAt(0) === '7' && (d.charAt(1) === '8' || d.charAt(1) === '7')) d = '7' + d.slice(2);
    if (d.length === 11 && d.charAt(0) === '8') d = '7' + d.slice(1);
    if (d.length === 10 && d.charAt(0) === '7') d = '7' + d;
    return d;
  }
  function fmtPhone(d) { return '+7 ' + d.slice(1, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7, 9) + ' ' + d.slice(9, 11); }

  var phone = form.elements.phone;
  phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7 '; });
  phone.addEventListener('blur', function () {
    var d = normPhone(phone.value);
    if (d.length === 11 && d.charAt(0) === '7') phone.value = fmtPhone(d);
    else if (digits(phone.value) === '7') phone.value = '';
  });

  function wrap(name) { return form.querySelector('[data-field="' + name + '"]'); }
  function setErr(name, msg) {
    var w = wrap(name); if (!w) return;
    w.classList.add('invalid');
    var e = $('err-' + name); if (e) e.textContent = msg;
    w.querySelectorAll('input,select,textarea').forEach(function (c) {
      c.setAttribute('aria-invalid', 'true'); c.setAttribute('aria-describedby', 'err-' + name);
    });
  }
  function clearErr(name) {
    var w = wrap(name); if (!w) return;
    w.classList.remove('invalid');
    var e = $('err-' + name); if (e) e.textContent = '';
    w.querySelectorAll('input,select,textarea').forEach(function (c) { c.removeAttribute('aria-invalid'); });
  }
  form.addEventListener('input', function (ev) { if (ev.target.name) clearErr(ev.target.name); });
  form.addEventListener('change', function (ev) { if (ev.target.name) clearErr(ev.target.name); });

  function val(n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; }

  function validate() {
    var bad = [];
    ['name', 'district', 'zhk', 'street', 'apartment'].forEach(function (n) {
      if (!val(n)) { setErr(n, T.err_required); bad.push(n); }
    });
    var d = normPhone(val('phone'));
    if (!(d.length === 11 && d.charAt(0) === '7')) { setErr('phone', T.err_phone); bad.push('phone'); }
    var em = val('email');
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { setErr('email', T.err_email); bad.push('email'); }
    if (!form.querySelector('input[name="plan"]:checked')) { setErr('plan', T.err_required); bad.push('plan'); }
    if (!form.elements.consent.checked) { setErr('consent', T.err_consent); bad.push('consent'); }
    // order by position in the form
    var order = ['name', 'phone', 'email', 'district', 'zhk', 'street', 'apartment', 'plan', 'consent'];
    bad.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    return bad;
  }

  function showAlert(msg) {
    alertBox.textContent = msg;
    var wa = digits(CFG.WHATSAPP);
    if (wa && msg !== T.err_fields) {
      alertBox.appendChild(document.createTextNode(' '));
      var a = document.createElement('a');
      a.href = 'https://wa.me/' + wa; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'WhatsApp →';
      alertBox.appendChild(a);
    }
    alertBox.hidden = false;
  }

  function radio(n) { var r = form.querySelector('input[name="' + n + '"]:checked'); return r ? r.value : ''; }

  var busy = false;
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (busy) return;
    alertBox.hidden = true;
    var bad = validate();
    if (bad.length) {
      showAlert(T.err_fields);
      var first = wrap(bad[0]).querySelector('input,select,textarea');
      if (first) first.focus();
      return;
    }
    if (!CFG.SCRIPT_URL) { showAlert(T.err_cfg); return; }

    var d = normPhone(val('phone'));
    var data = {
      lang: LANG,
      name: val('name'),
      phone: '+' + d,
      whatsapp: form.elements.whatsapp.checked ? 'yes' : 'no',
      email: val('email'),
      method: radio('method'),
      district: val('district'),
      zhk: val('zhk'),
      street: val('street'),
      block: val('block'),
      entrance: val('entrance'),
      floor: val('floor'),
      apartment: val('apartment'),
      elevator: radio('elevator'),
      plan: radio('plan'),
      residents: val('residents'),
      source: val('source'),
      comment: val('comment'),
      consent: 'yes',
      website: val('website'), // honeypot
      utm: utm,
      page: location.href.split('#')[0]
    };

    busy = true; btn.disabled = true; btn.textContent = T.sending;
    // text/plain body = "simple" request: no CORS preflight, which Apps Script can't answer.
    fetch(CFG.SCRIPT_URL, { method: 'POST', body: JSON.stringify(data), redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || 'bad response');
        $('okId').textContent = res.id;
        form.hidden = true; ok.hidden = false; ok.focus();
        ok.scrollIntoView({ block: 'center', behavior: 'smooth' });
        try { if (window.gtag) window.gtag('event', 'generate_lead', { plan: data.plan }); } catch (e) {}
      })
      .catch(function () { showAlert(T.err_net); })
      .then(function () { busy = false; btn.disabled = false; btn.innerHTML = btnHTML; });
  });

  $('applyAgain').addEventListener('click', function () {
    ['name', 'phone', 'email', 'block', 'entrance', 'floor', 'apartment', 'comment'].forEach(function (n) { form.elements[n].value = ''; });
    form.elements.consent.checked = false;
    ok.hidden = true; form.hidden = false; form.elements.name.focus();
  });
})();

// ==UserScript==
// @name         Klacht Eindhoven Airport — 1-tik melden
// @namespace    https://ralfkerkhof.nl/klacht-eindhoven
// @version      1.1.0
// @description  Dien automatisch een geluidsklacht in bij Eindhoven Airport (Casper-portaal). Trigger: open de portaal-URL met ?klachtnu=1 (of #klachtnu) en het script doorloopt automatisch alle stappen.
// @match        https://ein.flighttracking.casper.aero/portal/*
// @run-at       document-end
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // === INSTELLINGEN — pas aan naar wens ===
    var SETTINGS = {
        type: 'COMPLAINT',           // 'COMPLAINT' (melding) of 'QUESTION'
        complaintType: 'SPECIFIC',   // 'SPECIFIC' (één moment) of 'GENERIC' (algemeen)
        causeValue: '2',             // 1=Anders, 2=Geluid, 3=Veiligheid, 4=Milieu
        subcauseValue: '2',          // 1=Slaapverstoring, 2=Geluidkwaliteit in huis,
                                     // 3=Geluidkwaliteit buitenshuis, 7=Grondgeluid
        wantFeedback: false,         // true = "ik wil een antwoord ontvangen" aanvinken
        useCurrentTime: true,        // true = huidig tijdstip; false = ?tijd= uit URL gebruiken
        autoSubmit: true             // false = stop vóór de Verstuur-knop (alleen voorinvullen)
    };
    // =========================================

    var FLAG = 'casperKlachtAuto';
    var TIMEKEY = 'casperKlachtTime';

    var url = location.href;
    var bodyId = (document.body && document.body.id) || '';

    // Visuele indicator: kleine banner zodra het script in auto-modus draait
    function showBanner(text, color) {
        if (document.getElementById('__klacht_banner')) return;
        var b = document.createElement('div');
        b.id = '__klacht_banner';
        b.textContent = text;
        b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:' + (color || '#22c55e') +
            ';color:#fff;padding:8px;text-align:center;font-weight:bold;z-index:99999;font-family:sans-serif;font-size:13px;';
        document.body.appendChild(b);
    }

    // 1) Trigger: query ?klachtnu, hash #klachtnu, of een opgeslagen flag
    var hasTrigger = /[?&]klachtnu(=|&|$)/i.test(location.search) ||
                     location.hash.toLowerCase().indexOf('klachtnu') !== -1;

    if (hasTrigger) {
        sessionStorage.setItem(FLAG, '1');
        // Bewaar evt. tijd uit ?tijd=HH:MM
        var m = location.search.match(/[?&]tijd=([0-2]?\d:[0-5]\d)/i);
        if (m) sessionStorage.setItem(TIMEKEY, m[1]);
        else if (SETTINGS.useCurrentTime) {
            var now = new Date();
            sessionStorage.setItem(
                TIMEKEY,
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0')
            );
        }
        // Als we al op complaint-1 staan zonder trigger-params: gewoon doorgaan met stap 1
        var alreadyOnStep1 = (location.pathname === '/portal/' || location.pathname === '/portal') &&
                              location.search === '?p=complaint-1' && !location.hash;
        if (!alreadyOnStep1) {
            // Force een echte navigation, anders blijft Firefox op dezelfde page hangen
            location.replace('/portal/?p=complaint-1');
            return;
        }
        // Val door naar de per-page handler hieronder
    }

    if (sessionStorage.getItem(FLAG) !== '1') return; // niet in auto-modus

    // Vanaf hier: auto-modus actief
    showBanner('Klacht-NU: stap ' + (bodyId || 'onbekend') + ' \u2014 even geduld...');

    // Helper: wacht tot een conditie waar is
    function wait(test, cb, tries) {
        if (typeof tries === 'undefined') tries = 80; // ~16s
        if (test()) { cb(); return; }
        if (tries > 0) setTimeout(function () { wait(test, cb, tries - 1); }, 200);
        else { console.warn('[Klacht-EIN] timeout op stap ' + bodyId); }
    }

    function clearFlag() {
        sessionStorage.removeItem(FLAG);
        sessionStorage.removeItem(TIMEKEY);
    }

    function clickBtn(selector) {
        var b = document.querySelector(selector);
        if (b) b.click();
    }

    // 2) Per-pagina actie
    if (bodyId === 'complaint-1') {
        // Stap 1: kies "melding" of "vraag"
        wait(function () { return document.querySelectorAll('input[name=type]').length >= 1; }, function () {
            var radio = document.querySelector('input[name=type][value=' + SETTINGS.type + ']');
            if (radio) radio.click();
            setTimeout(function () { clickBtn('#c1_next'); }, 100);
        });

    } else if (bodyId === 'complaint-2') {
        // Stap 2: kies SPECIFIC of GENERIC
        wait(function () { return document.querySelectorAll('input[name=complaintType]').length >= 1; }, function () {
            var radio = document.querySelector('input[name=complaintType][value=' + SETTINGS.complaintType + ']');
            if (radio) radio.click();
            setTimeout(function () { clickBtn('#c2_next'); }, 100);
        });

    } else if (bodyId === 'complaint-specific') {
        // Stap 3: vul datum (vandaag) en tijd
        wait(function () { return document.querySelector('input[name=time]') && document.querySelector('input[name=date]'); }, function () {
            var now = new Date();
            // <input type="date"> verwacht yyyy-mm-dd
            var d = document.querySelector('input[name=date]');
            d.value = now.getFullYear() + '-' +
                      String(now.getMonth() + 1).padStart(2, '0') + '-' +
                      String(now.getDate()).padStart(2, '0');
            d.dispatchEvent(new Event('input', { bubbles: true }));
            d.dispatchEvent(new Event('change', { bubbles: true }));

            var time = sessionStorage.getItem(TIMEKEY);
            if (!time) {
                time = String(now.getHours()).padStart(2, '0') + ':' +
                       String(now.getMinutes()).padStart(2, '0');
            }
            var t = document.querySelector('input[name=time]');
            t.value = time;
            t.dispatchEvent(new Event('input', { bubbles: true }));
            t.dispatchEvent(new Event('change', { bubbles: true }));

            setTimeout(function () { clickBtn('#cs_next'); }, 250);
        });

    } else if (bodyId === 'complaint-last') {
        // Stap 4: oorzaak + suboorzaak en (optioneel) Verstuur
        wait(function () { return document.querySelector('select[name=cause]'); }, function () {
            var cause = document.querySelector('select[name=cause]');
            cause.value = SETTINGS.causeValue;
            cause.dispatchEvent(new Event('change', { bubbles: true }));

            wait(function () {
                var sub = document.querySelector('select[name=subcause]');
                return sub && sub.options.length > 1;
            }, function () {
                var sub = document.querySelector('select[name=subcause]');
                sub.value = SETTINGS.subcauseValue;
                sub.dispatchEvent(new Event('change', { bubbles: true }));

                if (SETTINGS.wantFeedback) {
                    var fb = document.querySelector('input[name=feedback]');
                    if (fb && !fb.checked) fb.click();
                }

                if (SETTINGS.autoSubmit) {
                    setTimeout(function () {
                        clickBtn('#cl_next');
                        // Klacht is nu ingediend; wis flag
                        clearFlag();
                    }, 300);
                } else {
                    clearFlag();
                    alert('Klacht voorbereid — controleer en klik zelf op Verstuur.');
                }
            });
        });

    } else if (/^complaint-/.test(bodyId)) {
        // Onbekende complaint-pagina; doe niets
    } else if (bodyId === 'login' || /\?p=login/.test(location.href) || document.querySelector('input[type=password]')) {
        // Niet ingelogd: stop en meld het
        clearFlag();
        var msg = document.createElement('div');
        msg.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ffb800;color:#222;padding:14px;text-align:center;font-weight:bold;z-index:99999;font-family:sans-serif;';
        msg.textContent = 'Klacht-script: log eerst in op het Casper-portaal en klik dan opnieuw op je Klacht-icoon.';
        document.body.appendChild(msg);
    }
})();

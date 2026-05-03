// ==UserScript==
// @name         Klacht Eindhoven Airport — 1-tik melden
// @namespace    https://ralfkerkhof.nl/klacht-eindhoven
// @version      1.3.0
// @description  Dien automatisch een geluidsklacht in bij Eindhoven Airport (Casper-portaal). Trigger: open de portaal-URL met ?klachtnu=1. Random delays tussen klikken zodat het ononderscheidbaar is van een mens.
// @match        https://ein.flighttracking.casper.aero/portal/*
// @run-at       document-end
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // Sentinel: voorkom dubbele uitvoer als het bestand per ongeluk dubbel staat
    if (window.__klachtRan) return;
    window.__klachtRan = true;

    // === INSTELLINGEN — pas aan naar wens ===
    var SETTINGS = {
        type: 'COMPLAINT',
        complaintType: 'SPECIFIC',
        causeValue: '2',
        subcauseValue: '2',
        wantFeedback: false,
        useCurrentTime: true,
        autoSubmit: true
    };
    // =========================================

    var FLAG = 'casperKlachtAuto';
    var TIMEKEY = 'casperKlachtTime';
    var bodyId = (document.body && document.body.id) || '';

    // Random integer in range [min, max]
    function rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // setTimeout met random delay
    function delay(min, max, fn) {
        var ms = rand(min, max);
        setTimeout(fn, ms);
    }

    function showBanner(text, color) {
        var b = document.getElementById('__klacht_banner');
        if (!b) {
            b = document.createElement('div');
            b.id = '__klacht_banner';
            b.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:8px;text-align:center;font-weight:bold;z-index:99999;font-family:sans-serif;font-size:13px;color:#fff;';
            document.body.appendChild(b);
        }
        b.style.background = color || '#22c55e';
        b.textContent = text;
    }

    var hasTrigger = /[?&]klachtnu(=|&|$)/i.test(location.search) ||
                     location.hash.toLowerCase().indexOf('klachtnu') !== -1;

    if (hasTrigger) {
        sessionStorage.setItem(FLAG, '1');
        var m = location.search.match(/[?&]tijd=([0-2]?\d:[0-5]\d)/i);
        if (m) sessionStorage.setItem(TIMEKEY, m[1]);
        else if (SETTINGS.useCurrentTime) {
            var now = new Date();
            sessionStorage.setItem(TIMEKEY,
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0'));
        }
        var alreadyOnStep1 = (location.pathname === '/portal/' || location.pathname === '/portal') &&
                              location.search === '?p=complaint-1' && !location.hash;
        if (!alreadyOnStep1) {
            location.replace('/portal/?p=complaint-1');
            return;
        }
    }

    if (sessionStorage.getItem(FLAG) !== '1') return;

    showBanner('Klacht-NU: ' + (bodyId || '?') + ' \u2014 even rustig...', '#22c55e');

    function wait(test, cb, tries) {
        if (typeof tries === 'undefined') tries = 150;
        try { if (test()) { cb(); return; } } catch (e) {}
        if (tries > 0) setTimeout(function () { wait(test, cb, tries - 1); }, rand(180, 260));
        else { showBanner('Klacht-NU: timeout op ' + bodyId + ' \u2014 herlaad de pagina', '#ef4444'); }
    }

    function handlerBound(selector) {
        if (typeof jQuery === 'undefined') return false;
        var el = document.querySelector(selector);
        if (!el) return false;
        try {
            var events = jQuery._data && jQuery._data(el, 'events');
            return !!(events && events.click && events.click.length > 0);
        } catch (e) { return false; }
    }

    function clearFlag() {
        sessionStorage.removeItem(FLAG);
        sessionStorage.removeItem(TIMEKEY);
    }

    function clickBtn(selector) {
        if (typeof jQuery !== 'undefined' && jQuery(selector).length) {
            jQuery(selector).trigger('click');
        } else {
            var b = document.querySelector(selector);
            if (b) b.click();
        }
    }

    if (bodyId === 'complaint-1') {
        // Stap 1 — menselijke leestijd op startpagina (1.5–3.5s) voor klikken
        delay(1500, 3500, function () {
            wait(function () {
                return document.querySelector('input[name=type]') && handlerBound('#c1_next');
            }, function () {
                var radio = document.querySelector('input[name=type][value=' + SETTINGS.type + ']');
                if (radio) radio.click();
                // Tussen radio en Volgende: 0.7–1.6s
                delay(700, 1600, function () { clickBtn('#c1_next'); });
            });
        });

    } else if (bodyId === 'complaint-2') {
        // Op vervolgstappen: 1–2.5s leestijd
        delay(1000, 2500, function () {
            wait(function () {
                return document.querySelector('input[name=complaintType]') && handlerBound('#c2_next');
            }, function () {
                var radio = document.querySelector('input[name=complaintType][value=' + SETTINGS.complaintType + ']');
                if (radio) radio.click();
                delay(700, 1600, function () { clickBtn('#c2_next'); });
            });
        });

    } else if (bodyId === 'complaint-specific') {
        delay(1200, 2800, function () {
            wait(function () {
                return document.querySelector('input[name=time]') &&
                       document.querySelector('input[name=date]') &&
                       handlerBound('#cs_next');
            }, function () {
                var now = new Date();
                var d = document.querySelector('input[name=date]');
                d.value = now.getFullYear() + '-' +
                          String(now.getMonth() + 1).padStart(2, '0') + '-' +
                          String(now.getDate()).padStart(2, '0');
                d.dispatchEvent(new Event('input', { bubbles: true }));
                d.dispatchEvent(new Event('change', { bubbles: true }));

                // Tussen datum en tijd invullen: korte pauze
                delay(400, 900, function () {
                    var time = sessionStorage.getItem(TIMEKEY);
                    if (!time) {
                        time = String(now.getHours()).padStart(2, '0') + ':' +
                               String(now.getMinutes()).padStart(2, '0');
                    }
                    var t = document.querySelector('input[name=time]');
                    t.value = time;
                    t.dispatchEvent(new Event('input', { bubbles: true }));
                    t.dispatchEvent(new Event('change', { bubbles: true }));

                    delay(800, 1800, function () { clickBtn('#cs_next'); });
                });
            });
        });

    } else if (bodyId === 'complaint-last') {
        delay(1500, 3000, function () {
            wait(function () {
                return document.querySelector('select[name=cause]') && handlerBound('#cl_next');
            }, function () {
                var cause = document.querySelector('select[name=cause]');
                cause.value = SETTINGS.causeValue;
                cause.dispatchEvent(new Event('change', { bubbles: true }));

                // Mens denkt na voor suboorzaak: 0.6–1.4s
                delay(600, 1400, function () {
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
                            // Laatste check vooraf: 1.2–2.5s
                            delay(1200, 2500, function () {
                                clickBtn('#cl_next');
                                clearFlag();
                                showBanner('Klacht-NU: klacht ingediend \u2713', '#22c55e');
                            });
                        } else {
                            clearFlag();
                            showBanner('Klacht voorbereid \u2014 klik zelf op Verstuur', '#f59e0b');
                        }
                    });
                });
            });
        });

    } else if (bodyId === 'login' || /\?p=login/.test(location.href) || document.querySelector('input[type=password]')) {
        clearFlag();
        showBanner('Log eerst in op het Casper-portaal en tik dan opnieuw op je Klacht-icoon.', '#ffb800');
    }
})();

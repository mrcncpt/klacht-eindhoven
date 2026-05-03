// ==UserScript==
// @name         Klacht Eindhoven Airport — 1-tik melden
// @namespace    https://ralfkerkhof.nl/klacht-eindhoven
// @version      1.2.0
// @description  Dien automatisch een geluidsklacht in bij Eindhoven Airport (Casper-portaal). Trigger: open de portaal-URL met ?klachtnu=1 en het script doorloopt automatisch alle stappen.
// @match        https://ein.flighttracking.casper.aero/portal/*
// @run-at       document-end
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

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

    showBanner('Klacht-NU: ' + (bodyId || '?') + ' \u2014 even geduld...', '#22c55e');

    // Wacht tot conditie waar is (max ~30s)
    function wait(test, cb, tries) {
        if (typeof tries === 'undefined') tries = 150;
        try { if (test()) { cb(); return; } } catch (e) {}
        if (tries > 0) setTimeout(function () { wait(test, cb, tries - 1); }, 200);
        else { showBanner('Klacht-NU: timeout op ' + bodyId + ' \u2014 herlaad de pagina', '#ef4444'); }
    }

    // Check of jQuery click-handler gebonden is op een selector
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

    // Klik via jQuery als beschikbaar (triggert handlers betrouwbaarder), anders native
    function clickBtn(selector) {
        if (typeof jQuery !== 'undefined' && jQuery(selector).length) {
            jQuery(selector).trigger('click');
        } else {
            var b = document.querySelector(selector);
            if (b) b.click();
        }
    }

    if (bodyId === 'complaint-1') {
        wait(function () {
            return document.querySelector('input[name=type]') && handlerBound('#c1_next');
        }, function () {
            var radio = document.querySelector('input[name=type][value=' + SETTINGS.type + ']');
            if (radio) radio.click();
            setTimeout(function () { clickBtn('#c1_next'); }, 300);
        });

    } else if (bodyId === 'complaint-2') {
        wait(function () {
            return document.querySelector('input[name=complaintType]') && handlerBound('#c2_next');
        }, function () {
            var radio = document.querySelector('input[name=complaintType][value=' + SETTINGS.complaintType + ']');
            if (radio) radio.click();
            setTimeout(function () { clickBtn('#c2_next'); }, 300);
        });

    } else if (bodyId === 'complaint-specific') {
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

            var time = sessionStorage.getItem(TIMEKEY);
            if (!time) {
                time = String(now.getHours()).padStart(2, '0') + ':' +
                       String(now.getMinutes()).padStart(2, '0');
            }
            var t = document.querySelector('input[name=time]');
            t.value = time;
            t.dispatchEvent(new Event('input', { bubbles: true }));
            t.dispatchEvent(new Event('change', { bubbles: true }));

            setTimeout(function () { clickBtn('#cs_next'); }, 400);
        });

    } else if (bodyId === 'complaint-last') {
        wait(function () {
            return document.querySelector('select[name=cause]') && handlerBound('#cl_next');
        }, function () {
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
                        clearFlag();
                        showBanner('Klacht-NU: klacht ingediend \u2713', '#22c55e');
                    }, 500);
                } else {
                    clearFlag();
                    showBanner('Klacht voorbereid \u2014 klik zelf op Verstuur', '#f59e0b');
                }
            });
        });

    } else if (bodyId === 'login' || /\?p=login/.test(location.href) || document.querySelector('input[type=password]')) {
        clearFlag();
        showBanner('Log eerst in op het Casper-portaal en klik dan opnieuw op je Klacht-icoon.', '#ffb800');
    }
})();

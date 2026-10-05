/* =====================================================================
   mobile.js — Mobile (<=600px) layout helper for the dental anatomy app.

   Responsibilities (LAYOUT ONLY — no 3D / selection / app logic is touched):
     1. Hamburger drawer open/close.
     2. At <=600px, relocate the secondary panels (Search, Information,
        Occlusion, Jaw position, X-ray) into the drawer, move the
        Compare/Isolate actions onto the canvas, and drop the odontogram
        below the canvas. Above 600px everything is moved back to its exact
        original position.

   The SAME DOM elements are moved (never cloned), so every existing event
   listener, id and piece of functionality stays intact. Original positions
   are preserved with placeholder comment nodes, making the move fully
   reversible regardless of order.
   ===================================================================== */
(function () {
  'use strict';

  var MQ = window.matchMedia('(max-width: 600px)');

  var state = { mobile: false, dock: null, ready: false };

  // --- element lookups (all optional / guarded) ---------------------------
  function $(sel) { return document.querySelector(sel); }

  var els = {};
  function collect() {
    els.header        = $('.app-header');
    els.searchShell   = $('.search-shell');
    els.leftColumn    = $('.left-column');
    els.infoPanel     = $('.info-panel');
    els.infoActions   = $('.info-actions');
    els.xrayPanel     = $('.xray-panel');
    els.occlusionPanel= $('.occlusion-panel');
    els.jawPanel      = $('.jaw-panel');
    els.sceneArea     = $('.scene-area');
    els.overlayStack  = $('.scene-overlay-stack');
    els.odontogram    = document.getElementById('odontogramCard');
    els.drawer        = document.getElementById('mobileDrawer');
    els.drawerBody    = document.getElementById('mobileDrawerBody');
    els.drawerClose   = document.getElementById('mobileDrawerClose');
    els.scrim         = document.getElementById('mobileDrawerScrim');
    els.menuBtn       = document.getElementById('mobileMenuBtn');
  }

  // --- reversible move using a placeholder comment ------------------------
  function moveOut(el, dest) {
    if (!el || !dest || !el.parentNode) return;
    if (el._mph) return; // already moved out
    var ph = document.createComment('mobile-placeholder');
    el._mph = ph;
    el.parentNode.insertBefore(ph, el);
    dest.appendChild(el);
  }

  function moveBack(el) {
    if (!el || !el._mph) return;
    var ph = el._mph;
    if (ph.parentNode) {
      ph.parentNode.insertBefore(el, ph);
      ph.parentNode.removeChild(ph);
    }
    el._mph = null;
  }

  function fireResize() {
    // Let the Three.js ResizeObserver / odontogram re-measure after a reflow.
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }

  // --- enter / exit mobile layout ----------------------------------------
  function enterMobile() {
    if (state.mobile) return;
    state.mobile = true;

    // Compare/Isolate dock floats over the canvas (bottom-left).
    if (els.overlayStack && els.infoActions) {
      var dock = document.createElement('div');
      dock.id = 'mobileActionDock';
      dock.className = 'mobile-action-dock';
      els.overlayStack.appendChild(dock);
      state.dock = dock;
      moveOut(els.infoActions, dock);
    }

    // Odontogram drops below the canvas (out of the absolute overlay stack).
    if (els.odontogram && els.sceneArea) {
      moveOut(els.odontogram, els.sceneArea);
    }

    // Secondary panels go into the drawer, in a sensible reading order.
    if (els.drawerBody) {
      [els.searchShell, els.infoPanel, els.occlusionPanel, els.jawPanel, els.xrayPanel]
        .forEach(function (el) { moveOut(el, els.drawerBody); });
    }

    fireResize();
  }

  function exitMobile() {
    if (!state.mobile) return;
    state.mobile = false;
    closeDrawer();

    // Move panels back first (info-panel carries the info-actions placeholder).
    [els.searchShell, els.infoPanel, els.occlusionPanel, els.jawPanel, els.xrayPanel]
      .forEach(moveBack);
    moveBack(els.odontogram);
    moveBack(els.infoActions);

    if (state.dock && state.dock.parentNode) {
      state.dock.parentNode.removeChild(state.dock);
    }
    state.dock = null;

    fireResize();
  }

  // --- drawer open/close --------------------------------------------------
  function openDrawer() {
    if (!els.drawer) return;
    els.drawer.classList.add('open');
    els.drawer.setAttribute('aria-hidden', 'false');
    if (els.scrim) {
      els.scrim.hidden = false;
      // next frame so the CSS transition runs
      requestAnimationFrame(function () { els.scrim.classList.add('show'); });
    }
    if (els.menuBtn) els.menuBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-open');
  }

  function closeDrawer() {
    if (!els.drawer) return;
    els.drawer.classList.remove('open');
    els.drawer.setAttribute('aria-hidden', 'true');
    if (els.scrim) {
      els.scrim.classList.remove('show');
      els.scrim.hidden = true;
    }
    if (els.menuBtn) els.menuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
  }

  function toggleDrawer() {
    if (els.drawer && els.drawer.classList.contains('open')) closeDrawer();
    else openDrawer();
  }

  // --- wiring -------------------------------------------------------------
  function onMqChange() {
    if (MQ.matches) enterMobile();
    else exitMobile();
  }

  function init() {
    if (state.ready) return;
    state.ready = true;
    collect();

    if (els.menuBtn) els.menuBtn.addEventListener('click', toggleDrawer);
    if (els.drawerClose) els.drawerClose.addEventListener('click', closeDrawer);
    if (els.scrim) els.scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    // Apply current state, then watch for breakpoint changes.
    onMqChange();
    if (MQ.addEventListener) MQ.addEventListener('change', onMqChange);
    else if (MQ.addListener) MQ.addListener(onMqChange); // older Safari
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

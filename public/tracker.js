/**
 * Behavioral Insights Tracker - Enhanced with Frustration Signal Detection
 */
(function() {
  'use strict';

  const script = document.currentScript;
  const SITE_ID = script?.getAttribute('data-site-id');
  const API_URL = script?.src.replace('/tracker.js', '/api/collect');
  const SCREENSHOT_API_URL = script?.src.replace('/tracker.js', '/api/screenshots');
  
  if (!SITE_ID) {
    console.warn('[Behavioral Insights] Missing data-site-id attribute');
    return;
  }

  let sessionId = getOrCreateSessionId();
  let pageEntryTime = Date.now();
  let maxScrollDepth = 0;
  let clickCount = 0;
  let isVisible = true;
  let totalVisibleTime = 0;
  let lastVisibilityChange = Date.now();
  let lastScrollDepthSent = 0;
  let interactionCount = 0;

  // Frustration detection state
  let recentClicks = [];
  let mouseMovements = [];
  let lastMousePosition = { x: 0, y: 0 };
  let deadClickCount = 0;
  let rageClickCount = 0;

  // Form tracking state
  let activeForms = new Map(); // formElement -> { startTime, fieldsInteracted, lastField, submitted }
  let formObserver = null;

  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getOrCreateSessionId() {
    const key = 'bi_session';
    const stored = sessionStorage.getItem(key);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (Date.now() - data.lastActivity < 30 * 60 * 1000) {
          data.lastActivity = Date.now();
          sessionStorage.setItem(key, JSON.stringify(data));
          return data.id;
        }
      } catch (e) {}
    }
    const newSession = { id: generateId(), lastActivity: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(newSession));
    return newSession.id;
  }

  function getVisitorId() {
    const key = 'bi_visitor';
    let visitorId = localStorage.getItem(key);
    if (!visitorId) {
      visitorId = generateId();
      localStorage.setItem(key, visitorId);
    }
    return visitorId;
  }

  function getScrollDepth() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    return scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 100;
  }

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/.test(ua)) return 'mobile';
    return 'desktop';
  }

  function getElementSelector(element) {
    if (!element) return null;
    let selector = element.tagName.toLowerCase();
    if (element.id) {
      selector += '#' + element.id;
    } else if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (classes) selector += '.' + classes;
    }
    return selector;
  }

  function getElementPath(element) {
    const path = [];
    let current = element;
    while (current && current !== document.body && path.length < 5) {
      path.unshift(getElementSelector(current));
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  function isClickableElement(element) {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    const clickableTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];
    if (clickableTags.includes(tagName)) return true;
    if (element.getAttribute('role') === 'button') return true;
    if (element.onclick || element.getAttribute('onclick')) return true;
    if (element.style.cursor === 'pointer') return true;
    if (window.getComputedStyle(element).cursor === 'pointer') return true;
    return false;
  }

  function collectBaseData() {
    return {
      siteId: SITE_ID,
      sessionId: sessionId,
      visitorId: getVisitorId(),
      timestamp: new Date().toISOString(),
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
      deviceType: getDeviceType(),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  function sendEvent(eventType, eventData) {
    interactionCount++;
    const payload = { 
      ...collectBaseData(), 
      eventType, 
      eventData: eventData || {},
      interactionIndex: interactionCount
    };
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon(API_URL, JSON.stringify(payload));
    } else {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function() {});
    }
  }

  // ==========================================
  // FORM TRACKING
  // ==========================================

  function getFieldLabel(field) {
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label.innerText.trim().slice(0, 50);
    }
    const parentLabel = field.closest('label');
    if (parentLabel) return parentLabel.innerText.trim().slice(0, 50);
    return field.placeholder || field.name || null;
  }

  function getFormInfo(form) {
    if (!form) return null;
    const inputs = form.querySelectorAll('input, select, textarea');
    const filledFields = Array.from(inputs).filter(f => f.value && f.value.trim() !== '').length;
    return {
      formId: form.id || null,
      formName: form.name || null,
      formAction: form.action || null,
      totalFields: inputs.length,
      filledFields: filledFields,
      completionRate: inputs.length > 0 ? Math.round((filledFields / inputs.length) * 100) : 0
    };
  }

  function startTrackingForm(form) {
    if (!form || activeForms.has(form)) return;
    
    activeForms.set(form, {
      startTime: Date.now(),
      fieldsInteracted: [],
      lastField: null,
      submitted: false
    });

    sendEvent('form_start', {
      ...getFormInfo(form)
    });
  }

  function trackFormFieldInteraction(field) {
    const form = field.closest('form');
    if (!form) return;

    // Start tracking if not already
    if (!activeForms.has(form)) {
      startTrackingForm(form);
    }

    const formData = activeForms.get(form);
    const fieldName = field.name || field.id || field.type;
    
    // Track field order
    if (!formData.fieldsInteracted.includes(fieldName)) {
      formData.fieldsInteracted.push(fieldName);
    }
    formData.lastField = {
      name: fieldName,
      label: getFieldLabel(field),
      type: field.type || field.tagName.toLowerCase()
    };

    // Check if previous field was skipped (left empty)
    const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
    const currentIndex = inputs.indexOf(field);
    
    if (currentIndex > 0) {
      const previousField = inputs[currentIndex - 1];
      const isSensitive = ['password'].includes(previousField.type);
      
      if (!isSensitive && !previousField.value && previousField.required !== false) {
        sendEvent('form_field_skip', {
          ...getFormInfo(form),
          skippedField: previousField.name || previousField.id || 'unknown',
          skippedFieldLabel: getFieldLabel(previousField),
          skippedFieldType: previousField.type || previousField.tagName.toLowerCase(),
          movedToField: fieldName
        });
      }
    }
  }

  function checkFormAbandonment(form, reason) {
    if (!form || !activeForms.has(form)) return;
    
    const formData = activeForms.get(form);
    
    // Don't report if already submitted
    if (formData.submitted) {
      activeForms.delete(form);
      return;
    }

    const formInfo = getFormInfo(form);
    
    // Only report abandonment if user actually interacted with the form
    if (formData.fieldsInteracted.length > 0 && formInfo.filledFields > 0) {
      sendEvent('form_abandonment', {
        ...formInfo,
        reason: reason,
        fieldsInteracted: formData.fieldsInteracted,
        lastFieldInteracted: formData.lastField?.name || null,
        lastFieldLabel: formData.lastField?.label || null,
        timeInForm: Date.now() - formData.startTime
      });
    }

    activeForms.delete(form);
  }

  function trackFormSubmit(form) {
    if (!form) return;
    
    if (activeForms.has(form)) {
      const formData = activeForms.get(form);
      formData.submitted = true;
      
      sendEvent('form_submit', {
        ...getFormInfo(form),
        fieldsInteracted: formData.fieldsInteracted.length,
        timeToComplete: Date.now() - formData.startTime
      });
      
      activeForms.delete(form);
    } else {
      sendEvent('form_submit', {
        ...getFormInfo(form)
      });
    }
  }

  // Watch for forms being removed from DOM (modal closed, etc.)
  function setupFormObserver() {
    if (formObserver) return;

    formObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.removedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          
          // Check if a tracked form was removed
          if (node.tagName === 'FORM' && activeForms.has(node)) {
            checkFormAbandonment(node, 'form_removed');
          }
          
          // Check if a container with a tracked form was removed
          const forms = node.querySelectorAll ? node.querySelectorAll('form') : [];
          forms.forEach(function(form) {
            if (activeForms.has(form)) {
              checkFormAbandonment(form, 'container_removed');
            }
          });
        });
      });
    });

    formObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Detect cancel/close button clicks
  function detectFormCancelClick(event) {
    const target = event.target;
    const buttonText = (target.innerText || target.value || '').toLowerCase();
    const buttonType = target.type?.toLowerCase();
    
    // Check if this looks like a cancel/close button
    const cancelPatterns = ['cancel', 'close', 'dismiss', 'nevermind', 'no thanks', 'not now', 'skip'];
    const isCancelButton = cancelPatterns.some(pattern => buttonText.includes(pattern)) ||
                          buttonType === 'reset' ||
                          target.classList.contains('close') ||
                          target.classList.contains('cancel') ||
                          target.getAttribute('data-dismiss') ||
                          target.getAttribute('aria-label')?.toLowerCase().includes('close');

    if (isCancelButton) {
      // Find the nearest form (could be in a modal/dialog)
      let container = target.closest('form, [role="dialog"], .modal, .dialog, [class*="modal"], [class*="dialog"]');
      let form = null;
      
      if (container?.tagName === 'FORM') {
        form = container;
      } else if (container) {
        form = container.querySelector('form');
      }
      
      // Also check parent containers
      if (!form) {
        const parents = [target.closest('.modal'), target.closest('.dialog'), target.closest('[role="dialog"]')];
        for (const parent of parents) {
          if (parent) {
            form = parent.querySelector('form');
            if (form) break;
          }
        }
      }

      if (form && activeForms.has(form)) {
        // Small delay to let form be removed if it will be
        setTimeout(function() {
          if (activeForms.has(form)) {
            checkFormAbandonment(form, 'cancel_clicked');
          }
        }, 100);
      }
    }
  }

  // ==========================================
  // FRUSTRATION SIGNAL DETECTION
  // ==========================================

  function detectRageClick(event) {
    const now = Date.now();
    const threshold = 500;
    const distanceThreshold = 50;
    const clickThreshold = 3;

    recentClicks.push({
      time: now,
      x: event.clientX,
      y: event.clientY,
      element: getElementSelector(event.target)
    });

    recentClicks = recentClicks.filter(c => now - c.time < threshold);

    if (recentClicks.length >= clickThreshold) {
      const firstClick = recentClicks[0];
      const allInSameArea = recentClicks.every(c => 
        Math.abs(c.x - firstClick.x) < distanceThreshold &&
        Math.abs(c.y - firstClick.y) < distanceThreshold
      );

      if (allInSameArea) {
        rageClickCount++;
        sendEvent('rage_click', {
          clickCount: recentClicks.length,
          timeWindow: now - firstClick.time,
          x: event.clientX,
          y: event.clientY,
          element: getElementSelector(event.target),
          elementPath: getElementPath(event.target),
          elementText: (event.target.innerText || '').slice(0, 100).trim(),
          totalRageClicks: rageClickCount
        });
        recentClicks = [];
        return true;
      }
    }
    return false;
  }

  function detectDeadClick(event) {
    const target = event.target;
    
    const looksClickable = (
      target.style.cursor === 'pointer' ||
      window.getComputedStyle(target).cursor === 'pointer' ||
      target.tagName.toLowerCase() === 'img' ||
      target.classList.contains('btn') ||
      target.classList.contains('button') ||
      target.classList.contains('link') ||
      target.classList.contains('clickable')
    );

    const isActuallyClickable = isClickableElement(target) || 
      target.closest('a, button, input, select, textarea, [role="button"]');

    if (looksClickable && !isActuallyClickable) {
      deadClickCount++;
      sendEvent('dead_click', {
        element: getElementSelector(target),
        elementPath: getElementPath(target),
        elementText: (target.innerText || '').slice(0, 100).trim(),
        x: event.clientX,
        y: event.clientY,
        totalDeadClicks: deadClickCount,
        reason: 'looks_clickable_but_not_interactive'
      });
      return true;
    }
    return false;
  }

  function detectMouseThrashing() {
    const now = Date.now();
    const windowMs = 1000;
    const threshold = 500;
    const directionChanges = 4;

    mouseMovements = mouseMovements.filter(m => now - m.time < windowMs);

    if (mouseMovements.length < 10) return false;

    let totalDistance = 0;
    let changes = 0;
    let lastDirection = null;

    for (let i = 1; i < mouseMovements.length; i++) {
      const prev = mouseMovements[i - 1];
      const curr = mouseMovements[i];
      
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);

      const direction = (dx > 0 ? 'R' : 'L') + (dy > 0 ? 'D' : 'U');
      if (lastDirection && direction !== lastDirection) {
        changes++;
      }
      lastDirection = direction;
    }

    if (totalDistance > threshold && changes >= directionChanges) {
      sendEvent('mouse_thrash', {
        totalDistance: Math.round(totalDistance),
        directionChanges: changes,
        duration: now - mouseMovements[0].time,
        movementCount: mouseMovements.length
      });
      mouseMovements = [];
      return true;
    }
    return false;
  }

  // ==========================================
  // STANDARD TRACKING
  // ==========================================

  // Check if auto-screenshot is enabled via data attribute
  const AUTO_SCREENSHOT = script?.getAttribute('data-auto-screenshot') === 'true';

  function trackPageView() {
    const eventData = {
      title: document.title,
      hash: window.location.hash || null,
      search: window.location.search || null
    };

    sendEvent('pageview', eventData);

    // Capture screenshot after page load if auto-screenshot is enabled
    if (AUTO_SCREENSHOT) {
      // Wait for page to fully render
      setTimeout(function() {
        captureAndSendPageviewScreenshot();
      }, 1500);
    }
  }

  function captureAndSendPageviewScreenshot() {
    // Check if captureScreenshot function is ready
    if (typeof captureScreenshot !== 'function') {
      // Retry after html2canvas loads
      loadHtml2Canvas(function(error) {
        if (!error) {
          captureScreenshot({ scale: 0.4, quality: 0.5 })
            .then(function(data) {
              return sendScreenshot(data, null);
            })
            .catch(function(err) {
              console.warn('[Behavioral Insights] Screenshot capture failed:', err.message);
            });
        }
      });
    } else {
      captureScreenshot({ scale: 0.4, quality: 0.5 })
        .then(function(data) {
          return sendScreenshot(data, null);
        })
        .catch(function(err) {
          console.warn('[Behavioral Insights] Screenshot capture failed:', err.message);
        });
    }
  }

  function trackClick(event) {
    clickCount++;
    const target = event.target;
    
    // Check for frustration signals
    const isRageClick = detectRageClick(event);
    const isDeadClick = !isRageClick && detectDeadClick(event);
    
    // Check for form cancel clicks
    detectFormCancelClick(event);
    
    const clickableParent = target.closest('a, button, [role="button"], input[type="submit"], input[type="button"]');
    
    const data = {
      elementType: target.tagName.toLowerCase(),
      elementSelector: getElementSelector(target),
      elementPath: getElementPath(target),
      elementText: (target.innerText || target.value || '').slice(0, 100).trim(),
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      isRageClick: isRageClick,
      isDeadClick: isDeadClick
    };

    if (clickableParent) {
      data.clickableType = clickableParent.tagName.toLowerCase();
      data.clickableText = (clickableParent.innerText || clickableParent.value || '').slice(0, 100).trim();
      if (clickableParent.href) {
        data.href = clickableParent.href;
        data.isExternal = clickableParent.hostname !== window.location.hostname;
      }
      if (clickableParent.name) data.elementName = clickableParent.name;
      if (clickableParent.id) data.elementId = clickableParent.id;
    }

    sendEvent('click', data);
  }

  function trackMouseMove(event) {
    const now = Date.now();
    
    if (mouseMovements.length > 0 && now - mouseMovements[mouseMovements.length - 1].time < 50) {
      return;
    }

    mouseMovements.push({
      time: now,
      x: event.clientX,
      y: event.clientY
    });

    mouseMovements = mouseMovements.filter(m => now - m.time < 2000);
    detectMouseThrashing();
    lastMousePosition = { x: event.clientX, y: event.clientY };
  }

  function trackScroll() {
    const depth = getScrollDepth();
    if (depth > maxScrollDepth) {
      maxScrollDepth = depth;
    }
    
    const milestones = [25, 50, 75, 90, 100];
    for (const milestone of milestones) {
      if (maxScrollDepth >= milestone && lastScrollDepthSent < milestone) {
        lastScrollDepthSent = milestone;
        sendEvent('scroll_milestone', { 
          depth: milestone,
          maxDepth: maxScrollDepth 
        });
        break;
      }
    }
  }

  function trackFormFocus(event) {
    const input = event.target;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(input.tagName)) return;
    
    trackFormFieldInteraction(input);

    // Don't track sensitive field values
    const sensitiveTypes = ['password', 'credit-card', 'cc-number', 'cc-exp', 'cc-csc'];
    const sensitiveNames = ['password', 'pwd', 'pass', 'credit', 'card', 'cvv', 'cvc', 'ssn', 'social'];
    
    const isSensitive = sensitiveTypes.includes(input.type) || 
      sensitiveNames.some(s => (input.name || '').toLowerCase().includes(s));
    
    if (!isSensitive && input.type !== 'password') {
      const form = input.closest('form');
      sendEvent('form_interact', {
        ...getFormInfo(form),
        fieldType: input.type || input.tagName.toLowerCase(),
        fieldName: input.name || null,
        fieldId: input.id || null,
        fieldLabel: getFieldLabel(input)
      });
    }
  }

  function trackFormSubmitEvent(event) {
    trackFormSubmit(event.target);
  }

  function trackVisibilityChange() {
    const now = Date.now();
    if (isVisible) {
      totalVisibleTime += now - lastVisibilityChange;
    }
    isVisible = !document.hidden;
    lastVisibilityChange = now;

    sendEvent('visibility', {
      hidden: document.hidden,
      visibleTime: totalVisibleTime,
      timeOnPage: now - pageEntryTime
    });
  }

  function trackMouseLeave(event) {
    if (event.clientY <= 5) {
      sendEvent('exit_intent', {
        timeOnPage: Date.now() - pageEntryTime,
        scrollDepth: maxScrollDepth,
        clickCount: clickCount,
        rageClickCount: rageClickCount,
        deadClickCount: deadClickCount
      });
    }
  }

  function trackPageExit() {
    const now = Date.now();
    if (isVisible) {
      totalVisibleTime += now - lastVisibilityChange;
    }

    // Check all active forms for abandonment
    activeForms.forEach(function(data, form) {
      if (!data.submitted) {
        checkFormAbandonment(form, 'page_exit');
      }
    });

    sendEvent('pageexit', {
      timeOnPage: now - pageEntryTime,
      activeTime: totalVisibleTime,
      maxScrollDepth: maxScrollDepth,
      clickCount: clickCount,
      interactionCount: interactionCount,
      rageClickCount: rageClickCount,
      deadClickCount: deadClickCount
    });
  }

  function trackNavigation(url, type) {
    sendEvent('navigation', {
      from: window.location.pathname,
      to: new URL(url, window.location.origin).pathname,
      type: type,
      timeOnPreviousPage: Date.now() - pageEntryTime
    });
  }

  function init() {
    trackPageView();
    setupFormObserver();

    document.addEventListener('click', trackClick, { passive: true, capture: true });
    document.addEventListener('mousemove', trackMouseMove, { passive: true });

    let scrollTimeout;
    window.addEventListener('scroll', function() {
      trackScroll();
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(function() {
        sendEvent('scroll', { 
          depth: maxScrollDepth,
          timeToScroll: Date.now() - pageEntryTime
        });
      }, 500);
    }, { passive: true });

    document.addEventListener('focusin', trackFormFocus, { passive: true, capture: true });
    document.addEventListener('submit', trackFormSubmitEvent, { passive: true, capture: true });
    document.addEventListener('visibilitychange', trackVisibilityChange);
    document.addEventListener('mouseleave', trackMouseLeave);

    window.addEventListener('beforeunload', trackPageExit);
    window.addEventListener('pagehide', trackPageExit);

    // SPA navigation
    const originalPushState = history.pushState;
    history.pushState = function(state, title, url) {
      if (url) trackNavigation(url, 'pushState');
      trackPageExit();
      originalPushState.apply(this, arguments);
      resetPageState();
      setTimeout(trackPageView, 0);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function(state, title, url) {
      if (url) trackNavigation(url, 'replaceState');
      originalReplaceState.apply(this, arguments);
    };

    window.addEventListener('popstate', function() {
      trackNavigation(window.location.href, 'popstate');
      trackPageExit();
      resetPageState();
      trackPageView();
    });

    window.addEventListener('hashchange', function(e) {
      sendEvent('hashchange', {
        oldHash: new URL(e.oldURL).hash,
        newHash: new URL(e.newURL).hash
      });
    });

    // Listen for Escape key (common way to close modals)
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        // Check if any modal with form might be closing
        setTimeout(function() {
          activeForms.forEach(function(data, form) {
            // If form is no longer visible, it was probably in a modal that closed
            if (!form.offsetParent && !data.submitted) {
              checkFormAbandonment(form, 'escape_pressed');
            }
          });
        }, 100);
      }
    });
  }

  function resetPageState() {
    pageEntryTime = Date.now();
    maxScrollDepth = 0;
    lastScrollDepthSent = 0;
    clickCount = 0;
    totalVisibleTime = 0;
    lastVisibilityChange = Date.now();
    isVisible = true;
    recentClicks = [];
    mouseMovements = [];
    deadClickCount = 0;
    rageClickCount = 0;
    
    // Check for form abandonments before reset
    activeForms.forEach(function(data, form) {
      if (!data.submitted) {
        checkFormAbandonment(form, 'page_navigation');
      }
    });
    activeForms.clear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ==========================================
  // SCREENSHOT CAPTURE
  // ==========================================

  let html2canvasLoaded = false;
  let html2canvasLoading = false;
  let pendingScreenshotCallbacks = [];

  function loadHtml2Canvas(callback) {
    if (html2canvasLoaded) {
      callback();
      return;
    }

    pendingScreenshotCallbacks.push(callback);

    if (html2canvasLoading) {
      return;
    }

    html2canvasLoading = true;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = function() {
      html2canvasLoaded = true;
      html2canvasLoading = false;
      pendingScreenshotCallbacks.forEach(function(cb) { cb(); });
      pendingScreenshotCallbacks = [];
    };
    script.onerror = function() {
      html2canvasLoading = false;
      pendingScreenshotCallbacks.forEach(function(cb) { cb(new Error('Failed to load html2canvas')); });
      pendingScreenshotCallbacks = [];
    };
    document.head.appendChild(script);
  }

  function captureScreenshot(options) {
    options = options || {};
    return new Promise(function(resolve, reject) {
      loadHtml2Canvas(function(error) {
        if (error) {
          reject(error);
          return;
        }

        // Hide sensitive elements before capture
        const sensitiveSelectors = [
          'input[type="password"]',
          '[data-sensitive]',
          '.sensitive',
          '[autocomplete="cc-number"]',
          '[autocomplete="cc-csc"]'
        ];
        const hiddenElements = [];
        sensitiveSelectors.forEach(function(selector) {
          document.querySelectorAll(selector).forEach(function(el) {
            if (el.style.visibility !== 'hidden') {
              hiddenElements.push({ el: el, visibility: el.style.visibility });
              el.style.visibility = 'hidden';
            }
          });
        });

        window.html2canvas(document.body, {
          scale: options.scale || 0.5, // Reduce size
          logging: false,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: window.innerWidth,
          height: Math.min(document.body.scrollHeight, window.innerHeight * 2), // Limit height
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          x: window.scrollX,
          y: window.scrollY
        }).then(function(canvas) {
          // Restore hidden elements
          hiddenElements.forEach(function(item) {
            item.el.style.visibility = item.visibility;
          });

          // Convert to JPEG for smaller size
          const imageData = canvas.toDataURL('image/jpeg', options.quality || 0.6);
          resolve({
            imageData: imageData,
            width: canvas.width,
            height: canvas.height,
            url: window.location.href,
            path: window.location.pathname,
            timestamp: new Date().toISOString()
          });
        }).catch(function(err) {
          // Restore hidden elements on error
          hiddenElements.forEach(function(item) {
            item.el.style.visibility = item.visibility;
          });
          reject(err);
        });
      });
    });
  }

  function sendScreenshot(screenshotData, eventId) {
    const payload = {
      siteId: SITE_ID,
      sessionId: sessionId,
      visitorId: getVisitorId(),
      eventId: eventId || null,
      ...screenshotData,
      deviceType: getDeviceType()
    };

    return fetch(SCREENSHOT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(res) {
      return res.json();
    });
  }

  // Public API
  window.BehavioralInsights = {
    track: function(eventName, data) { 
      sendEvent('custom', { name: eventName, ...data }); 
    },
    identify: function(userId, traits) { 
      sendEvent('identify', { userId: userId, traits: traits }); 
    },
    getSessionId: function() {
      return sessionId;
    },
    getVisitorId: function() {
      return getVisitorId();
    },
    getFrustrationStats: function() {
      return {
        rageClicks: rageClickCount,
        deadClicks: deadClickCount,
        activeForms: activeForms.size
      };
    },
    // Manual form abandonment trigger (for custom implementations)
    reportFormAbandonment: function(formElement, reason) {
      if (formElement) {
        checkFormAbandonment(formElement, reason || 'manual');
      }
    },
    // Screenshot capture API
    captureScreenshot: function(options) {
      return captureScreenshot(options);
    },
    // Capture and send screenshot to server
    takeScreenshot: function(eventId, options) {
      return captureScreenshot(options).then(function(data) {
        return sendScreenshot(data, eventId);
      });
    }
  };

  // Listen for screenshot requests from the analytics dashboard
  window.addEventListener('message', function(event) {
    // Verify origin matches the tracker script origin
    const scriptOrigin = new URL(script?.src || window.location.href).origin;

    if (event.data && event.data.type === 'BI_SCREENSHOT_REQUEST') {
      const requestId = event.data.requestId;
      const eventId = event.data.eventId;

      captureScreenshot(event.data.options || {})
        .then(function(data) {
          return sendScreenshot(data, eventId);
        })
        .then(function(result) {
          window.parent.postMessage({
            type: 'BI_SCREENSHOT_RESPONSE',
            requestId: requestId,
            success: true,
            data: result
          }, '*');
        })
        .catch(function(error) {
          window.parent.postMessage({
            type: 'BI_SCREENSHOT_RESPONSE',
            requestId: requestId,
            success: false,
            error: error.message
          }, '*');
        });
    }
  });
})();

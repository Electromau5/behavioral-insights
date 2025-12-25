/**
 * Behavioral Insights Tracker - Enhanced with Frustration Signal Detection
 */
(function() {
  'use strict';

  const script = document.currentScript;
  const SITE_ID = script?.getAttribute('data-site-id');
  const API_URL = script?.src.replace('/tracker.js', '/api/collect');
  
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
  let recentClicks = []; // { time, x, y, element }
  let mouseMovements = []; // { time, x, y }
  let lastMousePosition = { x: 0, y: 0 };
  let formFieldsInteracted = []; // Track form field order
  let lastFormField = null;
  let deadClickCount = 0;
  let rageClickCount = 0;

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
  // FRUSTRATION SIGNAL DETECTION
  // ==========================================

  function detectRageClick(event) {
    const now = Date.now();
    const threshold = 500; // 500ms window
    const distanceThreshold = 50; // pixels
    const clickThreshold = 3; // 3+ clicks = rage click

    recentClicks.push({
      time: now,
      x: event.clientX,
      y: event.clientY,
      element: getElementSelector(event.target)
    });

    // Remove clicks older than threshold
    recentClicks = recentClicks.filter(c => now - c.time < threshold);

    // Check if we have enough rapid clicks in same area
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
        recentClicks = []; // Reset after detecting
        return true;
      }
    }
    return false;
  }

  function detectDeadClick(event) {
    const target = event.target;
    
    // Check if element looks clickable but isn't actually interactive
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
    const windowMs = 1000; // 1 second window
    const threshold = 500; // Total distance threshold for "chaotic"
    const directionChanges = 4; // Minimum direction changes

    // Keep only recent movements
    mouseMovements = mouseMovements.filter(m => now - m.time < windowMs);

    if (mouseMovements.length < 10) return false;

    // Calculate total distance and direction changes
    let totalDistance = 0;
    let changes = 0;
    let lastDirection = null;

    for (let i = 1; i < mouseMovements.length; i++) {
      const prev = mouseMovements[i - 1];
      const curr = mouseMovements[i];
      
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);

      // Determine direction (simplified to 4 quadrants)
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
      mouseMovements = []; // Reset after detecting
      return true;
    }
    return false;
  }

  function trackFormFieldAbandonment(currentField) {
    if (lastFormField && lastFormField !== currentField) {
      const fieldInfo = {
        fieldName: lastFormField.name || lastFormField.id || 'unknown',
        fieldType: lastFormField.type || lastFormField.tagName.toLowerCase(),
        fieldLabel: getFieldLabel(lastFormField),
        wasEmpty: !lastFormField.value || lastFormField.value.trim() === '',
        nextField: currentField ? (currentField.name || currentField.id || 'unknown') : 'none'
      };

      // Track field order for form abandonment analysis
      const fieldId = fieldInfo.fieldName || fieldInfo.fieldType;
      if (!formFieldsInteracted.includes(fieldId)) {
        formFieldsInteracted.push(fieldId);
      }

      // If field was left empty, it might be a friction point
      if (fieldInfo.wasEmpty) {
        sendEvent('form_field_skip', {
          ...fieldInfo,
          fieldOrder: formFieldsInteracted.length,
          formId: lastFormField.closest('form')?.id || null,
          formName: lastFormField.closest('form')?.name || null
        });
      }
    }
    lastFormField = currentField;
  }

  function getFieldLabel(field) {
    // Try to find associated label
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label.innerText.trim().slice(0, 50);
    }
    // Check for parent label
    const parentLabel = field.closest('label');
    if (parentLabel) return parentLabel.innerText.trim().slice(0, 50);
    // Use placeholder or name
    return field.placeholder || field.name || null;
  }

  function trackFormAbandonment() {
    // Called on page exit - check if user was in a form
    const activeForm = document.activeElement?.closest('form');
    if (activeForm || formFieldsInteracted.length > 0) {
      const form = activeForm || document.querySelector('form');
      if (form) {
        const totalFields = form.querySelectorAll('input, select, textarea').length;
        const filledFields = Array.from(form.querySelectorAll('input, select, textarea'))
          .filter(f => f.value && f.value.trim() !== '').length;

        if (filledFields > 0 && filledFields < totalFields) {
          // Form was partially filled but not submitted
          sendEvent('form_abandonment', {
            formId: form.id || null,
            formName: form.name || null,
            formAction: form.action || null,
            totalFields: totalFields,
            filledFields: filledFields,
            fieldsInteracted: formFieldsInteracted,
            lastFieldInteracted: lastFormField ? (lastFormField.name || lastFormField.id) : null,
            completionRate: Math.round((filledFields / totalFields) * 100),
            timeInForm: Date.now() - pageEntryTime
          });
        }
      }
    }
  }

  // ==========================================
  // STANDARD TRACKING
  // ==========================================

  function trackPageView() {
    sendEvent('pageview', { 
      title: document.title,
      hash: window.location.hash || null,
      search: window.location.search || null
    });
  }

  function trackClick(event) {
    clickCount++;
    const target = event.target;
    
    // Check for frustration signals first
    const isRageClick = detectRageClick(event);
    const isDeadClick = !isRageClick && detectDeadClick(event);
    
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
    
    // Throttle: only track every 50ms
    if (mouseMovements.length > 0 && now - mouseMovements[mouseMovements.length - 1].time < 50) {
      return;
    }

    mouseMovements.push({
      time: now,
      x: event.clientX,
      y: event.clientY
    });

    // Keep only last 2 seconds of movements
    mouseMovements = mouseMovements.filter(m => now - m.time < 2000);

    // Check for mouse thrashing
    detectMouseThrashing();

    lastMousePosition = { x: event.clientX, y: event.clientY };
  }

  function trackScroll() {
    const depth = getScrollDepth();
    if (depth > maxScrollDepth) {
      maxScrollDepth = depth;
    }
    
    // Send scroll event at 25%, 50%, 75%, 90%, 100% milestones
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

  function trackFormInteraction(event) {
    const input = event.target;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(input.tagName)) return;
    
    const form = input.closest('form');

    // Track field abandonment
    trackFormFieldAbandonment(input);

    const data = {
      formId: form?.id || null,
      formName: form?.name || null,
      formAction: form?.action || null,
      fieldType: input.type || input.tagName.toLowerCase(),
      fieldName: input.name || null,
      fieldId: input.id || null,
      fieldPlaceholder: input.placeholder || null,
      fieldLabel: getFieldLabel(input),
      fieldOrder: formFieldsInteracted.length
    };

    // Don't track sensitive fields
    const sensitiveTypes = ['password', 'credit-card', 'cc-number', 'cc-exp', 'cc-csc'];
    const sensitiveNames = ['password', 'pwd', 'pass', 'credit', 'card', 'cvv', 'cvc', 'ssn', 'social'];
    
    const isSensitive = sensitiveTypes.includes(input.type) || 
      sensitiveNames.some(s => (input.name || '').toLowerCase().includes(s));
    
    if (!isSensitive && input.type !== 'password') {
      sendEvent('form_interact', data);
    }
  }

  function trackFormSubmit(event) {
    const form = event.target;
    sendEvent('form_submit', {
      formId: form.id || null,
      formName: form.name || null,
      formAction: form.action || null,
      fieldCount: form.elements.length,
      fieldsInteracted: formFieldsInteracted.length,
      timeToComplete: Date.now() - pageEntryTime
    });
    
    // Reset form tracking
    formFieldsInteracted = [];
    lastFormField = null;
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
    // Track when user moves mouse to top of page (potential exit intent)
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

    // Check for form abandonment
    trackFormAbandonment();

    sendEvent('pageexit', {
      timeOnPage: now - pageEntryTime,
      activeTime: totalVisibleTime,
      maxScrollDepth: maxScrollDepth,
      clickCount: clickCount,
      interactionCount: interactionCount,
      rageClickCount: rageClickCount,
      deadClickCount: deadClickCount,
      formFieldsInteracted: formFieldsInteracted.length
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
    // Track initial page view
    trackPageView();

    // Track all clicks
    document.addEventListener('click', trackClick, { passive: true, capture: true });

    // Track mouse movement for thrashing detection
    document.addEventListener('mousemove', trackMouseMove, { passive: true });

    // Track scrolling with debounce
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

    // Track form interactions
    document.addEventListener('focus', trackFormInteraction, { passive: true, capture: true });
    document.addEventListener('blur', function(event) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
        trackFormFieldAbandonment(null); // Field lost focus
      }
    }, { passive: true, capture: true });
    document.addEventListener('submit', trackFormSubmit, { passive: true, capture: true });

    // Track visibility changes (tab switching)
    document.addEventListener('visibilitychange', trackVisibilityChange);

    // Track exit intent
    document.addEventListener('mouseleave', trackMouseLeave);

    // Track page exit
    window.addEventListener('beforeunload', trackPageExit);
    window.addEventListener('pagehide', trackPageExit);

    // Track SPA navigation
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

    // Track hash changes
    window.addEventListener('hashchange', function(e) {
      sendEvent('hashchange', {
        oldHash: new URL(e.oldURL).hash,
        newHash: new URL(e.newURL).hash
      });
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
    formFieldsInteracted = [];
    lastFormField = null;
    deadClickCount = 0;
    rageClickCount = 0;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
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
        formFieldsSkipped: formFieldsInteracted.length
      };
    }
  };
})();

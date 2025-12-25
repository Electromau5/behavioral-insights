/**
 * Behavioral Insights Tracker - Enhanced with Full User Flow Tracking
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
    const clickableParent = target.closest('a, button, [role="button"], input[type="submit"], input[type="button"]');
    
    const data = {
      elementType: target.tagName.toLowerCase(),
      elementSelector: getElementSelector(target),
      elementPath: getElementPath(target),
      elementText: (target.innerText || target.value || '').slice(0, 100).trim(),
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY
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
    const form = event.target.closest('form');
    const input = event.target;
    
    if (!form && !['INPUT', 'TEXTAREA', 'SELECT'].includes(input.tagName)) return;

    const data = {
      formId: form?.id || null,
      formName: form?.name || null,
      formAction: form?.action || null,
      fieldType: input.type || input.tagName.toLowerCase(),
      fieldName: input.name || null,
      fieldId: input.id || null,
      fieldPlaceholder: input.placeholder || null
    };

    // Don't track sensitive fields
    const sensitiveTypes = ['password', 'credit-card', 'cc-number', 'cc-exp', 'cc-csc'];
    const sensitiveNames = ['password', 'pwd', 'pass', 'credit', 'card', 'cvv', 'cvc', 'ssn', 'social'];
    
    const isSensitive = sensitiveTypes.includes(input.type) || 
      sensitiveNames.some(s => (input.name || '').toLowerCase().includes(s));
    
    if (!isSensitive && input.type !== 'password') {
      // Only track that field was interacted with, not the value
      sendEvent('form_interact', data);
    }
  }

  function trackFormSubmit(event) {
    const form = event.target;
    sendEvent('form_submit', {
      formId: form.id || null,
      formName: form.name || null,
      formAction: form.action || null,
      fieldCount: form.elements.length
    });
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
        clickCount: clickCount
      });
    }
  }

  function trackPageExit() {
    const now = Date.now();
    if (isVisible) {
      totalVisibleTime += now - lastVisibilityChange;
    }

    sendEvent('pageexit', {
      timeOnPage: now - pageEntryTime,
      activeTime: totalVisibleTime,
      maxScrollDepth: maxScrollDepth,
      clickCount: clickCount,
      interactionCount: interactionCount
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
    }
  };
})();

/**
 * Behavioral Insights Tracker
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
    const payload = { ...collectBaseData(), eventType, eventData: eventData || {} };
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
    sendEvent('pageview', { title: document.title });
  }

  function trackClick(event) {
    clickCount++;
    const target = event.target.closest('a, button, [role="button"]');
    if (target) {
      sendEvent('click', {
        elementType: target.tagName.toLowerCase(),
        elementText: (target.innerText || '').slice(0, 100),
        href: target.href || null,
      });
    }
  }

  function trackScroll() {
    const depth = getScrollDepth();
    if (depth > maxScrollDepth) maxScrollDepth = depth;
  }

  function trackPageExit() {
    const now = Date.now();
    if (isVisible) totalVisibleTime += now - lastVisibilityChange;
    sendEvent('pageexit', {
      timeOnPage: now - pageEntryTime,
      activeTime: totalVisibleTime,
      maxScrollDepth: maxScrollDepth,
      clickCount: clickCount
    });
  }

  function init() {
    trackPageView();
    document.addEventListener('click', trackClick, { passive: true });
    var scrollTimeout;
    window.addEventListener('scroll', function() {
      trackScroll();
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(function() {
        if (maxScrollDepth > 0) sendEvent('scroll', { depth: maxScrollDepth });
      }, 1000);
    }, { passive: true });
    window.addEventListener('beforeunload', trackPageExit);
    window.addEventListener('pagehide', trackPageExit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.BehavioralInsights = {
    track: function(eventName, data) { sendEvent('custom', { name: eventName, ...data }); },
    identify: function(userId, traits) { sendEvent('identify', { userId: userId, traits: traits }); }
  };
})();

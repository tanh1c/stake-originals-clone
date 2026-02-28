"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getFocusNodeList = getFocusNodeList;
exports.lockFocus = lockFocus;
exports.triggerFocus = triggerFocus;
exports.useLockFocus = useLockFocus;
var _react = require("react");
var _isVisible = _interopRequireDefault(require("./isVisible"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function focusable(node, includePositive = false) {
  if ((0, _isVisible.default)(node)) {
    const nodeName = node.nodeName.toLowerCase();
    const isFocusableElement =
    // Focusable element
    ['input', 'select', 'textarea', 'button'].includes(nodeName) ||
    // Editable element
    node.isContentEditable ||
    // Anchor with href element
    nodeName === 'a' && !!node.getAttribute('href');

    // Get tabIndex
    const tabIndexAttr = node.getAttribute('tabindex');
    const tabIndexNum = Number(tabIndexAttr);

    // Parse as number if validate
    let tabIndex = null;
    if (tabIndexAttr && !Number.isNaN(tabIndexNum)) {
      tabIndex = tabIndexNum;
    } else if (isFocusableElement && tabIndex === null) {
      tabIndex = 0;
    }

    // Block focusable if disabled
    if (isFocusableElement && node.disabled) {
      tabIndex = null;
    }
    return tabIndex !== null && (tabIndex >= 0 || includePositive && tabIndex < 0);
  }
  return false;
}
function getFocusNodeList(node, includePositive = false) {
  const res = [...node.querySelectorAll('*')].filter(child => {
    return focusable(child, includePositive);
  });
  if (focusable(node, includePositive)) {
    res.unshift(node);
  }
  return res;
}
// Used for `rc-input` `rc-textarea` `rc-input-number`
/**
 * Focus element and set cursor position for input/textarea elements.
 */
function triggerFocus(element, option) {
  if (!element) return;
  element.focus(option);

  // Selection content
  const {
    cursor
  } = option || {};
  if (cursor && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    const len = element.value.length;
    switch (cursor) {
      case 'start':
        element.setSelectionRange(0, 0);
        break;
      case 'end':
        element.setSelectionRange(len, len);
        break;
      default:
        element.setSelectionRange(0, len);
    }
  }
}

// ======================================================
// ==                    Lock Focus                    ==
// ======================================================
let lastFocusElement = null;
let focusElements = [];
function getLastElement() {
  return focusElements[focusElements.length - 1];
}
function hasFocus(element) {
  const {
    activeElement
  } = document;
  return element === activeElement || element.contains(activeElement);
}
function syncFocus() {
  const lastElement = getLastElement();
  const {
    activeElement
  } = document;
  if (lastElement && !hasFocus(lastElement)) {
    const focusableList = getFocusNodeList(lastElement);
    const matchElement = focusableList.includes(lastFocusElement) ? lastFocusElement : focusableList[0];
    matchElement?.focus();
  } else {
    lastFocusElement = activeElement;
  }
}
function onWindowKeyDown(e) {
  if (e.key === 'Tab') {
    const {
      activeElement
    } = document;
    const lastElement = getLastElement();
    const focusableList = getFocusNodeList(lastElement);
    const last = focusableList[focusableList.length - 1];
    if (e.shiftKey && activeElement === focusableList[0]) {
      // Tab backward on first focusable element
      lastFocusElement = last;
    } else if (!e.shiftKey && activeElement === last) {
      // Tab forward on last focusable element
      lastFocusElement = focusableList[0];
    }
  }
}

/**
 * Lock focus in the element.
 * It will force back to the first focusable element when focus leaves the element.
 */
function lockFocus(element) {
  if (element) {
    // Refresh focus elements
    focusElements = focusElements.filter(ele => ele !== element);
    focusElements.push(element);

    // Just add event since it will de-duplicate
    window.addEventListener('focusin', syncFocus);
    window.addEventListener('keydown', onWindowKeyDown, true);
    syncFocus();
  }

  // Always return unregister function
  return () => {
    lastFocusElement = null;
    focusElements = focusElements.filter(ele => ele !== element);
    if (focusElements.length === 0) {
      window.removeEventListener('focusin', syncFocus);
      window.removeEventListener('keydown', onWindowKeyDown, true);
    }
  };
}

/**
 * Lock focus within an element.
 * When locked, focus will be restricted to focusable elements within the specified element.
 * If multiple elements are locked, only the last locked element will be effective.
 */
function useLockFocus(lock, getElement) {
  (0, _react.useEffect)(() => {
    if (lock) {
      const element = getElement();
      if (element) {
        return lockFocus(element);
      }
    }
  }, [lock]);
}
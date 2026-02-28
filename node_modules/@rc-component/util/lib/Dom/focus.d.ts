export declare function getFocusNodeList(node: HTMLElement, includePositive?: boolean): HTMLElement[];
export interface InputFocusOptions extends FocusOptions {
    cursor?: 'start' | 'end' | 'all';
}
/**
 * Focus element and set cursor position for input/textarea elements.
 */
export declare function triggerFocus(element?: HTMLElement, option?: InputFocusOptions): void;
/**
 * Lock focus in the element.
 * It will force back to the first focusable element when focus leaves the element.
 */
export declare function lockFocus(element: HTMLElement): VoidFunction;
/**
 * Lock focus within an element.
 * When locked, focus will be restricted to focusable elements within the specified element.
 * If multiple elements are locked, only the last locked element will be effective.
 */
export declare function useLockFocus(lock: boolean, getElement: () => HTMLElement | null): void;

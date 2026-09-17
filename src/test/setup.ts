import "@testing-library/jest-dom";

// jsdom does not implement the Pointer Capture API, which Radix primitives
// (Select, Dialog, Switch, …) rely on. Without these stubs any pointer
// interaction throws "hasPointerCapture is not a function".
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
// jsdom has no PointerEvent — Radix opens on pointerdown and reads event.button.
if (!window.PointerEvent) {
  window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

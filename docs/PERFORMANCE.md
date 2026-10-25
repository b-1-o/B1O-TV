# TV Performance Guide

B1O TV targets a premium, animated interface without continuous background work or costly full-screen effects on Samsung Tizen.

## Runtime principles

- Keep visual transitions short on TV and animate opacity/transform rather than blur filters.
- Preserve the glass appearance with layered translucent fills and gradients instead of live backdrop blur.
- Stop the Home clock and timer display intervals when the app is hidden.
- Keep countdown ticks inside the small countdown component instead of rerendering the entire dashboard every second.
- Update adaptive scenery at hour boundaries, not on every clock tick.
- Avoid synchronous style reads in frequent remote-control handlers; inspect computed visibility only for a candidate that is actually below the current focus.
- Resolve playlist IDs through a lookup map rather than repeatedly scanning the entire track list.

## Verify on a real TV

Run the production build and install the generated web project on the target Samsung TV. Use Samsung Tizen Web Inspector when the TV and development computer are connected:

1. Capture a performance profile during repeated left/right/up/down navigation.
2. Check the Elements/Rendering tools while moving focus through Home, Apps, Settings, and SelfMusic.
3. Compare the performance profile before and after opening/closing the assistant and forecast overlay.
4. Observe memory after opening several views and playing multiple tracks; repeat the same sequence after a fresh app launch.
5. Test a 30–60 minute session to detect slowdowns that a short test may miss.
6. Repeat with the TV app sent to the background and restored.

## Acceptance checklist

- Focus moves without noticeable delay or skipped input.
- View changes retain a short entrance/exit animation without a blur pulse.
- The visual style remains monochrome and glass-like without live backdrop blur.
- Timer ticks do not force the whole dashboard to render once per second.
- The Home clock stops ticking while the app is hidden.
- The app resumes with correct time, focus, and countdown state.
- Memory and frame-rate results are recorded from the real TV before claiming measured performance improvements.

The performance policy is a set of code-level optimizations, not a benchmark claim. Results must be measured on the target firmware because Samsung TV WebViews and device memory limits vary by model and Tizen version.

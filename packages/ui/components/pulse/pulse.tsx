import { useEffect, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { InfoIcon } from 'lucide-react';
import type { SileoOptions } from 'sileo';
import { Toaster, sileo } from 'sileo';
import 'sileo/styles.css';

import './pulse.css';
import { playPulseSound } from './sound';

/**
 * Pulse — dynamic toasts shared with the Caring Data React app.
 *
 * Ported from caring_data_react (src/caringdata-ui/Pulse/Pulse.tsx) so the
 * embedded editor shows the same alerts as the React app hosting it. Keep both
 * copies in sync. Opt-in: only screens that mount <PulseToaster /> use it; the
 * rest of Documenso keeps the regular `useToast`.
 *
 * Controlled public API: Pulse only accepts the params we expose (title,
 * description, action, position, …). Everything else (duration, icon, fill,
 * autopilot, type) is owned by Pulse internally.
 *
 *   Pulse.success({ title: 'Template saved' })
 *   Pulse.error({ title: 'Could not save', description: 'Check the connection' })
 *   Pulse.promise(savePromise, { loading, success, error })
 *
 * Mount <PulseToaster /> once in the screen that uses it.
 */
export const PULSE_POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

export type PulsePosition = (typeof PULSE_POSITIONS)[number];

const DEFAULT_POSITION: PulsePosition = 'bottom-right';

/** Action button shown inside a toast (e.g. "Undo", "Retry"). */
export type PulseAction = {
  label: string;
  onClick: () => void;
};

/**
 * The ONLY options Pulse accepts per toast. Intentionally a small, owned
 * surface — not Sileo's full SileoOptions. Add fields here deliberately.
 */
export type PulseOptions = {
  /**
   * Stable id for the toast. Fire again with the same id to update that toast
   * in place instead of stacking a new one. Omit for a normal one-off toast.
   */
  id?: string;
  /** Main line of the toast. */
  title: string;
  /** Optional secondary line. Accepts plain text or JSX. */
  description?: ReactNode;
  /** Optional action button (Undo / Retry / …). */
  action?: PulseAction;
  /** Override the toast position. Defaults to the Toaster's position. */
  position?: PulsePosition;
  /** Play a short synthetic chime when the toast appears. Off by default. */
  sound?: boolean;
  /** Keep the toast on screen until dismissed, overriding the variant's timeout. */
  persistent?: boolean;
};

type PulseVariant = 'success' | 'error' | 'warning' | 'info' | 'action';

/** Per-variant duration in ms. Errors get more reading time; hover pauses the timer. */
const VARIANT_DURATION: Record<PulseVariant, number | null> = {
  success: 4000,
  info: 5000,
  warning: 7000,
  error: 8000,
  action: 9000,
};

/** Per-variant icon overrides. Variants not listed keep Sileo's default icon. */
const VARIANT_ICON: Partial<Record<PulseVariant, ReactNode>> = {
  info: <InfoIcon size={15} />,
};

/* ------------------- Toast id lifecycle (anti-collision) ------------------ */
/**
 * Sileo's dismiss() arms a 600ms removal timer that filters toasts BY ID, and
 * createToast() reuses the id you pass (or 'sileo-default' when you pass none).
 * Firing a toast with the same id inside that exit window gets it silently
 * killed ~600ms after it appears.
 *
 * Pulse maps every public id to a generation-suffixed physical id: while the
 * current toast is alive, re-firing reuses it (in-place morph); once it's
 * exiting or gone, the next fire gets a fresh id no stale timer can touch.
 */
const ANONYMOUS_ID = 'sileo-default';
const idGeneration = new Map<string, number>();

/** Physical ids fired but possibly not rendered yet (see Pulse.tsx in the React app). */
const uncommitted = new Set<string>();

const physicalId = (logical: string): string => {
  const generation = idGeneration.get(logical) ?? 0;

  return generation === 0 ? logical : `${logical}~${generation}`;
};

/** The next fire with this logical id must get a fresh physical id. */
const retireId = (logical: string) => {
  idGeneration.set(logical, (idGeneration.get(logical) ?? 0) + 1);
};

/** Whether the current physical toast is still mounted (or about to be) and not exiting. */
const isAlive = (logical: string): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }

  const id = physicalId(logical);
  const element = document.getElementById(`sileo-gooey-${id}`)?.closest('[data-sileo-toast]');

  if (!element) {
    return uncommitted.has(id);
  }

  uncommitted.delete(id);

  return element.getAttribute('data-exiting') !== 'true';
};

/** Physical id for a new fire: reuse while alive, else fresh. Call exactly once per fire. */
const nextPhysicalId = (logical: string, isExplicit: boolean): string => {
  if (!isAlive(logical)) {
    retireId(logical);
  }

  const id = physicalId(logical);

  if (isExplicit) {
    uncommitted.add(id);
  }

  return id;
};

/** Translate our small PulseOptions into the full SileoOptions we control. */
const toSileo = (variant: PulseVariant, opts: PulseOptions, id: string): SileoOptions => {
  const icon = VARIANT_ICON[variant];

  // `id` lives outside Sileo's public type but its runtime matches on it.
  const sileoOpts: SileoOptions & { id: string } = {
    type: variant,
    title: opts.title,
    id,
    duration: opts.persistent ? null : VARIANT_DURATION[variant],
    ...(icon !== undefined ? { icon } : {}),
    ...(opts.description !== undefined ? { description: opts.description } : {}),
    ...(opts.position !== undefined ? { position: opts.position } : {}),
    ...(opts.action ? { button: { title: opts.action.label, onClick: opts.action.onClick } } : {}),
    // Tag a button with no description above it so pulse.css can drop the extra gap.
    ...(opts.action && opts.description === undefined
      ? { styles: { button: 'pulse-button--solo' } }
      : {}),
  };

  return sileoOpts;
};

type PulseSettledState = Pick<PulseOptions, 'title' | 'description' | 'action'>;

/** Options for promise toasts — same controlled surface, per state. */
export type PulsePromiseOptions<T = unknown> = {
  loading: Pick<PulseOptions, 'title' | 'description'>;
  success: PulseSettledState | ((data: T) => PulseSettledState);
  error: PulseSettledState | ((err: unknown) => PulseSettledState);
  position?: PulsePosition;
  /** Stable id for a repeatable action, so re-running it morphs the live toast. */
  id?: string;
};

/** Fire a variant toast (plus its chime when `sound: true`). Returns the LOGICAL id. */
const emit = (
  variant: PulseVariant,
  fire: (options: SileoOptions) => string,
  opts: PulseOptions,
): string => {
  const logical = opts.id ?? ANONYMOUS_ID;

  fire(toSileo(variant, opts, nextPhysicalId(logical, opts.id !== undefined)));

  if (opts.sound) {
    playPulseSound(variant);
  }

  return logical;
};

let promiseSeq = 0;

/** Controlled Pulse facade. Each method returns the toast id (for dismiss). */
export const Pulse = {
  success: (opts: PulseOptions): string => emit('success', sileo.success, opts),
  error: (opts: PulseOptions): string => emit('error', sileo.error, opts),
  warning: (opts: PulseOptions): string => emit('warning', sileo.warning, opts),
  info: (opts: PulseOptions): string => emit('info', sileo.info, opts),
  action: (opts: PulseOptions): string => emit('action', sileo.action, opts),
  promise: async <T,>(
    promise: Promise<T> | (() => Promise<T>),
    opts: PulsePromiseOptions<T>,
  ): Promise<T> => {
    const promiseId =
      opts.id !== undefined ? nextPhysicalId(opts.id, true) : `pulse-promise-${++promiseSeq}`;

    const settled = (variant: 'success' | 'error', state: PulseSettledState): SileoOptions =>
      toSileo(variant, state, promiseId);

    const { success, error } = opts;

    return await sileo.promise(promise, {
      ...(opts.position !== undefined ? { position: opts.position } : {}),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      loading: { type: 'loading', id: promiseId, ...opts.loading } as SileoOptions,
      success:
        typeof success === 'function'
          ? (data: T) => settled('success', success(data))
          : settled('success', success),
      error:
        typeof error === 'function'
          ? (err: unknown) => settled('error', error(err))
          : settled('error', error),
    });
  },
  dismiss: (id: string) => {
    const current = physicalId(id);

    sileo.dismiss(current);
    uncommitted.delete(current);
    retireId(id);
  },
  clear: (position?: PulsePosition) => {
    uncommitted.clear();
    sileo.clear(position);
  },
};

export type PulseTheme = 'light' | 'dark' | 'system';

/** Distance (px) the toasts keep from each viewport edge. */
export type PulseOffset = number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;

const DEFAULT_OFFSET: PulseOffset = { right: 65, bottom: 10, top: 24, left: 24 };

export type PulseToasterProps = {
  /** Default position for all toasts. Defaults to bottom-right. */
  position?: PulsePosition;
  /** Theme for the toasts. Defaults to 'system'. */
  theme?: PulseTheme;
  /** Gap (px) from the viewport edges. A number applies to all sides. */
  offset?: PulseOffset;
};

type SileoToasterProps = ComponentProps<typeof Toaster>;

/**
 * `collapse: 0` disables Sileo's auto-collapse timer, which collapses toasts
 * under the cursor and makes them "tremble". Toasts expand once and only
 * collapse on a real mouse-leave.
 */
const AUTOPILOT = { expand: 150, collapse: 0 } as const;

/** Pulse keeps a white surface in both themes (team choice 2026-07-07). */
const THEME_FILL: Record<'light' | 'dark', string> = {
  light: '#ffffff',
  dark: '#ffffff',
};

/** Safari-only toast shadow, applied inside the gooey filter. */
const SAFARI_SHADOW: Record<
  'light' | 'dark',
  Array<{ dy: number; blur: number; opacity: number }>
> = {
  light: [
    { dy: 4, blur: 3, opacity: 0.16 },
    { dy: 0, blur: 3, opacity: 0.14 },
  ],
  dark: [{ dy: 6, blur: 8, opacity: 0.5 }],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export const PulseToaster = ({
  position = DEFAULT_POSITION,
  theme = 'system',
  offset = DEFAULT_OFFSET,
}: PulseToasterProps) => {
  const resolvedTheme = resolveTheme(theme);
  const repairRef = useSwipeCancelRepair();
  const gooeyRef = useGooeyFilterRepairForSafari(isWebKit(), resolvedTheme);

  const props: SileoToasterProps = {
    position,
    theme,
    offset,
    options: { fill: THEME_FILL[resolvedTheme], autopilot: AUTOPILOT },
  };

  // Both repairs observe the same wrapper (Sileo renders toasts inside it, no portal).
  const setWrapper = (node: HTMLDivElement | null) => {
    repairRef.current = node;
    gooeyRef.current = node;
  };

  return (
    <div ref={setWrapper} {...(isWindows() ? { 'data-pulse-calm-motion': true } : {})}>
      <Toaster {...props} />
    </div>
  );
};

/**
 * Repair Sileo's swipe-to-dismiss when a drag is cancelled: on `pointercancel`
 * replay a synthetic `pointerup` at the press origin so the toast resets
 * instead of staying stuck at its dragged offset.
 */
const useSwipeCancelRepair = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = ref.current;

    if (!root) {
      return;
    }

    const drags = new Map<number, { toast: Element; clientY: number }>();

    const onDown = (event: PointerEvent) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const toast = (event.target as Element | null)?.closest?.('[data-sileo-toast]');

      if (toast) {
        drags.set(event.pointerId, { toast, clientY: event.clientY });
      }
    };

    const onUp = (event: PointerEvent) => {
      if (event.isTrusted) {
        drags.delete(event.pointerId);
      }
    };

    const onCancel = (event: PointerEvent) => {
      const drag = drags.get(event.pointerId);

      if (!drag) {
        return;
      }

      drags.delete(event.pointerId);
      drag.toast.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: event.pointerId,
          clientY: drag.clientY,
          bubbles: true,
        }),
      );
    };

    root.addEventListener('pointerdown', onDown, true);
    root.addEventListener('pointerup', onUp, true);
    root.addEventListener('pointercancel', onCancel, true);
    root.addEventListener('lostpointercapture', onCancel, true);

    return () => {
      root.removeEventListener('pointerdown', onDown, true);
      root.removeEventListener('pointerup', onUp, true);
      root.removeEventListener('pointercancel', onCancel, true);
      root.removeEventListener('lostpointercapture', onCancel, true);
    };
  }, []);

  return ref;
};

/**
 * Repair Sileo's gooey filter in Safari/WebKit: switch the filter region to
 * `userSpaceOnUse` (WebKit returns an empty raster otherwise) and draw the
 * shadow inside the filter (WebKit drops the CSS drop-shadow). Blink/Gecko
 * never enter this effect.
 */
const useGooeyFilterRepairForSafari = (isEnabled: boolean, theme: 'light' | 'dark') => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const root = ref.current;

    if (!root) {
      return;
    }

    const fix = (filter: SVGFilterElement) => {
      if (filter.dataset.pulseGooeyFixed === 'true') {
        return;
      }

      filter.setAttribute('filterUnits', 'userSpaceOnUse');
      filter.setAttribute('x', '-40');
      filter.setAttribute('y', '-40');
      filter.setAttribute('width', '430');
      filter.setAttribute('height', '2000');

      const isFlipped = isYFlipped(filter.closest('[data-sileo-canvas]'));

      for (const shadow of SAFARI_SHADOW[theme]) {
        const dropShadow = document.createElementNS(SVG_NS, 'feDropShadow');

        dropShadow.setAttribute('dx', '0');
        dropShadow.setAttribute('dy', String(isFlipped ? -shadow.dy : shadow.dy));
        dropShadow.setAttribute('stdDeviation', String(shadow.blur));
        dropShadow.setAttribute('flood-color', '#000000');
        dropShadow.setAttribute('flood-opacity', String(shadow.opacity));
        filter.appendChild(dropShadow);
      }

      filter.dataset.pulseGooeyFixed = 'true';
    };

    const scan = (node: ParentNode) => {
      node.querySelectorAll<SVGFilterElement>('filter[id^="sileo-gooey-"]').forEach(fix);
    };

    scan(root);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const added of record.addedNodes) {
          if (added.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }

          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const element = added as Element;

          const isGooeyFilter =
            element.namespaceURI === SVG_NS &&
            element.tagName.toLowerCase() === 'filter' &&
            element.id.startsWith('sileo-gooey-');

          if (isGooeyFilter) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            fix(element as SVGFilterElement);
          } else {
            scan(element);
          }
        }
      }
    });

    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [isEnabled, theme]);

  return ref;
};

const resolveTheme = (theme: PulseTheme): 'light' | 'dark' => {
  if (theme !== 'system') {
    return theme;
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
};

/**
 * Whether an element renders Y-mirrored. Sileo flips the canvas for bottom
 * toasts, so a downward shadow offset must be negated.
 */
const isYFlipped = (element: Element | null): boolean => {
  if (!element) {
    return false;
  }

  const transform = getComputedStyle(element).transform;

  if (!transform || transform === 'none') {
    return false;
  }

  try {
    return new DOMMatrixReadOnly(transform).d < 0;
  } catch {
    return false;
  }
};

/** Same predicate pulse.css uses to turn the CSS shadow off for WebKit. */
const isWebKit = (): boolean => {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('-webkit-hyphens', 'none')
  );
};

/** Gates the Windows stability fixes in pulse.css and the Sileo patch. */
const isWindows = (): boolean => {
  return typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
};

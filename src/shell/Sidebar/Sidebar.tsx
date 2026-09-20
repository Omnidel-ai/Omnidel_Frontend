import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DemoNavChild, DemoNavItem } from "../../data/types";
import { NavIcon } from "./NavIcon";

/** Rail widths and the logo-row height, which must match the topbar's. */
export const SIDEBAR_W_OPEN = 220;
export const SIDEBAR_W_CLOSED = 56;
export const SHELL_TOPBAR_H = 64;

const EASE_OUT = "cubic-bezier(0.32, 0.72, 0, 1)";
const WIDTH_MS = 280;
const FADE_MS = 140;

export interface SidebarProps {
  brand: { name: string; badge: string };
  items: DemoNavItem[];
  /** Currently open route. The caller owns routing. */
  activeHref: string;
  onNavigate: (href: string) => void;
  /** Drawer mode: fixed, slides in from the left, backdrop behind it. */
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  /** Extra rows pinned to the bottom, above the collapse control. */
  footer?: { label: string; icon?: string; onClick: () => void; dot?: boolean }[];
}

/**
 * Collapsible navigation rail.
 *
 * Items, labels, badges and grouping all arrive as data — the component has no
 * route table and no permission logic of its own. Collapsed, the rail is a
 * 56px strip of icons with hover tooltips and flyout sections; expanded, the
 * sections open inline. On phones it becomes an off-canvas drawer.
 */
export function Sidebar({
  brand,
  items,
  activeHref,
  onNavigate,
  isMobile = false,
  mobileOpen = false,
  onMobileOpenChange,
  footer = [],
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  // The section whose children are shown. Starts on whichever section owns the
  // active route, so a deep link opens with its group already unfolded.
  const [openSection, setOpenSection] = useState<string | null>(
    () => items.find((i) => i.children?.some((c) => c.href === activeHref))?.href ?? null,
  );

  const width = isMobile ? SIDEBAR_W_OPEN : collapsed ? SIDEBAR_W_CLOSED : SIDEBAR_W_OPEN;
  const showLabels = isMobile || !collapsed;

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          className="shell-backdrop"
          onClick={() => onMobileOpenChange?.(false)}
          aria-hidden="true"
        />
      )}
      <aside
        style={{
          width,
          minWidth: width,
          background: "var(--surface)",
          borderRight: "1px solid var(--rule)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          ...(isMobile
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                height: "100dvh",
                flexShrink: 0,
                transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
                transition: `transform ${WIDTH_MS}ms ${EASE_OUT}`,
                boxShadow: mobileOpen ? "var(--shadow-md)" : "none",
                zIndex: 40,
              }
            : {
                position: "sticky",
                top: 0,
                height: "100vh",
                flexShrink: 0,
                transition: `width ${WIDTH_MS}ms ${EASE_OUT}, min-width ${WIDTH_MS}ms ${EASE_OUT}`,
                zIndex: 20,
              }),
        }}
      >
        {/* Logo row. The badge is the collapse control on desktop, so its
            padding stays fixed and the circle lands dead centre at 56px. */}
        <div
          style={{
            height: SHELL_TOPBAR_H,
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            gap: 9,
            borderBottom: "1px solid var(--rule)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => (isMobile ? onMobileOpenChange?.(false) : setCollapsed((c) => !c))}
            aria-label={isMobile ? "Close navigation" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--green-deep)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
            }}
          >
            <span
              style={{
                color: "var(--surface)",
                fontFamily: "var(--sans)",
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {brand.badge}
            </span>
          </button>
          <span
            style={{
              fontFamily: "var(--serif)",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              opacity: showLabels ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ${EASE_OUT}`,
            }}
          >
            {brand.name}
          </span>
        </div>

        <nav
          className="sidebar-nav"
          aria-label="Main"
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            padding: "6px 4px",
          }}
        >
          {items.map((item) =>
            item.children?.length ? (
              <NavSection
                key={item.href}
                item={item}
                collapsed={!showLabels}
                open={openSection === item.href}
                onToggle={() => setOpenSection((cur) => (cur === item.href ? null : item.href))}
                activeHref={activeHref}
                onNavigate={(href) => {
                  onNavigate(href);
                  if (isMobile) onMobileOpenChange?.(false);
                }}
              />
            ) : (
              <NavRow
                key={item.href}
                label={item.label}
                icon={item.icon}
                active={item.href === activeHref}
                collapsed={!showLabels}
                onClick={() => {
                  onNavigate(item.href);
                  if (isMobile) onMobileOpenChange?.(false);
                }}
              />
            ),
          )}
        </nav>

        <div style={{ borderTop: "1px solid var(--rule)", flexShrink: 0 }}>
          {footer.map((f) => (
            <BottomRow
              key={f.label}
              label={f.label}
              icon={f.icon}
              dot={f.dot}
              collapsed={!showLabels}
              onClick={f.onClick}
            />
          ))}
          {!isMobile && (
            <BottomRow
              label={collapsed ? "Expand" : "Collapse"}
              icon="chevron-left"
              collapsed={collapsed}
              flipIcon={collapsed}
              onClick={() => setCollapsed((c) => !c)}
            />
          )}
        </div>
      </aside>
    </>
  );
}

/** A leaf item: icon + label, tooltip when the rail is collapsed. */
function NavRow({
  label,
  icon,
  active,
  collapsed,
  onClick,
}: {
  label: string;
  icon?: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="nav-link"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        style={{ ...rowStyle, ...(active ? activeRowStyle : null) }}
      >
        <NavIcon name={icon} />
        <span
          style={{
            flex: 1,
            textAlign: "left",
            whiteSpace: "nowrap",
            opacity: collapsed ? 0 : 1,
            transition: `opacity ${FADE_MS}ms ${EASE_OUT}`,
          }}
        >
          {label}
        </span>
      </button>
      {collapsed && hovered && <Tooltip label={label} />}
    </div>
  );
}

/** A group: header row + inline children, or a flyout card when collapsed. */
function NavSection({
  item,
  collapsed,
  open,
  onToggle,
  activeHref,
  onNavigate,
}: {
  item: DemoNavItem;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  activeHref: string;
  onNavigate: (href: string) => void;
}) {
  const kids = item.children ?? [];
  const anyActive = kids.some((c) => c.href === activeHref);
  const [flyout, setFlyout] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);

  useEffect(() => {
    if (!flyout || !ref.current) return;
    setFlyoutTop(ref.current.getBoundingClientRect().top);
  }, [flyout]);

  return (
    <div
      ref={ref}
      style={{ marginTop: 4, position: "relative" }}
      onMouseEnter={collapsed ? () => setFlyout(true) : undefined}
      onMouseLeave={collapsed ? () => setFlyout(false) : undefined}
    >
      <button
        type="button"
        className="nav-link"
        onClick={collapsed ? () => setFlyout((f) => !f) : onToggle}
        aria-expanded={collapsed ? flyout : open}
        style={{
          ...rowStyle,
          ...(anyActive ? activeRowStyle : null),
        }}
      >
        <NavIcon name={item.icon} />
        <span
          style={{
            flex: 1,
            textAlign: "left",
            whiteSpace: "nowrap",
            opacity: collapsed ? 0 : 1,
            transition: `opacity ${FADE_MS}ms ${EASE_OUT}`,
          }}
        >
          {item.label}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-mute)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            flexShrink: 0,
            opacity: collapsed ? 0 : 1,
            transform: open ? "rotate(90deg)" : "rotate(0)",
            transition: `opacity ${FADE_MS}ms ${EASE_OUT}, transform 180ms ${EASE_OUT}`,
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Inline list. Kept mounted so it folds before the rail narrows. */}
      <div
        style={{
          marginLeft: 22,
          borderLeft: "1px solid var(--rule)",
          marginBottom: 4,
          maxHeight: !collapsed && open ? kids.length * 34 + 8 : 0,
          opacity: !collapsed && open ? 1 : 0,
          overflow: "hidden",
          transition: `max-height 240ms ${EASE_OUT}, opacity ${FADE_MS}ms ${EASE_OUT}`,
        }}
      >
        {kids.map((c) => (
          <ChildRow key={c.href} child={c} active={c.href === activeHref} onNavigate={onNavigate} />
        ))}
      </div>

      {collapsed && flyout && (
        <div
          className="sidebar-flyout"
          style={{
            position: "fixed",
            top: flyoutTop,
            left: SIDEBAR_W_CLOSED + 4,
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)",
            padding: "4px 0",
            minWidth: 180,
            zIndex: 50,
            boxShadow: "var(--shadow-md)",
            maxHeight: `calc(100vh - ${flyoutTop + 12}px)`,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "6px 14px 6px",
              fontFamily: "var(--mono)",
              fontSize: 9.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
            }}
          >
            {item.label}
          </div>
          {kids.map((c) => (
            <ChildRow key={c.href} child={c} active={c.href === activeHref} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildRow({
  child,
  active,
  onNavigate,
}: {
  child: DemoNavChild;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <button
      type="button"
      className="nav-link"
      onClick={() => onNavigate(child.href)}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        width: "100%",
        padding: "8px 14px",
        fontSize: 13,
        fontFamily: "var(--sans)",
        border: "none",
        textAlign: "left",
        cursor: "pointer",
        color: active ? "var(--green-deep)" : "var(--ink-soft)",
        fontWeight: active ? 600 : 400,
        background: active ? "var(--green-wash)" : "transparent",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {child.label}
      </span>
      {child.badge != null && child.badge > 0 && <StageCount n={child.badge} active={active} />}
    </button>
  );
}

function StageCount({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 10,
        padding: "1px 6px",
        borderRadius: 999,
        flexShrink: 0,
        background: active ? "var(--green-deep)" : "var(--surface-sunk)",
        color: active ? "var(--surface)" : "var(--ink-mute)",
      }}
    >
      {n}
    </span>
  );
}

function BottomRow({
  label,
  icon,
  collapsed,
  onClick,
  dot,
  flipIcon,
}: {
  label: string;
  icon?: string;
  collapsed: boolean;
  onClick: () => void;
  dot?: boolean;
  flipIcon?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="nav-link"
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          // 21px parks the 14px icon at x=28 — the centre of the 56px rail.
          padding: "10px 21px",
          width: "100%",
          border: "none",
          background: "transparent",
          color: "var(--ink-mute)",
          cursor: "pointer",
          borderRadius: 0,
          fontSize: 12,
          fontFamily: "var(--sans)",
        }}
      >
        <span style={{ transform: flipIcon ? "rotate(180deg)" : undefined, display: "inline-flex" }}>
          <NavIcon name={icon} size={14} />
        </span>
        <span
          style={{
            whiteSpace: "nowrap",
            opacity: collapsed ? 0 : 1,
            transition: `opacity ${FADE_MS}ms ${EASE_OUT}`,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {label}
          {!collapsed && dot && <UnreadDot />}
        </span>
        {collapsed && dot && (
          <span style={{ position: "absolute", top: 8, right: 10 }}>
            <UnreadDot />
          </span>
        )}
      </button>
      {collapsed && hovered && <Tooltip label={label} />}
    </div>
  );
}

function UnreadDot() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--terracotta)" }}
    />
  );
}

/** Label card for a collapsed row. Absolute, not portalled — the rail does not clip it. */
function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      style={{
        position: "absolute",
        left: "calc(100% + 8px)",
        top: "50%",
        transform: "translateY(-50%)",
        whiteSpace: "nowrap",
        background: "var(--ink)",
        color: "var(--page)",
        fontSize: 11.5,
        fontFamily: "var(--sans)",
        padding: "4px 8px",
        borderRadius: "var(--r-sm)",
        zIndex: 60,
        pointerEvents: "none",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {label}
    </span>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 14px",
  fontSize: 14,
  fontWeight: 400,
  width: "100%",
  border: "none",
  fontFamily: "var(--sans)",
  color: "var(--ink-soft)",
  background: "transparent",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  marginBottom: 1,
  textAlign: "left",
};

const activeRowStyle: CSSProperties = {
  color: "var(--green-deep)",
  fontWeight: 600,
  background: "var(--green-wash)",
};

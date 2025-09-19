// src/components/Navigation.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home,
  FileText,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ClipboardCheck,
  MessageSquare,
  UserCheck,
  CheckCircle,
  Building2,
  Menu,
  X,
} from "lucide-react";

/**
 * Tiny audio + haptics helpers
 */
function useHapticsAndSound() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Lazily create a single AudioContext (first user gesture)
  const ensureAudio = () => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext ||
          // @ts-ignore
          window.webkitAudioContext)();
      } catch {
        audioCtxRef.current = null;
      }
    }
    return audioCtxRef.current;
  };

  const beep = (freq = 880, durMs = 60, gain = 0.02) => {
    const ac = ensureAudio();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ac.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      osc.disconnect();
      g.disconnect();
    }, durMs);
  };

  const vibrate = (pattern: number | number[] = 12) => {
    if (navigator?.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // ignore
      }
    }
  };

  const clickFx = () => {
    // Respect reduced motion by skipping vib + beep if requested
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReduced) {
      vibrate(10);
      beep(740, 45, 0.015);
    }
  };

  const openFx = () => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReduced) {
      vibrate([10, 40, 10]);
      beep(620, 55, 0.018);
      setTimeout(() => beep(880, 55, 0.016), 60);
    }
  };

  const closeFx = () => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReduced) {
      vibrate(8);
      beep(560, 40, 0.014);
    }
  };

  return { clickFx, openFx, closeFx };
}

const Navigation: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { clickFx, openFx, closeFx } = useHapticsAndSound();

  const [mobileOpen, setMobileOpen] = useState(false);
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = useMemo(
    () => [
      {
        path: "/",
        label: "Dashboard",
        icon: Home,
        roles: [
          "requestor",
          "production",
          "quality",
          "technical",
          "head",
          "technical-head",
          "plant-head",
          "admin",
          "sales",
        ],
      },
      {
        path: "/level2-review",
        label: "Level 2 Review",
        icon: ClipboardCheck,
        roles: ["production", "quality", "technical", "admin"],
      },
      {
        path: "/level3-review",
        label: "Head Review",
        icon: UserCheck,
        roles: ["head", "admin"],
      },
      {
        path: "/level4-review",
        label: "Technical Head",
        icon: Users,
        roles: ["technical-head", "admin"],
      },
      {
        path: "/final-comments",
        label: "Final Comments",
        icon: MessageSquare,
        roles: ["requestor", "admin"],
      },
      {
        path: "/level5-approval",
        label: "Plant Head Approval",
        icon: CheckCircle,
        roles: ["plant-head", "admin"],
      },
      {
        path: "/spec-builder",
        label: "Spec Builder",
        icon: Building2,
        roles: ["requestor", "admin"],
      },
      {
        path: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        roles: [
          "requestor",
          "production",
          "quality",
          "technical",
          "head",
          "technical-head",
          "plant-head",
          "admin",
          "sales",
        ],
      },
      {
        path: "/approvals",
        label: "Approvals",
        icon: FileText,
        roles: ["plant-head", "admin"],
      },
      {
        path: "/admin",
        label: "Admin",
        icon: Settings,
        roles: ["admin"],
      },
      // Customers hub for Sales/Admin
      {
        path: "/customers",
        label: "Customers",
        icon: Users,
        roles: ["sales", "admin"],
      },
      // Sales Requests list (kept for Admin; Sales enters via Customers)
      {
        path: "/sales-requests",
        label: "Sales Requests",
        icon: FileText,
        roles: ["admin"], // hide from "sales" to enforce flow via Customers
      },
    ],
    []
  );

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => item.roles.includes(user?.role || "")),
    [navItems, user?.role]
  );

  /**
   * Side effects for mobile menu:
   * - Close on route change
   * - Lock scroll when open
   * - Focus management
   * - ESC to close
   */
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      // small delay to ensure overlay is rendered before focusing
      const t = setTimeout(() => {
        firstLinkRef.current?.focus();
      }, 120);

      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      // Close when route changes
      setMobileOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
        closeFx();
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, closeFx]);

  const toggleMobile = () => {
    setMobileOpen((prev) => {
      const next = !prev;
      if (next) openFx();
      else closeFx();
      return next;
    });
    clickFx();
  };

  const openMobile = () => {
    setMobileOpen(true);
    openFx();
    clickFx();
  };

  const closeMobile = () => {
    setMobileOpen(false);
    closeFx();
    clickFx();
    menuButtonRef.current?.focus();
  };

  return (
    <nav className="bg-white shadow-sm border-b relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex justify-between h-16">
          {/* Brand + Desktop Nav */}
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">QAP System</h1>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex space-x-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={[
                      "inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all",
                      "outline-none ring-0 focus-visible:ring-2 focus-visible:ring-blue-400",
                      active
                        ? "bg-blue-100 text-blue-700 shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                    ].join(" ")}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side: user + logout + mobile button */}
          <div className="flex items-center space-x-3">
            {/* User pill (hidden on very small widths) */}
            <div className="hidden xs:flex items-center space-x-2">
              <Badge variant="outline" className="capitalize">
                {user?.role?.replace("-", " ")}
              </Badge>
              <span className="text-sm text-gray-700 truncate max-w-[10rem]">
                {user?.username}
              </span>
              {user?.plant && (
                <Badge variant="secondary">{user.plant.toUpperCase()}</Badge>
              )}
            </div>

            {/* Desktop logout */}
            <div className="hidden md:block">
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>

            {/* Mobile hamburger */}
            <div className="md:hidden">
              <button
                ref={menuButtonRef}
                onClick={toggleMobile}
                aria-label={
                  mobileOpen ? "Close navigation menu" : "Open navigation menu"
                }
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
                className={[
                  "inline-flex items-center justify-center p-2 rounded-md",
                  "text-gray-700 hover:text-gray-900 hover:bg-gray-100",
                  "transition-all duration-200 ease-out",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                  mobileOpen ? "rotate-90" : "rotate-0",
                ].join(" ")}
              >
                {mobileOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Full-Screen Overlay Menu */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        className={[
          "fixed inset-0 md:hidden",
          "transition-opacity duration-300",
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={(e) => {
          // click outside panel closes
          if (e.target === e.currentTarget) closeMobile();
        }}
      >
        {/* Backdrop */}
        <div
          className={[
            "absolute inset-0",
            "bg-black/40 backdrop-blur-[2px]",
            "transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        {/* Sliding panel */}
        <div
          className={[
            "relative z-10 h-full w-full",
            "flex flex-col",
            "bg-white",
            "transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
            mobileOpen ? "translate-y-0" : "-translate-y-4",
            mobileOpen ? "shadow-2xl" : "shadow-none",
          ].join(" ")}
        >
          {/* Top row inside overlay */}
          <div className="flex items-center justify-between px-4 py-4 border-b">
            <div className="flex items-center space-x-2">
              <span className="text-lg font-semibold">Menu</span>
              {user?.plant && (
                <Badge variant="secondary" className="ml-1">
                  {user.plant.toUpperCase()}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {/* Small logout in overlay */}
              <Button
                onClick={() => {
                  clickFx();
                  handleLogout();
                }}
                size="sm"
                variant="ghost"
                className="text-gray-700 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
              <button
                onClick={closeMobile}
                aria-label="Close navigation"
                className="p-2 rounded-md text-gray-700 hover:bg-gray-100 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Menu items */}
          <div className="flex-1 overflow-y-auto">
            <ul className="px-3 py-4 space-y-1">
              {visibleNavItems.map((item, idx) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                const delay = Math.min(40 * idx, 360); // gentle stagger
                return (
                  <li key={item.path} style={{ transitionDelay: `${delay}ms` }}>
                    <Link
                      ref={idx === 0 ? firstLinkRef : undefined}
                      to={item.path}
                      onClick={() => {
                        clickFx();
                        // close happens via route change effect; keep instant UX snappy:
                        setMobileOpen(false);
                      }}
                      className={[
                        "group flex items-center w-full",
                        "px-3 py-3 rounded-lg",
                        "outline-none ring-0 focus-visible:ring-2 focus-visible:ring-blue-400",
                        "transition-all duration-200",
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700 hover:text-gray-900 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mr-3 inline-flex items-center justify-center",
                          "h-9 w-9 rounded-md",
                          "transition-all duration-300",
                          "group-hover:scale-105 group-active:scale-95",
                          active
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700",
                        ].join(" ")}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-base font-medium">
                        {item.label}
                      </span>
                      {/* subtle chevron micro-interaction via pseudo element */}
                      <span
                        className={[
                          "ml-auto",
                          "h-2 w-2 rounded-full",
                          active ? "bg-blue-500" : "bg-gray-300",
                          "transition-transform duration-300",
                          "group-hover:scale-125",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Footer inside overlay */}
          <div className="border-t px-4 py-3 text-sm text-gray-600 flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="truncate max-w-[12rem]">{user?.username}</span>
              {user?.role && (
                <Badge variant="outline" className="capitalize">
                  {user.role.replace("-", " ")}
                </Badge>
              )}
            </div>
            <button
              onClick={openMobile}
              className="text-gray-400 hover:text-gray-600 transition"
              title="Replay open effect"
            >
              •••
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

import React from "react";
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
} from "lucide-react";

const Navigation: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
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
  ];

  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role || "")
  );

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">QAP System</h1>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex space-x-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.path)
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Info and Logout */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="capitalize">
                {user?.role?.replace("-", " ")}
              </Badge>
              <span className="text-sm text-gray-700">{user?.username}</span>
              {user?.plant && (
                <Badge variant="secondary">{user.plant.toUpperCase()}</Badge>
              )}
            </div>
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
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive(item.path)
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

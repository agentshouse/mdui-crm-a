import { DataImportButton } from "../dataImport/DataImportButton";
import { Settings, UsersRound } from "lucide-react";
import { useTranslate } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { useConfigurationContext } from "../root/ConfigurationContext";
const Header = () => {
  const { title } = useConfigurationContext();
  const location = useLocation();
  const translate = useTranslate();
  const tabs = [
    ["/", "ra.page.dashboard"],
    ["/contacts", "resources.contacts.name"],
    ["/companies", "resources.companies.name"],
    ["/deals", "resources.deals.name"],
    ["/tasks", "resources.tasks.name"],
  ];
  return (
    <nav className="grow">
      <header className="bg-secondary">
        <div className="px-4">
          <div className="flex justify-between items-center flex-1">
            <Link
              to="/"
              className="flex items-center gap-2 text-secondary-foreground no-underline"
            >
              <UsersRound className="size-6" aria-hidden />
              <h1 className="text-xl font-semibold">{title}</h1>
            </Link>
            <nav className="flex">
              {tabs.map(([to, label]) => (
                <Link
                  key={to}
                  to={to}
                  className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${matchPath(to === "/" ? "/" : `${to}/*`, location.pathname) ? "text-secondary-foreground border-secondary-foreground" : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80"}`}
                >
                  {translate(label, { smart_count: 2 })}
                </Link>
              ))}
            </nav>
            <div className="flex items-center">
              <DataImportButton />
              <ThemeModeToggle />
              <RefreshButton />
              <Link to="/settings" className="p-2" aria-label="Settings">
                <Settings className="size-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>
    </nav>
  );
};
export default Header;

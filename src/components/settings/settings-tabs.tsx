import { useRef } from "react";
import { Search, type LucideIcon } from "lucide-react";

export interface SettingsTab {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
}

export const matchesSettingsSearch = (query: string, ...terms: string[]) => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;

  return terms.join(" ").toLocaleLowerCase().includes(normalizedQuery);
};

interface SettingsTabsProps {
  activeTab: string;
  tabs: SettingsTab[];
  onTabChange: (tabId: string) => void;
  ariaLabel: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export const SettingsTabs = ({
  activeTab,
  tabs,
  onTabChange,
  ariaLabel,
  searchQuery,
  onSearchQueryChange,
}: SettingsTabsProps) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleTabs = tabs.filter((tab) => {
    return matchesSettingsSearch(normalizedQuery, tab.label, tab.id, ...(tab.keywords || []));
  });

  const handleSearchChange = (nextQuery: string) => {
    onSearchQueryChange(nextQuery);
    const nextVisibleTabs = tabs.filter((tab) =>
      matchesSettingsSearch(nextQuery, tab.label, tab.id, ...(tab.keywords || []))
    );
    if (nextVisibleTabs.length > 0 && !nextVisibleTabs.some((tab) => tab.id === activeTab)) {
      onTabChange(nextVisibleTabs[0].id);
    }
  };

  const focusTab = (index: number) => {
    if (visibleTabs.length === 0) return;
    const nextIndex = (index + visibleTabs.length) % visibleTabs.length;
    onTabChange(visibleTabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className="flex w-full shrink-0 flex-col border-b border-zinc-200 bg-zinc-100/80 p-2 dark:border-zinc-700/70 dark:bg-[#1e1f22] sm:w-56 sm:border-b-0 sm:border-r"
    >
      <div className="relative shrink-0">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder="Search settings"
          aria-label="Search settings"
          className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-2 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-[#313338] dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      <div
        role="tablist"
        aria-label={ariaLabel}
        className="mt-2 grid max-h-36 grid-cols-2 gap-1 overflow-y-auto sm:flex sm:max-h-none sm:flex-1 sm:flex-col"
      >
      {visibleTabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${ariaLabel}-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`${ariaLabel}-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                focusTab(index + 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                focusTab(index - 1);
              } else if (event.key === "Home") {
                event.preventDefault();
                focusTab(0);
              } else if (event.key === "End") {
                event.preventDefault();
                focusTab(visibleTabs.length - 1);
              }
            }}
            className={`flex min-h-10 items-center justify-start gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:w-full sm:px-3 ${isActive
              ? "bg-white text-indigo-600 shadow-sm dark:bg-[#313338] dark:text-indigo-300"
              : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-[#2b2d31] dark:hover:text-zinc-100"
              }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
      {visibleTabs.length === 0 && (
        <p className="col-span-2 px-2 py-3 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          No matching settings
        </p>
      )}
      </div>
    </div>
  );
};

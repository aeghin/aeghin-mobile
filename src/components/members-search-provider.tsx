import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type MembersSearchContextValue = {
  /** What the roster is filtered by, raw as typed. */
  query: string;
  setQuery: (query: string) => void;
};

const MembersSearchContext = createContext<MembersSearchContextValue | null>(
  null,
);

/**
 * The members search term, held above the tab navigator.
 *
 * The field lives in `NativeTabs.BottomAccessory` — declared in the tabs
 * layout — while the filtering happens down in the members screen. Two
 * different subtrees, so the term cannot be `useState` in either one.
 *
 * It also cannot be state *inside* the field. UIKit renders a bottom accessory
 * once per environment, regular and inline, and swaps between them as the tab
 * bar minimises on scroll. Both copies mount at the same time and share
 * nothing, so a term held locally would vanish the moment the bar collapsed.
 * Reading it from here is what keeps the two in step.
 */
export function MembersSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");

  const value = useMemo(() => ({ query, setQuery }), [query]);

  return (
    <MembersSearchContext.Provider value={value}>
      {children}
    </MembersSearchContext.Provider>
  );
}

export function useMembersSearch(): MembersSearchContextValue {
  const value = useContext(MembersSearchContext);

  if (!value) {
    throw new Error(
      "useMembersSearch must be used inside <MembersSearchProvider>.",
    );
  }

  return value;
}

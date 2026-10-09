type IconName = "heart" | "profile" | "gem" | "life" | "translate" | "talk" | "agreement" | "summary" | "leaf" | "arrow";
const paths: Record<IconName, string> = {
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  gem: "m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18",
  life: "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2M14 17h2",
  translate: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  talk: "M21 11a9 9 0 0 1-9 9H4l-1 2v-8a9 9 0 1 1 18-3ZM7 10h10M7 14h6",
  agreement: "M7 5h14M7 12h14M7 19h14M3 4v2M3 11v2M3 18v2",
  summary: "M7 3h10v18H7zM10 7h4M10 11h4M10 15h4",
  leaf: "M12 21V10M12 15C3 15 3 7 3 7s9 0 9 8ZM12 10c0-7 9-7 9-7s0 7-9 7ZM12 20c0-7 9-7 9-7s0 7-9 7Z",
  arrow: "M4 12h16M14 6l6 6-6 6",
};
export function PairIcon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}

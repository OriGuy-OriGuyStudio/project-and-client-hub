/** Shared vertical timeline: numbered dot nodes (a primary circle holding the
 *  index) connected by a vertical line on the inline-start side (right in
 *  RTL), with flexible node content beside each dot. Used by both
 *  ProcessSection ("איך זה עובד", name+desc+duration per phase) and
 *  NextStepsSection ("השלבים הבאים", plain text per step) so the two
 *  numbered-list sections on the quote page read as one system instead of
 *  two different list treatments. `renderItem` supplies whatever content the
 *  caller needs beside the node; the line/dot markup itself never changes. */
export function Timeline<T extends { id: string }>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  if (!items || items.length === 0) return null;
  return (
    <ol className="relative space-y-7 ps-12">
      <div
        aria-hidden
        className="absolute bottom-4 top-3 w-0.5 rounded-full bg-gradient-to-b from-primary/70 via-primary/30 to-primary/10"
        style={{ insetInlineStart: "15px" }}
      />
      {items.map((item, i) => (
        <li key={item.id} className="relative">
          <span className="absolute -start-12 top-0 grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-4 ring-background">
            {i + 1}
          </span>
          {renderItem(item, i)}
        </li>
      ))}
    </ol>
  );
}

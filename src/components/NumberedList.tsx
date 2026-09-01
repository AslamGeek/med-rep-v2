export function NumberedList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ol className="numbered-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  )
}

export function TwoColumnLists({
  leftLabel,
  leftItems,
  rightLabel,
  rightItems,
}: {
  leftLabel: string
  leftItems: string[]
  rightLabel: string
  rightItems: string[]
}) {
  if (leftItems.length === 0 && rightItems.length === 0) return null
  return (
    <div className="two-col-lists">
      {leftItems.length > 0 && (
        <div className="two-col-lists-col">
          <p className="two-col-lists-label">{leftLabel}</p>
          <NumberedList items={leftItems} />
        </div>
      )}
      {rightItems.length > 0 && (
        <div className="two-col-lists-col">
          <p className="two-col-lists-label">{rightLabel}</p>
          <NumberedList items={rightItems} />
        </div>
      )}
    </div>
  )
}
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
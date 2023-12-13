export default function JsonDisplay(props: { value: unknown }) {
  return (
    <pre style={{ width: "600px", whiteSpace: "pre-wrap" }}>
      {JSON.stringify(props.value, undefined, 2)}
    </pre>
  )
}

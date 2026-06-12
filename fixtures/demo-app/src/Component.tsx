export function Card(props: { html: string; url: string }) {
  return (
    <div>
      <img src={props.url} />
      <div dangerouslySetInnerHTML={{ __html: props.html }} />
      <a target="_blank" href={props.url}>
        open
      </a>
    </div>
  );
}

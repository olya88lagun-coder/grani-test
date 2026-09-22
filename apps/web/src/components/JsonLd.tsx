// JSON.stringify не экранирует «<», поэтому «</script>» в тексте закрыл бы тег
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function createSeoHead({
  title,
  description,
  url,
}: {
  title: string
  description: string
  url: string
}) {
  return {
    meta: [
      {
        title,
      },
      {
        name: 'description',
        content: description,
      },
      {
        name: 'robots',
        content: 'index, follow',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:site_name',
        content: 'QuickSpeak English Course',
      },
      {
        property: 'og:title',
        content: title,
      },
      {
        property: 'og:description',
        content: description,
      },
      {
        property: 'og:url',
        content: url,
      },
      {
        property: 'og:locale',
        content: 'id_ID',
      },
      {
        name: 'twitter:card',
        content: 'summary',
      },
      {
        name: 'twitter:title',
        content: title,
      },
      {
        name: 'twitter:description',
        content: description,
      },
    ],
    links: [
      {
        rel: 'canonical',
        href: url,
      },
    ],
  }
}

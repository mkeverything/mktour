import { getOrganizationSchema, getWebsiteSchema } from './seo-json-ld';

export default async function JsonLd() {
  const [organization, website] = await Promise.all([
    getOrganizationSchema(),
    getWebsiteSchema(),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}

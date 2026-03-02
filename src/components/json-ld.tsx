import {
  getOrganizationSchema,
  getSoftwareApplicationSchema,
  getWebsiteSchema,
} from './seo-json-ld';

export default async function JsonLd() {
  const [organization, website, software] = await Promise.all([
    getOrganizationSchema(),
    getWebsiteSchema(),
    getSoftwareApplicationSchema(),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(software) }}
      />
    </>
  );
}

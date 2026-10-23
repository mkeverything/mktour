import {
  getOrganizationSchema,
  getSoftwareApplicationSchema,
  getWebsiteSchema,
} from './seo-json-ld';

export default async function JsonLd() {
  const schemas = await Promise.all([
    getOrganizationSchema(),
    getWebsiteSchema(),
    getSoftwareApplicationSchema(),
  ]);

  return schemas.map((schema) => (
    <script key={schema['@type']} type="application/ld+json">
      {JSON.stringify(schema)}
    </script>
  ));
}

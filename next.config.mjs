/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Serverless bundles (Netlify) must ship Prisma's Linux query engine with every route
    outputFileTracingIncludes: {
      "/**/*": ["./node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node", "./node_modules/.prisma/client/*.prisma"],
    },
  },
};

export default nextConfig;
